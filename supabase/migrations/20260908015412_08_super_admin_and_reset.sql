-- ============================================================
-- Migration 08: Add database reset permission and super_admin role
-- ============================================================

-- 1. Add new permission for database reset
INSERT INTO permissions (code, name, module, description)
VALUES ('reset_database', 'Resetear base de datos', 'admin', 'Permite eliminar todos los datos de procesos, alertas y cargas para iniciar un análisis desde cero. Conserva usuarios, roles, permisos y catálogos.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- 2. Create super_admin role
INSERT INTO roles (code, name, description, is_system, is_active)
VALUES (
  'super_admin',
  'Super Administrador',
  'Acceso total al sistema incluyendo reseteo de base de datos, gestión de usuarios, roles, permisos, bitácora, catálogos, indicadores y seguridad.',
  true,
  true
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = true;

-- 3. Grant ALL permissions to super_admin role
DO $$
DECLARE
  r_id uuid;
  p_id uuid;
BEGIN
  SELECT id INTO r_id FROM roles WHERE code = 'super_admin';
  FOR p_id IN SELECT id FROM permissions LOOP
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (r_id, p_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END LOOP;
END $$;

-- 4. Grant reset_database permission to admin_general as well
DO $$
DECLARE
  r_id uuid;
  p_id uuid;
BEGIN
  SELECT id INTO r_id FROM roles WHERE code = 'admin_general';
  SELECT id INTO p_id FROM permissions WHERE code = 'reset_database';
  IF r_id IS NOT NULL AND p_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES (r_id, p_id)
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;
