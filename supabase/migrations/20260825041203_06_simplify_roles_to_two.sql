-- Deactivate roles that are no longer needed; keep only admin_general and fiscalization
UPDATE roles SET is_active = false
WHERE code IN ('admin_technical', 'analyst', 'executive', 'system_auditor');

-- Reassign any users with inactive roles to fiscalization
UPDATE user_profiles
SET role_id = (SELECT id FROM roles WHERE code = 'fiscalization' LIMIT 1)
WHERE role_id IN (SELECT id FROM roles WHERE code IN ('admin_technical', 'analyst', 'executive', 'system_auditor'));

-- Update descriptions to match the simplified model
UPDATE roles SET description = 'Administra usuarios, roles, permisos, indicadores, catálogos, bitácora y políticas de seguridad.'
WHERE code = 'admin_general';

UPDATE roles SET description = 'Consulta alertas asignadas, registra hallazgos, adjunta documentación y cambia estados.'
WHERE code = 'fiscalization';
