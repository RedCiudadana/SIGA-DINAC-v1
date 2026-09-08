/*
# SIA-DINAC: Datos de contratación e indicadores

## Resumen
Crea las tablas del dominio de contratación pública: instituciones, unidades
organizativas, proveedores, procesos de contratación, items, cargas de datos,
problemas de calidad, definiciones y versiones de indicadores, parámetros,
alertas, relación alerta-proceso, asignaciones, comentarios, documentos,
historial de estados e historial de cargas.

## Tablas nuevas
- institutions, organizational_units, suppliers
- data_uploads, data_quality_issues
- procurement_processes, procurement_items (via processes)
- indicator_definitions, indicator_parameters, indicator_versions, indicator_config_history
- alerts, alert_processes, alert_assignments, alert_comments, alert_documents, alert_status_history

## Seguridad
- RLS habilitado en todas las tablas.
- Lectura para usuarios autenticados con cuenta activa.
- Escritura/eliminación restringida por permisos.
- Eliminación lógica en alertas, comentarios y documentos.
*/

-- ============================================================
-- Institutions
-- ============================================================
CREATE TABLE IF NOT EXISTS institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  type text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Organizational Units
-- ============================================================
CREATE TABLE IF NOT EXISTS organizational_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (institution_id, code)
);
ALTER TABLE organizational_units ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id text UNIQUE NOT NULL,
  name text NOT NULL,
  legal_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Data Uploads (lotes de carga) — antes que processes
-- ============================================================
CREATE TABLE IF NOT EXISTS data_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  period text NOT NULL,
  source text,
  institution_scope text,
  description text,
  confidentiality_level text NOT NULL DEFAULT 'internal',
  file_name text NOT NULL,
  file_size bigint,
  file_type text,
  storage_path text,
  total_records integer NOT NULL DEFAULT 0,
  valid_records integer NOT NULL DEFAULT 0,
  warning_records integer NOT NULL DEFAULT 0,
  rejected_records integer NOT NULL DEFAULT 0,
  alerts_generated integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','validating','preview','processing','completed','failed','cancelled')),
  processing_progress integer NOT NULL DEFAULT 0,
  processed_by uuid,
  processed_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE data_uploads ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Data Quality Issues
-- ============================================================
CREATE TABLE IF NOT EXISTS data_quality_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES data_uploads(id) ON DELETE CASCADE,
  row_number integer,
  column_name text,
  issue_type text NOT NULL CHECK (issue_type IN ('error','warning','missing','duplicate')),
  message text,
  value text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE data_quality_issues ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Procurement Processes
-- ============================================================
CREATE TABLE IF NOT EXISTS procurement_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id text NOT NULL,
  upload_id uuid REFERENCES data_uploads(id) ON DELETE SET NULL,
  institution_id uuid REFERENCES institutions(id),
  institution_name text,
  purchasing_unit text,
  unit_id uuid REFERENCES organizational_units(id),
  procurement_method text,
  procurement_category text,
  procurement_description text,
  publication_date date,
  bid_deadline date,
  award_date date,
  supplier_id_code text,
  supplier_name text,
  supplier_id uuid REFERENCES suppliers(id),
  number_of_bidders integer,
  estimated_amount numeric(18,2),
  awarded_amount numeric(18,2),
  currency text NOT NULL DEFAULT 'USD',
  contract_status text,
  item_code text,
  item_description text,
  contract_start_date date,
  contract_end_date date,
  amendment_amount numeric(18,2),
  final_executed_amount numeric(18,2),
  data_source text,
  source_url text,
  alert_count integer NOT NULL DEFAULT 0,
  priority text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  is_demo boolean NOT NULL DEFAULT false
);
ALTER TABLE procurement_processes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Indicator Definitions
-- ============================================================
CREATE TABLE IF NOT EXISTS indicator_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  methodology text,
  formula text,
  required_fields text,
  exclusions text,
  is_active boolean NOT NULL DEFAULT true,
  current_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE indicator_definitions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Indicator Parameters
