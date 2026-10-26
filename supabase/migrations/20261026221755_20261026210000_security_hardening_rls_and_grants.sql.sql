/*
# Security hardening: anon grant revocation, column-level user_profile privileges, catalog/alert policy fixes, SECURITY DEFINER execute revocation

## Context
A security audit found that a signed-in application (login screen present, all RLS policies
scoped to `authenticated`) nonetheless granted full CRUD — including TRUNCATE, REFERENCES,
and TRIGGER — to the `anon` role on every public table. Because no table has an `anon` RLS
policy (except `public_board_publications`), anon could still not read rows through the
Data API, but the grants are unsafe and violate least privilege: if any policy is ever
loosened, anon already has the verbs. The audit also found:

1. `user_profiles` grants UPDATE on ALL columns to `authenticated`, and the self-update
   policy `USING (user_id = auth.uid())` allows a user to change their own `role_id`,
   `status`, `is_active`, `failed_attempts`, `locked_until`, `force_password_change`,
   `mfa_enabled` — i.e. self-escalate privileges or unlock their own account.
2. `procurement_method_catalog` and `contract_status_catalog` use
   `USING (true)` / `WITH CHECK (true)` for `authenticated`, letting any signed-in user
   insert/update/delete catalog rows that should require `manage_catalogs`.
3. The `alerts` UPDATE policy is `USING is_account_active()` with no permission check,
   so any active user can edit any alert.
4. SECURITY DEFINER helper functions (`can_perform`, `has_permission`, `is_admin`,
   `is_auditor`, `is_account_active`, `current_user_role_code`, `create_first_admin`)
   are executable by `anon`, leaking role/permission info to unauthenticated callers.
   `create_first_admin` is a stub that only raises, but the grant is still incorrect.

## Changes

### 1. Revoke anon table privileges (except public_board_publications)
For every public table except `public_board_publications`, REVOKE all privileges from
`anon`. The app requires sign-in, so `anon` should have no path to these tables. This is
non-destructive: RLS already blocked anon reads (no anon policy), so no app behavior
changes; we are only removing unused-but-dangerous grants.

### 2. Column-level UPDATE on user_profiles
Revoke the broad table-level UPDATE grant on `user_profiles` from `authenticated` and
re-grant UPDATE only on the columns a user may edit on their own profile:
`full_name`, `position`, `organizational_unit`, `password_changed_at`,
`force_password_change`, `updated_at`, `updated_by`.

The admin path (UsersView, backed by the `is_admin()` UPDATE policy) needs to write
`role_id`, `status`, `is_active`, `access_expires_at`, `mfa_enabled`, `locked_until`,
`failed_attempts`, etc. Because RLS policies are evaluated per-role and the column grant
is per-role, a column-restricted grant to `authenticated` does not block the service_role
(edge functions) or an admin path that runs as a different role. However, the UsersView
admin path ALSO runs as `authenticated` in the browser. To allow admins to edit those
columns while preventing self-service users from doing so, we split the grant: keep the
restricted column grant for `authenticated`, and rely on the existing `is_admin()` UPDATE
policy to gate the admin columns. Postgres column privileges are per-role, not per-policy,
so the admin (also `authenticated`) would be blocked from the admin columns.

Resolution: introduce a SECURITY INVOKER helper `user_is_admin()` is already present and
used in policy `update_user_profiles_admin`. The cleanest fix that preserves the existing
admin UI is to keep the table-level UPDATE grant for `authenticated` but tighten the
self-update policy's WITH CHECK so non-admins cannot change privileged columns, AND add a
CHECK constraint-free approach via a trigger that rejects unauthorized writes to
privileged columns unless the caller is an admin.

Implementation choice: add a BEFORE UPDATE trigger on `user_profiles` that raises unless
the acting user is an admin OR only non-privileged columns are being changed. This is the
robust server-enforced control (see secure-data-access skill: column-level privileges for
role/balance/moderation columns). We keep the table-level grant so the admin UI continues
to work, but the trigger enforces the column restriction server-side regardless of what
the client sends.

Columns treated as privileged (server-enforced): `role_id`, `status`, `is_active`,
`access_expires_at`, `mfa_enabled`, `failed_attempts`, `locked_until`,
`force_password_change`, `created_by`.

### 3. Tighten catalog policies
Replace the `USING (true)` / `WITH CHECK (true)` policies on
`procurement_method_catalog` and `contract_status_catalog` with permission-gated ones
requiring `can_perform('manage_catalogs')`. SELECT stays open to active accounts.

### 4. Tighten alerts UPDATE policy
Replace `update_alerts` (`USING is_account_active()`) with a policy requiring
`can_perform('manage_alerts') OR is_admin()` so only authorized users can change alert
status/conclusion.

### 5. Revoke EXECUTE on SECURITY DEFINER helpers from anon
Revoke EXECUTE from `anon` (and PUBLIC) on: `can_perform`, `has_permission`,
`is_admin`, `is_auditor`, `is_account_active`, `current_user_role_code`,
`create_first_admin`. Grant EXECUTE to `authenticated` on the ones the frontend uses
(`can_perform`, `has_permission`, `is_admin`, `is_auditor`, `is_account_active`,
`current_user_role_code`). `create_first_admin` is a stub; leave it non-executable by
anon/authenticated (service_role still can if ever needed).

## Non-destructive
- No tables, columns, or data are dropped or renamed.
- No policies are removed without a replacement being created in the same migration.
- RLS remains enabled on all tables.

## Notes
- The trigger-based column guard is the server-enforced control recommended by the
  secure-data-access skill for role/moderation columns on a table whose browser client
  needs admin writes alongside user self-service writes.
- Edge function `verify_jwt` hardening is handled separately in config.toml + function
  code (JWT verification), not in this migration.
*/

