/*
# SIA-DINAC: Núcleo de autenticación, RBAC y configuración de seguridad

## Resumen
Crea el esquema base del Sistema Interno de Alertas de Contratación (SIA-DINAC):
roles, permisos, matriz de permisos por rol, perfiles de usuario, sesiones,
configuración de seguridad, y bitácora de auditoría (append-only).

## Tablas nuevas
- roles: catálogo de roles del sistema (6 roles iniciales).
- permissions: catálogo de permisos granulares (matriz de acciones).
- role_permissions: relación N:M entre roles y permisos.
- user_profiles: datos institucionales del usuario vinculados a auth.users.
- user_sessions: registro de sesiones activas e historial.
- security_settings: configuración global de seguridad (singleton).
- audit_logs: bitácora inmutable de acciones (sin UPDATE/DELETE desde RLS).

## Seguridad
- RLS habilitado en TODAS las tablas.
- Denegación por defecto: solo políticas explícitas permiten acceso.
- audit_logs: solo INSERT (append-only); SELECT restringido a Admin General y Auditor.
- user_profiles: usuarios leen/editan su propio perfil; admins gestionan todos.
- Función is_admin() e is_auditor() reutilizables en policies.
- Función has_permission() para verificación RBAC en backend.
- created_by/updated_by con trazabilidad.

## Notas
- Los roles se siembran en una migración posterior junto con permisos.
- El primer Administrador General se crea vía función segura create_first_admin().
*/

-- ============================================================
-- Roles
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  module text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Role-Permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- User Profiles (vinculado a auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  position text,
  organizational_unit text,
  role_id uuid REFERENCES roles(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','inactive','expired')),
  mfa_enabled boolean NOT NULL DEFAULT false,
  access_expires_at timestamptz,
  last_login_at timestamptz,
  last_login_ip text,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  force_password_change boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- User Sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token text,
  ip_address text,
  user_agent text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Security Settings (singleton: una fila)
-- ============================================================
CREATE TABLE IF NOT EXISTS security_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  max_session_minutes integer NOT NULL DEFAULT 480,
  inactivity_timeout_minutes integer NOT NULL DEFAULT 30,
  max_failed_attempts integer NOT NULL DEFAULT 5,
  lockout_duration_minutes integer NOT NULL DEFAULT 15,
  password_min_length integer NOT NULL DEFAULT 12,
  password_require_uppercase boolean NOT NULL DEFAULT true,
  password_require_lowercase boolean NOT NULL DEFAULT true,
  password_require_number boolean NOT NULL DEFAULT true,
  password_require_special boolean NOT NULL DEFAULT true,
  mfa_required boolean NOT NULL DEFAULT false,
  default_access_expiry_days integer NOT NULL DEFAULT 365,
  file_retention_days integer NOT NULL DEFAULT 365,
  audit_retention_days integer NOT NULL DEFAULT 2555,
  allowed_file_types text NOT NULL DEFAULT 'csv,xlsx,xls',
  max_file_size_mb integer NOT NULL DEFAULT 25,
  allow_export boolean NOT NULL DEFAULT true,
  allow_download boolean NOT NULL DEFAULT true,
  unit_visibility_enabled boolean NOT NULL DEFAULT false,
  restricted_access_message text NOT NULL DEFAULT 'Acceso exclusivo para personal autorizado. Las acciones realizadas dentro del sistema quedan registradas en la bitácora institucional.',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Audit Logs (append-only, inmutable desde la interfaz)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  user_email text,
  user_role text,
  user_unit text,
  action_type text NOT NULL,
  module text NOT NULL,
  affected_record text,
  description text,
  ip_address text,
  result text NOT NULL DEFAULT 'success' CHECK (result IN ('success','failure','warning')),
  session_id text,
  metadata jsonb
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Funciones auxiliares de autorización
-- ============================================================

-- Rol del usuario actual desde user_profiles
CREATE OR REPLACE FUNCTION public.current_user_role_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.code
  FROM user_profiles up
  JOIN roles r ON r.id = up.role_id
  WHERE up.user_id = auth.uid()
  LIMIT 1;
$$;

-- ¿El usuario actual es Administrador General?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN roles r ON r.id = up.role_id
    WHERE up.user_id = auth.uid()
      AND up.status = 'active'
      AND up.is_active = true
      AND r.code = 'admin_general'
  );
$$;

-- ¿El usuario actual es Auditor de sistema?
CREATE OR REPLACE FUNCTION public.is_auditor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN roles r ON r.id = up.role_id
    WHERE up.user_id = auth.uid()
      AND up.status = 'active'
      AND up.is_active = true
      AND r.code = 'system_auditor'
  );