-- ============================================================
CREATE TABLE IF NOT EXISTS indicator_parameters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES indicator_definitions(id) ON DELETE CASCADE,
  param_key text NOT NULL,
  param_value text NOT NULL,
  param_type text NOT NULL DEFAULT 'number' CHECK (param_type IN ('number','text','json','boolean')),
  description text,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (indicator_id, param_key, version)
);
ALTER TABLE indicator_parameters ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Indicator Versions
-- ============================================================
CREATE TABLE IF NOT EXISTS indicator_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES indicator_definitions(id) ON DELETE CASCADE,
  version integer NOT NULL,
  parameters_snapshot jsonb NOT NULL,
  change_description text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (indicator_id, version)
);
ALTER TABLE indicator_versions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Indicator Config History
-- ============================================================
CREATE TABLE IF NOT EXISTS indicator_config_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES indicator_definitions(id) ON DELETE CASCADE,
  action text NOT NULL,
  field_changed text,
  old_value text,
  new_value text,
  version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  user_email text
);
ALTER TABLE indicator_config_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Alerts
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_code text UNIQUE NOT NULL,
  indicator_id uuid NOT NULL REFERENCES indicator_definitions(id),
  indicator_code text NOT NULL,
  upload_id uuid REFERENCES data_uploads(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  calculation_detail text,
  threshold_applied text,
  data_used jsonb,
  priority text NOT NULL DEFAULT 'low' CHECK (priority IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','assigned','in_review','requires_info','referred','discarded','closed')),
  assigned_to uuid,
  assigned_at timestamptz,
  conclusion text,
  is_deleted boolean NOT NULL DEFAULT false,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Alert-Process relationship
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES procurement_processes(id) ON DELETE CASCADE,
  role_in_alert text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alert_id, process_id)
);
ALTER TABLE alert_processes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Alert Assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE alert_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Alert Comments (eliminación lógica)
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  comment text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  user_name text
);
ALTER TABLE alert_comments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Alert Documents
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size bigint,
  file_type text,
  storage_path text NOT NULL,
  description text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  user_name text
);
ALTER TABLE alert_documents ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Alert Status History
-- ============================================================
CREATE TABLE IF NOT EXISTS alert_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid,
  user_name text
);
ALTER TABLE alert_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Funciones auxiliares
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_perform(p_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_account_active() AND has_permission(p_code);
$$;

-- ============================================================
-- Políticas RLS
-- ============================================================

-- Institutions
DROP POLICY IF EXISTS "select_institutions" ON institutions;
CREATE POLICY "select_institutions"
ON institutions FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "manage_institutions" ON institutions;
CREATE POLICY "manage_institutions"
ON institutions FOR ALL TO authenticated
USING (can_perform('manage_catalogs'))
WITH CHECK (can_perform('manage_catalogs'));

-- Organizational Units
DROP POLICY IF EXISTS "select_org_units" ON organizational_units;
CREATE POLICY "select_org_units"
ON organizational_units FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "manage_org_units" ON organizational_units;
CREATE POLICY "manage_org_units"
ON organizational_units FOR ALL TO authenticated
USING (can_perform('manage_catalogs'))
WITH CHECK (can_perform('manage_catalogs'));

-- Suppliers
DROP POLICY IF EXISTS "select_suppliers" ON suppliers;
CREATE POLICY "select_suppliers"
ON suppliers FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "manage_suppliers" ON suppliers;
CREATE POLICY "manage_suppliers"
ON suppliers FOR ALL TO authenticated
USING (can_perform('manage_catalogs'))
WITH CHECK (can_perform('manage_catalogs'));

-- Data Uploads
DROP POLICY IF EXISTS "select_uploads" ON data_uploads;
CREATE POLICY "select_uploads"
ON data_uploads FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "insert_uploads" ON data_uploads;
CREATE POLICY "insert_uploads"
ON data_uploads FOR INSERT TO authenticated
WITH CHECK (can_perform('upload_data'));

DROP POLICY IF EXISTS "update_uploads" ON data_uploads;
CREATE POLICY "update_uploads"
ON data_uploads FOR UPDATE TO authenticated
USING (can_perform('upload_data') OR is_admin())
WITH CHECK (can_perform('upload_data') OR is_admin());

DROP POLICY IF EXISTS "delete_uploads" ON data_uploads;
CREATE POLICY "delete_uploads"
ON data_uploads FOR DELETE TO authenticated
USING (is_admin());

-- Data Quality Issues
DROP POLICY IF EXISTS "select_quality_issues" ON data_quality_issues;
CREATE POLICY "select_quality_issues"
ON data_quality_issues FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "insert_quality_issues" ON data_quality_issues;
CREATE POLICY "insert_quality_issues"
ON data_quality_issues FOR INSERT TO authenticated
WITH CHECK (can_perform('upload_data'));

DROP POLICY IF EXISTS "delete_quality_issues" ON data_quality_issues;
CREATE POLICY "delete_quality_issues"
ON data_quality_issues FOR DELETE TO authenticated
USING (can_perform('upload_data'));

-- Procurement Processes
DROP POLICY IF EXISTS "select_processes" ON procurement_processes;
CREATE POLICY "select_processes"
ON procurement_processes FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "insert_processes" ON procurement_processes;
CREATE POLICY "insert_processes"
ON procurement_processes FOR INSERT TO authenticated
WITH CHECK (can_perform('upload_data'));

DROP POLICY IF EXISTS "update_processes" ON procurement_processes;
CREATE POLICY "update_processes"
ON procurement_processes FOR UPDATE TO authenticated
USING (can_perform('upload_data') OR can_perform('manage_alerts'))
WITH CHECK (can_perform('upload_data') OR can_perform('manage_alerts'));

DROP POLICY IF EXISTS "delete_processes" ON procurement_processes;
CREATE POLICY "delete_processes"
ON procurement_processes FOR DELETE TO authenticated
USING (is_admin());

-- Indicator Definitions
DROP POLICY IF EXISTS "select_indicators" ON indicator_definitions;
CREATE POLICY "select_indicators"
ON indicator_definitions FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "manage_indicators" ON indicator_definitions;
CREATE POLICY "manage_indicators"
ON indicator_definitions FOR ALL TO authenticated
USING (can_perform('configure_indicators'))
WITH CHECK (can_perform('configure_indicators'));

-- Indicator Parameters
DROP POLICY IF EXISTS "select_indicator_params" ON indicator_parameters;
CREATE POLICY "select_indicator_params"
ON indicator_parameters FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "manage_indicator_params" ON indicator_parameters;
CREATE POLICY "manage_indicator_params"
ON indicator_parameters FOR ALL TO authenticated
USING (can_perform('configure_indicators'))
WITH CHECK (can_perform('configure_indicators'));

-- Indicator Versions
DROP POLICY IF EXISTS "select_indicator_versions" ON indicator_versions;
CREATE POLICY "select_indicator_versions"
ON indicator_versions FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "manage_indicator_versions" ON indicator_versions;
CREATE POLICY "manage_indicator_versions"
ON indicator_versions FOR ALL TO authenticated
USING (can_perform('configure_indicators'))
WITH CHECK (can_perform('configure_indicators'));

-- Indicator Config History
DROP POLICY IF EXISTS "select_indicator_history" ON indicator_config_history;
CREATE POLICY "select_indicator_history"
ON indicator_config_history FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "insert_indicator_history" ON indicator_config_history;
CREATE POLICY "insert_indicator_history"
ON indicator_config_history FOR INSERT TO authenticated
WITH CHECK (can_perform('configure_indicators'));

-- Alerts
DROP POLICY IF EXISTS "select_alerts" ON alerts;
CREATE POLICY "select_alerts"
ON alerts FOR SELECT TO authenticated
USING (is_account_active() AND is_deleted = false);

DROP POLICY IF EXISTS "insert_alerts" ON alerts;
CREATE POLICY "insert_alerts"
ON alerts FOR INSERT TO authenticated
WITH CHECK (can_perform('upload_data') OR is_admin());

DROP POLICY IF EXISTS "update_alerts" ON alerts;
CREATE POLICY "update_alerts"
ON alerts FOR UPDATE TO authenticated
USING (is_account_active())
WITH CHECK (is_account_active());

DROP POLICY IF EXISTS "delete_alerts" ON alerts;
CREATE POLICY "delete_alerts"
ON alerts FOR DELETE TO authenticated
USING (is_admin());

-- Alert Processes
DROP POLICY IF EXISTS "select_alert_processes" ON alert_processes;
CREATE POLICY "select_alert_processes"
ON alert_processes FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "insert_alert_processes" ON alert_processes;
CREATE POLICY "insert_alert_processes"
ON alert_processes FOR INSERT TO authenticated
WITH CHECK (can_perform('upload_data') OR is_admin());

DROP POLICY IF EXISTS "delete_alert_processes" ON alert_processes;
CREATE POLICY "delete_alert_processes"
ON alert_processes FOR DELETE TO authenticated
USING (can_perform('upload_data') OR is_admin());

-- Alert Assignments
DROP POLICY IF EXISTS "select_alert_assignments" ON alert_assignments;
CREATE POLICY "select_alert_assignments"
ON alert_assignments FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "insert_alert_assignments" ON alert_assignments;
CREATE POLICY "insert_alert_assignments"
ON alert_assignments FOR INSERT TO authenticated
WITH CHECK (can_perform('assign_alerts') OR is_admin());

DROP POLICY IF EXISTS "delete_alert_assignments" ON alert_assignments;
CREATE POLICY "delete_alert_assignments"
ON alert_assignments FOR DELETE TO authenticated
USING (can_perform('assign_alerts') OR is_admin());

-- Alert Comments
DROP POLICY IF EXISTS "select_alert_comments" ON alert_comments;
CREATE POLICY "select_alert_comments"
ON alert_comments FOR SELECT TO authenticated
USING (is_account_active() AND is_deleted = false);

DROP POLICY IF EXISTS "insert_alert_comments" ON alert_comments;
CREATE POLICY "insert_alert_comments"
ON alert_comments FOR INSERT TO authenticated
WITH CHECK (is_account_active());

DROP POLICY IF EXISTS "delete_alert_comments" ON alert_comments;
CREATE POLICY "delete_alert_comments"
ON alert_comments FOR DELETE TO authenticated
USING (is_admin());

-- Alert Documents
DROP POLICY IF EXISTS "select_alert_documents" ON alert_documents;
CREATE POLICY "select_alert_documents"
ON alert_documents FOR SELECT TO authenticated
USING (is_account_active() AND is_deleted = false);

DROP POLICY IF EXISTS "insert_alert_documents" ON alert_documents;
CREATE POLICY "insert_alert_documents"
ON alert_documents FOR INSERT TO authenticated
WITH CHECK (can_perform('attach_documents') OR is_admin());

DROP POLICY IF EXISTS "delete_alert_documents" ON alert_documents;
CREATE POLICY "delete_alert_documents"
ON alert_documents FOR DELETE TO authenticated
USING (is_admin());

-- Alert Status History
DROP POLICY IF EXISTS "select_status_history" ON alert_status_history;
CREATE POLICY "select_status_history"
ON alert_status_history FOR SELECT TO authenticated
USING (is_account_active());

DROP POLICY IF EXISTS "insert_status_history" ON alert_status_history;
CREATE POLICY "insert_status_history"
ON alert_status_history FOR INSERT TO authenticated
WITH CHECK (is_account_active());

-- Índices
CREATE INDEX IF NOT EXISTS idx_proc_processes_upload ON procurement_processes(upload_id);
CREATE INDEX IF NOT EXISTS idx_proc_processes_process_id ON procurement_processes(process_id);
CREATE INDEX IF NOT EXISTS idx_proc_processes_institution ON procurement_processes(institution_name);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON alerts(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_indicator ON alerts(indicator_id);
CREATE INDEX IF NOT EXISTS idx_alerts_upload ON alerts(upload_id);
CREATE INDEX IF NOT EXISTS idx_alert_comments_alert ON alert_comments(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_status_hist_alert ON alert_status_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_quality_issues_upload ON data_quality_issues(upload_id);
CREATE INDEX IF NOT EXISTS idx_indicator_params_indicator ON indicator_parameters(indicator_id);