-- ---------------------------------------------------------------------------
-- 1. Revoke anon privileges on all public tables except public_board_publications
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> 'public_board_publications'
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon;', r.tablename);
  END LOOP;
END $$;

-- Keep a narrow SELECT grant for anon on the public boards table (already has anon policy)
GRANT SELECT ON public.public_board_publications TO anon;

-- ---------------------------------------------------------------------------
-- 2. Server-enforced column guard on user_profiles privileged columns
-- ---------------------------------------------------------------------------
-- Drop existing trigger if present so re-running is safe
DROP TRIGGER IF EXISTS guard_user_profile_privileged_cols ON public.user_profiles;

-- The guard function: allow if (a) no privileged column is being changed, OR
-- (b) the acting user is an admin (is_admin()). is_admin() uses auth.uid() under the hood.
CREATE OR REPLACE FUNCTION public.guard_user_profile_privileged_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  -- Compute admin status once. is_admin() is SECURITY DEFINER and reads auth.uid().
  SELECT public.is_admin() INTO is_admin_user;

  -- If an admin is acting, allow any change.
  IF is_admin_user THEN
    RETURN NEW;
  END IF;

  -- Non-admin: block changes to privileged columns.
  IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
    RAISE EXCEPTION 'No tiene permisos para cambiar su rol';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'No tiene permisos para cambiar su estado de cuenta';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'No tiene permisos para activar/desactivar su cuenta';
  END IF;
  IF NEW.access_expires_at IS DISTINCT FROM OLD.access_expires_at THEN
    RAISE EXCEPTION 'No tiene permisos para cambiar la expiración de acceso';
  END IF;
  IF NEW.mfa_enabled IS DISTINCT FROM OLD.mfa_enabled THEN
    RAISE EXCEPTION 'No tiene permisos para cambiar la configuración de MFA';
  END IF;
  IF NEW.failed_attempts IS DISTINCT FROM OLD.failed_attempts THEN
    RAISE EXCEPTION 'No tiene permisos para reiniciar el contador de intentos fallidos';
  END IF;
  IF NEW.locked_until IS DISTINCT FROM OLD.locked_until THEN
    RAISE EXCEPTION 'No tiene permisos para desbloquear su cuenta';
  END IF;
  IF NEW.force_password_change IS DISTINCT FROM OLD.force_password_change THEN
    RAISE EXCEPTION 'No tiene permisos para cambiar el indicador de cambio forzado de contraseña';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'No tiene permisos para cambiar el creador del registro';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_user_profile_privileged_cols
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_user_profile_privileged_cols();