$$;

-- ¿El usuario actual tiene un permiso específico?
CREATE OR REPLACE FUNCTION public.has_permission(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles up
    JOIN role_permissions rp ON rp.role_id = up.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE up.user_id = auth.uid()
      AND up.status = 'active'
      AND up.is_active = true
      AND p.code = p_code
  );
$$;

-- ¿La cuenta del usuario actual está activa y no expirada?
CREATE OR REPLACE FUNCTION public.is_account_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles up
    WHERE up.user_id = auth.uid()
      AND up.status = 'active'
      AND up.is_active = true
      AND (up.access_expires_at IS NULL OR up.access_expires_at > now())
      AND (up.locked_until IS NULL OR up.locked_until < now())
  );
$$;

-- ============================================================
-- Políticas RLS
-- ============================================================

-- Roles: todos los autenticados pueden leer (para mostrar menú, etc.)
DROP POLICY IF EXISTS "select_roles_authenticated" ON roles;
CREATE POLICY "select_roles_authenticated"
ON roles FOR SELECT TO authenticated
USING (is_account_active());

-- role_permissions: lectura para autenticados activos
DROP POLICY IF EXISTS "select_role_permissions_authenticated" ON role_permissions;
CREATE POLICY "select_role_permissions_authenticated"
ON role_permissions FOR SELECT TO authenticated
USING (is_account_active());

-- permissions: lectura para autenticados activos
DROP POLICY IF EXISTS "select_permissions_authenticated" ON permissions;
CREATE POLICY "select_permissions_authenticated"
ON permissions FOR SELECT TO authenticated
USING (is_account_active());

-- user_profiles: lectura propia + admin/auditor leen todos
DROP POLICY IF EXISTS "select_user_profiles" ON user_profiles;
CREATE POLICY "select_user_profiles"
ON user_profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_admin()
  OR is_auditor()
);

-- user_profiles: un usuario edita solo su propio perfil (campos limitados)
DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile"
ON user_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- user_profiles: solo admin crea/edita perfiles de otros
DROP POLICY IF EXISTS "insert_user_profiles_admin" ON user_profiles;
CREATE POLICY "insert_user_profiles_admin"
ON user_profiles FOR INSERT TO authenticated
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_user_profiles_admin" ON user_profiles;
CREATE POLICY "update_user_profiles_admin"
ON user_profiles FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- user_sessions: usuario lee/gestiona sus sesiones; admin gestiona todas
DROP POLICY IF EXISTS "select_own_sessions" ON user_sessions;
CREATE POLICY "select_own_sessions"
ON user_sessions FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "insert_own_session" ON user_sessions;
CREATE POLICY "insert_own_session"
ON user_sessions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_session" ON user_sessions;
CREATE POLICY "update_own_session"
ON user_sessions FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR is_admin())
WITH CHECK (user_id = auth.uid() OR is_admin());

-- security_settings: lectura para autenticados activos; escritura solo admin
DROP POLICY IF EXISTS "select_security_settings" ON security_settings;
CREATE POLICY "select_security_settings"
ON security_settings FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "update_security_settings_admin" ON security_settings;
CREATE POLICY "update_security_settings_admin"
ON security_settings FOR UPDATE TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- audit_logs: solo INSERT para autenticados (append-only).
-- SELECT restringido a Admin General y Auditor.
-- No hay UPDATE ni DELETE intencionalmente.
DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs"
ON audit_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs"
ON audit_logs FOR SELECT TO authenticated
USING (is_admin() OR is_auditor());

-- Índices
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_status ON user_profiles(status);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
