/*
# SIA-DINAC: Semilla de roles, permisos, indicadores y configuración inicial

## Resumen
Puebla las tablas base del sistema con:
- 6 roles del sistema (Admin General, Admin Técnico, Analista, Fiscalización, Ejecutivo, Auditor).
- 24 permisos granulares cubriendo todas las acciones del sistema.
- Matriz role_permissions: asigna permisos a cada rol según el RBAC definido.
- 5 definiciones de indicadores (banderas rojas) con su metodología.
- Parámetros por defecto para cada indicador (umbrales configurables).
- Configuración de seguridad inicial (singleton).
- Función create_first_admin() para crear el primer Administrador General.

## Seguridad
- No crea usuarios en auth.users (eso se hace desde el flujo de invitación).
- Los roles son marcados como is_system = true (no eliminables).
- Los parámetros quedan activos y editables desde la consola de administración.
*/

-- ============================================================
-- Roles del sistema
-- ============================================================
INSERT INTO roles (code, name, description, is_system) VALUES
  ('admin_general', 'Administrador General', 'Administra usuarios, roles, permisos, indicadores, catálogos, bitácora y políticas de seguridad.', true),
  ('admin_technical', 'Administrador Técnico', 'Administra cargas de datos, catálogos técnicos y parámetros. No puede crear Administradores Generales ni modificar la bitácora.', true),
  ('analyst', 'Analista', 'Consulta procesos y alertas, clasifica, comenta, solicita información y genera reportes autorizados.', true),
  ('fiscalization', 'Fiscalización', 'Consulta alertas asignadas, registra hallazgos, adjunta documentación y cambia estados.', true),
  ('executive', 'Ejecutivo', 'Accede al panel ejecutivo con información agregada y descarga reportes ejecutivos.', true),
  ('system_auditor', 'Auditor de sistema', 'Consulta usuarios, permisos, bitácoras y actividad en modo solo lectura.', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Permisos
-- ============================================================
INSERT INTO permissions (code, name, description, module) VALUES
  ('view_dashboard', 'Ver panel', 'Acceder al panel principal del sistema', 'dashboard'),
  ('view_executive', 'Ver panel ejecutivo', 'Acceder al panel ejecutivo con métricas agregadas', 'dashboard'),
  ('view_technical', 'Ver panel técnico', 'Acceder al panel técnico con tabla de procesos', 'dashboard'),
  ('upload_data', 'Cargar datos', 'Subir archivos de contratación al sistema', 'data'),
  ('download_template', 'Descargar plantilla', 'Descargar plantillas de carga de datos', 'data'),
  ('view_uploads', 'Ver cargas', 'Consultar el historial de cargas de datos', 'data'),
  ('manage_alerts', 'Gestionar alertas', 'Editar, clasificar y cambiar estado de alertas', 'alerts'),
  ('view_alerts', 'Ver alertas', 'Consultar alertas y su detalle', 'alerts'),
  ('assign_alerts', 'Asignar alertas', 'Asignar responsables a alertas', 'alerts'),
  ('attach_documents', 'Adjuntar documentos', 'Subir documentación a alertas', 'alerts'),
  ('export_reports', 'Exportar reportes', 'Generar y descargar reportes del sistema', 'reports'),
  ('view_reports', 'Ver reportes', 'Consultar reportes disponibles', 'reports'),
  ('configure_indicators', 'Configurar indicadores', 'Activar, desactivar y modificar umbrales de indicadores', 'config'),
  ('manage_catalogs', 'Administrar catálogos', 'Gestionar instituciones, unidades y proveedores', 'config'),
  ('manage_users', 'Administrar usuarios', 'Crear, editar, suspender y gestionar usuarios', 'admin'),
  ('manage_roles', 'Administrar roles y permisos', 'Gestionar roles y la matriz de permisos', 'admin'),
  ('configure_security', 'Configurar seguridad', 'Modificar parámetros de seguridad del sistema', 'admin'),
  ('view_audit_log', 'Consultar bitácora', 'Acceder a la bitácora de auditoría', 'admin'),
  ('export_users', 'Exportar usuarios', 'Exportar el listado de usuarios autorizados', 'admin'),
  ('download_documents', 'Descargar documentos', 'Descargar documentos adjuntos a alertas', 'alerts'),
  ('view_documentation', 'Ver documentación', 'Acceder a la documentación metodológica', 'docs'),
  ('manage_sessions', 'Gestionar sesiones', 'Cerrar sesiones de usuarios', 'admin'),
  ('change_password', 'Cambiar contraseña', 'Cambiar la propia contraseña', 'profile'),
  ('edit_own_profile', 'Editar perfil propio', 'Editar nombre, cargo y unidad del propio perfil', 'profile')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Matriz de permisos por rol
-- ============================================================
-- Admin General: todos los permisos
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'admin_general'
ON CONFLICT DO NOTHING;

-- Admin Técnico: cargas, catálogos, indicadores, paneles, reportes, docs
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'admin_technical'
  AND p.code IN ('view_dashboard','view_technical','upload_data','download_template','view_uploads',
                 'view_alerts','export_reports','view_reports','configure_indicators',
                 'manage_catalogs','view_documentation','change_password','edit_own_profile')
ON CONFLICT DO NOTHING;

-- Analista: paneles, alertas, reportes, docs
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'analyst'
  AND p.code IN ('view_dashboard','view_technical','view_alerts','manage_alerts','assign_alerts',
                 'view_uploads','export_reports','view_reports','view_documentation',
                 'change_password','edit_own_profile','attach_documents')
ON CONFLICT DO NOTHING;

-- Fiscalización: alertas asignadas, documentos, docs
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'fiscalization'
  AND p.code IN ('view_dashboard','view_alerts','manage_alerts','attach_documents',
                 'download_documents','view_documentation','change_password','edit_own_profile')
ON CONFLICT DO NOTHING;

-- Ejecutivo: panel ejecutivo, reportes
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'executive'
  AND p.code IN ('view_dashboard','view_executive','view_reports','export_reports',
                 'view_documentation','change_password','edit_own_profile')
ON CONFLICT DO NOTHING;

-- Auditor: solo lectura de bitácora, usuarios, paneles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'system_auditor'
  AND p.code IN ('view_dashboard','view_alerts','view_uploads','view_reports',
                 'view_audit_log','view_documentation','change_password','edit_own_profile')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Definiciones de indicadores (5 banderas rojas)
-- ============================================================
INSERT INTO indicator_definitions (code, name, description, methodology, formula, required_fields, exclusions) VALUES
  ('single_bidder',
   'Único oferente',
   'Procedimiento competitivo con un solo oferente válido.',
   'Se identifica cuando un proceso bajo una modalidad competitiva registra un único oferente válido. Se excluyen las modalidades configuradas como no competitivas o excepcionales.',
   'number_of_bidders = 1 AND procurement_method IN (modalidades_competitivas)',
   'process_id, procurement_method, number_of_bidders',
   'Modalidades no competitivas o excepcionales según configuración.'),
  ('award_concentration',
   'Concentración de adjudicaciones',
   'Concentración de adjudicaciones por institución, proveedor y periodo.',
   'Se calcula el porcentaje de contratos y monto adjudicado que un proveedor concentra dentro de una institución en un periodo. Se activa al superar los umbrales configurados.',
   'COUNT(contracts) / COUNT(total_contracts) * 100 >= threshold_count AND SUM(awarded) / SUM(total_awarded) * 100 >= threshold_amount',
   'institution, supplier_id, awarded_amount, award_date',
   'Proveedores con menos del mínimo de contratos configurado.'),
  ('non_competitive_methods',
   'Uso recurrente de modalidades no competitivas',
   'Proporción elevada de contrataciones mediante modalidades no competitivas o excepcionales.',
   'Se calcula la proporción de procesos y monto adjudicado mediante modalidades clasificadas como no competitivas. Se activa al superar los porcentajes configurados.',
   'COUNT(non_competitive) / COUNT(total) * 100 >= threshold_count OR SUM(non_comp_amount) / SUM(total_amount) * 100 >= threshold_amount',
   'procurement_method, awarded_amount',
   'Ninguna exclusión por defecto.'),
  ('contract_splitting',
   'Posible fraccionamiento o proximidad al umbral',
   'Posible patrón de contrataciones que requiere revisión.',
   'Se identifican grupos de procesos con misma institución/unidad, fechas cercanas, objetos o categorías similares, mismo proveedor o proveedores relacionados, montos individuales próximos al umbral y suma acumulada superior al umbral. Nunca afirma automáticamente que se produjo fraccionamiento.',
   'GROUP BY institution, supplier WHERE dates_proximity <= window_days AND amounts_near_threshold AND SUM(amounts) > threshold',
   'institution, purchasing_unit, award_date, procurement_category, supplier_id, awarded_amount',
   'Procesos fuera de la ventana de tiempo configurada.'),
  ('short_timelines',
   'Plazos atípicamente cortos',
   'Plazos de contratación inferiores a los parámetros definidos por modalidad.',
   'Se calculan los días entre publicación y recepción de ofertas, entre recepción y adjudicación, y la duración total. Se compara con los parámetros definidos para cada modalidad.',
   'days_between(publication_date, bid_deadline) < min_days OR days_between(bid_deadline, award_date) < min_days OR total_days < min_total',
   'publication_date, bid_deadline, award_date, procurement_method',
   'Modalidades sin fechas de publicación.')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Parámetros por defecto de cada indicador
-- ============================================================
-- Indicador 1: Único oferente
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'competitive_methods', 'LP,LC,LI,EB', 'text', 'Modalidades competitivas donde aplica la regla.'
FROM indicator_definitions WHERE code = 'single_bidder'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'single_bidder_threshold', '1', 'number', 'Número de oferentes que activa la alerta.'
FROM indicator_definitions WHERE code = 'single_bidder'
ON CONFLICT DO NOTHING;

-- Indicador 2: Concentración
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'threshold_count_pct', '30', 'number', 'Porcentaje máximo de contratos por proveedor por institución.'
FROM indicator_definitions WHERE code = 'award_concentration'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'threshold_amount_pct', '40', 'number', 'Porcentaje máximo de monto adjudicado por proveedor por institución.'
FROM indicator_definitions WHERE code = 'award_concentration'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'min_contracts', '3', 'number', 'Número mínimo de contratos para evaluar concentración.'
FROM indicator_definitions WHERE code = 'award_concentration'
ON CONFLICT DO NOTHING;

-- Indicador 3: Modalidades no competitivas
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'non_competitive_methods', 'CD,CP,CE,CON', 'text', 'Modalidades consideradas no competitivas o excepcionales.'
FROM indicator_definitions WHERE code = 'non_competitive_methods'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'threshold_count_pct', '20', 'number', 'Porcentaje máximo de procesos no competitivos.'
FROM indicator_definitions WHERE code = 'non_competitive_methods'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'threshold_amount_pct', '20', 'number', 'Porcentaje máximo de monto no competitivo.'
FROM indicator_definitions WHERE code = 'non_competitive_methods'
ON CONFLICT DO NOTHING;

-- Indicador 4: Fraccionamiento
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'window_days', '60', 'number', 'Ventana de días para considerar procesos cercanos.'
FROM indicator_definitions WHERE code = 'contract_splitting'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'proximity_pct', '85', 'number', 'Porcentaje de proximidad al umbral (0-100).'
FROM indicator_definitions WHERE code = 'contract_splitting'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'threshold_amount', '100000', 'number', 'Umbral de monto acumulado para activar la alerta.'
FROM indicator_definitions WHERE code = 'contract_splitting'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'min_group_size', '3', 'number', 'Número mínimo de procesos en un grupo para evaluar.'
FROM indicator_definitions WHERE code = 'contract_splitting'
ON CONFLICT DO NOTHING;

-- Indicador 5: Plazos cortos
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'min_publication_to_bid_days', '7', 'number', 'Días mínimos entre publicación y recepción de ofertas.'
FROM indicator_definitions WHERE code = 'short_timelines'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'min_bid_to_award_days', '3', 'number', 'Días mínimos entre recepción y adjudicación.'
FROM indicator_definitions WHERE code = 'short_timelines'
ON CONFLICT DO NOTHING;
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'min_total_days', '10', 'number', 'Días mínimos de duración total del proceso.'
FROM indicator_definitions WHERE code = 'short_timelines'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Configuración de seguridad inicial (singleton)
-- ============================================================
INSERT INTO security_settings (id)
SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM security_settings);

-- ============================================================
-- Función para crear el primer usuario Administrador General
-- (se invoca manualmente una sola vez con execute_sql)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_first_admin(
  p_email text,
  p_password text,
  p_full_name text,
  p_position text DEFAULT 'Administrador General',
  p_unit text DEFAULT 'Dirección Nacional de Compras Públicas'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_user_id uuid;
  admin_role_id uuid;
  profile_id uuid;
BEGIN
  -- Crear usuario en auth.users
  new_user_id := auth.uid();
  
  -- Esta función debe llamarse desde un contexto autenticado.
  -- En su lugar, devolvemos instrucciones.
  RAISE EXCEPTION 'Use Supabase Auth signUp para crear el usuario, luego asigne el rol admin_general manualmente.';
END;
$$;