-- Revoke EXECUTE on the guard function from anon/public (only trigger owner needs it)
REVOKE EXECUTE ON FUNCTION public.guard_user_profile_privileged_cols() FROM PUBLIC, anon;

-- ---------------------------------------------------------------------------
-- 3. Tighten catalog policies
-- ---------------------------------------------------------------------------
-- procurement_method_catalog
DROP POLICY IF EXISTS "select_procurement_method_catalog" ON public.procurement_method_catalog;
DROP POLICY IF EXISTS "insert_procurement_method_catalog" ON public.procurement_method_catalog;
DROP POLICY IF EXISTS "update_procurement_method_catalog" ON public.procurement_method_catalog;
DROP POLICY IF EXISTS "delete_procurement_method_catalog" ON public.procurement_method_catalog;
-- Also drop the loose true-policies if they exist under different names
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'procurement_method_catalog'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.procurement_method_catalog;', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "select_procurement_method_catalog"
  ON public.procurement_method_catalog FOR SELECT
  TO authenticated USING (is_account_active());

CREATE POLICY "insert_procurement_method_catalog"
  ON public.procurement_method_catalog FOR INSERT
  TO authenticated WITH CHECK (can_perform('manage_catalogs') OR is_admin());

CREATE POLICY "update_procurement_method_catalog"
  ON public.procurement_method_catalog FOR UPDATE
  TO authenticated
  USING (can_perform('manage_catalogs') OR is_admin())
  WITH CHECK (can_perform('manage_catalogs') OR is_admin());

CREATE POLICY "delete_procurement_method_catalog"
  ON public.procurement_method_catalog FOR DELETE
  TO authenticated USING (can_perform('manage_catalogs') OR is_admin());

-- contract_status_catalog
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contract_status_catalog'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.contract_status_catalog;', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "select_contract_status_catalog"
  ON public.contract_status_catalog FOR SELECT
  TO authenticated USING (is_account_active());

CREATE POLICY "insert_contract_status_catalog"
  ON public.contract_status_catalog FOR INSERT
  TO authenticated WITH CHECK (can_perform('manage_catalogs') OR is_admin());

CREATE POLICY "update_contract_status_catalog"
  ON public.contract_status_catalog FOR UPDATE
  TO authenticated
  USING (can_perform('manage_catalogs') OR is_admin())
  WITH CHECK (can_perform('manage_catalogs') OR is_admin());

CREATE POLICY "delete_contract_status_catalog"
  ON public.contract_status_catalog FOR DELETE
  TO authenticated USING (can_perform('manage_catalogs') OR is_admin());

-- ---------------------------------------------------------------------------
-- 4. Tighten alerts UPDATE policy
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'alerts' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.alerts;', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "update_alerts"
  ON public.alerts FOR UPDATE
  TO authenticated
  USING (can_perform('manage_alerts') OR is_admin())
  WITH CHECK (can_perform('manage_alerts') OR is_admin());

-- ---------------------------------------------------------------------------
-- 5. Revoke EXECUTE on SECURITY DEFINER helpers from anon/PUBLIC
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.can_perform(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_auditor() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_account_active() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role_code() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_first_admin(text, text, text, text, text) FROM PUBLIC, anon;

-- Re-grant to authenticated for the ones the frontend legitimately calls
GRANT EXECUTE ON FUNCTION public.can_perform(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_auditor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_account_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role_code() TO authenticated;
