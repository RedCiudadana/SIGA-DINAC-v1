/*
# Refine user_profile column guard: allow self-service password-changed flag clear

## Context
The previous migration (20261026210000) added a trigger that blocks non-admin users from
changing `force_password_change`. ProfileView legitimately clears `force_password_change`
to `false` after a user changes their own password. That is a safe, intended operation.
Setting `force_password_change` to `true`, however, is an admin-only action and must stay
blocked.

## Change
Update the `guard_user_profile_privileged_cols()` trigger function so that:
- Setting `force_password_change = false` is allowed for non-admins (clearing after password change).
- Setting `force_password_change = true` is still blocked for non-admins.
All other privileged column protections are unchanged.
*/

CREATE OR REPLACE FUNCTION public.guard_user_profile_privileged_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  SELECT public.is_admin() INTO is_admin_user;

  IF is_admin_user THEN
    RETURN NEW;
  END IF;

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
    IF NEW.force_password_change = true THEN
      RAISE EXCEPTION 'No tiene permisos para cambiar el indicador de cambio forzado de contraseña';
    END IF;
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'No tiene permisos para cambiar el creador del registro';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_user_profile_privileged_cols() FROM PUBLIC, anon;
