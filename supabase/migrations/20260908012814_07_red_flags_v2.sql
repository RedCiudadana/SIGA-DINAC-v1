-- ============================================================
-- Migration 07: Five Red Flags (R018, R003, R063, R013, R040)
-- Adds V2 columns, procurement method catalog, contract status catalog
-- Updates indicator definitions to R-codes with new parameters
-- ============================================================

-- ============================================================
-- 1. Add V2 columns to procurement_processes
-- ============================================================
ALTER TABLE procurement_processes
  ADD COLUMN IF NOT EXISTS institution_code text,
  ADD COLUMN IF NOT EXISTS number_of_valid_bids integer,
  ADD COLUMN IF NOT EXISTS contract_document_published boolean,
  ADD COLUMN IF NOT EXISTS contract_document_type text,
  ADD COLUMN IF NOT EXISTS contract_document_url text,
  ADD COLUMN IF NOT EXISTS contract_document_publication_date date;

-- ============================================================
-- 2. Procurement method catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS procurement_method_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  classification text NOT NULL DEFAULT 'competitive',
  is_competitive boolean NOT NULL DEFAULT true,
  minimum_bid_period_days integer NOT NULL DEFAULT 7,
  count_for_r013 boolean NOT NULL DEFAULT true,
  minimum_valid_bids_reference integer NOT NULL DEFAULT 2,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE procurement_method_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_methods_all" ON procurement_method_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_methods_admin" ON procurement_method_catalog FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_methods_admin" ON procurement_method_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_methods_admin" ON procurement_method_catalog FOR DELETE TO authenticated USING (true);

-- Seed default methods (DINAC can edit later)
INSERT INTO procurement_method_catalog (code, name, classification, is_competitive, minimum_bid_period_days, count_for_r013, minimum_valid_bids_reference, notes) VALUES
  ('LP', 'Licitación Pública', 'competitive', true, 10, true, 2, 'Licitación pública nacional o internacional'),
  ('LC', 'Licitación por Catálogo', 'competitive', true, 7, true, 2, 'Licitación por catálogo electrónico'),
  ('LI', 'Licitación Internacional', 'competitive', true, 15, true, 2, 'Licitación pública internacional'),
  ('EB', 'Express Buy', 'competitive', true, 5, true, 2, 'Compra express'),
  ('CP', 'Compra Pública', 'comparison', true, 5, true, 2, 'Compra por comparación de precios'),
  ('CD', 'Contratación Directa', 'non_competitive', false, 0, true, 0, 'Contratación directa sin competencia'),
  ('CE', 'Contratación de Emergencia', 'non_competitive', false, 0, true, 0, 'Contratación de emergencia o excepción'),
  ('CON', 'Convenio', 'non_competitive', false, 0, true, 0, 'Convenio interinstitucional')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  classification = EXCLUDED.classification,
  is_competitive = EXCLUDED.is_competitive,
  minimum_bid_period_days = EXCLUDED.minimum_bid_period_days,
  count_for_r013 = EXCLUDED.count_for_r013,
  minimum_valid_bids_reference = EXCLUDED.minimum_valid_bids_reference,
  notes = EXCLUDED.notes;

-- ============================================================
-- 3. Contract status catalog
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_status_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_value text NOT NULL UNIQUE,
  normalized_value text NOT NULL,
  evaluate_r063 boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contract_status_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_status_all" ON contract_status_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_status_admin" ON contract_status_catalog FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_status_admin" ON contract_status_catalog FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_status_admin" ON contract_status_catalog FOR DELETE TO authenticated USING (true);

-- Seed default status mappings
INSERT INTO contract_status_catalog (source_value, normalized_value, evaluate_r063) VALUES
  ('adjudicado', 'awarded', true),
  ('contratado', 'contracted', true),
  ('vigente', 'active', true),
  ('en ejecucion', 'active', true),
  ('en_ejecucion', 'active', true),
  ('ejecutado', 'completed', true),
  ('finalizado', 'completed', true),
  ('suspendido', 'suspended', false),
  ('cancelado', 'cancelled', false),
  ('anulado', 'cancelled', false),
  ('desierto', 'void', false),
  ('active', 'active', true),
  ('awarded', 'awarded', true),
  ('contracted', 'contracted', true),
  ('completed', 'completed', true)
ON CONFLICT (source_value) DO UPDATE SET
  normalized_value = EXCLUDED.normalized_value,
  evaluate_r063 = EXCLUDED.evaluate_r063;

-- ============================================================
-- 4. Update indicator_definitions to R-codes
-- ============================================================
UPDATE indicator_definitions SET code = 'R018', name = 'R018 — Oferta única', description = 'Procedimiento competitivo con una sola oferta válida.' WHERE code = 'single_bidder';
UPDATE indicator_definitions SET code = 'R003', name = 'R003 — Plazo corto para presentar ofertas', description = 'El plazo entre publicación y recepción de ofertas es inferior al parámetro configurado para el método.' WHERE code = 'short_timelines';
UPDATE indicator_definitions SET code = 'R063', name = 'R063 — Contrato o documento contractual no publicado', description = 'Existe adjudicación pero no se registró documento contractual publicado, transcurrido el período de gracia.' WHERE code = 'contract_splitting';
UPDATE indicator_definitions SET code = 'R013', name = 'R013 — Alto uso de métodos no competitivos', description = 'Proporción elevada de procesos no competitivos en una institución, sobre el total de procesos elegibles.' WHERE code = 'non_competitive_methods';
UPDATE indicator_definitions SET code = 'R040', name = 'R040 — Alta concentración comprador–proveedor', description = 'Concentración elevada de adjudicaciones a un mismo proveedor por parte de una institución.' WHERE code = 'award_concentration';

-- ============================================================
-- 5. Replace indicator parameters with R-flag parameters
-- ============================================================
-- R018: Oferta única
DELETE FROM indicator_parameters WHERE indicator_id = (SELECT id FROM indicator_definitions WHERE code = 'R018');
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description, version, is_active) VALUES
  ((SELECT id FROM indicator_definitions WHERE code = 'R018'), 'use_valid_bids', 'true', 'boolean', 'Usar number_of_valid_bids cuando esté disponible; fallback a number_of_bidders', 1, true);

-- R003: Plazo corto (uses method catalog, no hardcoded thresholds)
DELETE FROM indicator_parameters WHERE indicator_id = (SELECT id FROM indicator_definitions WHERE code = 'R003');
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description, version, is_active) VALUES
  ((SELECT id FROM indicator_definitions WHERE code = 'R003'), 'use_method_catalog', 'true', 'boolean', 'Usar minimum_bid_period_days del catálogo de métodos', 1, true);

-- R063: Contrato no publicado
DELETE FROM indicator_parameters WHERE indicator_id = (SELECT id FROM indicator_definitions WHERE code = 'R063');
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description, version, is_active) VALUES
  ((SELECT id FROM indicator_definitions WHERE code = 'R063'), 'grace_period_days', '5', 'number', 'Días de gracia después de award_date antes de evaluar', 1, true);

-- R013: Uso de métodos no competitivos
DELETE FROM indicator_parameters WHERE indicator_id = (SELECT id FROM indicator_definitions WHERE code = 'R013');
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description, version, is_active) VALUES
  ((SELECT id FROM indicator_definitions WHERE code = 'R013'), 'threshold_pct', '35', 'number', 'Porcentaje máximo de procesos no competitivos permitidos', 1, true),
  ((SELECT id FROM indicator_definitions WHERE code = 'R013'), 'min_processes', '10', 'number', 'Número mínimo de procesos elegibles para evaluar', 1, true);

-- R040: Concentración comprador-proveedor
DELETE FROM indicator_parameters WHERE indicator_id = (SELECT id FROM indicator_definitions WHERE code = 'R040');
INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description, version, is_active) VALUES
  ((SELECT id FROM indicator_definitions WHERE code = 'R040'), 'share_count_threshold', '45', 'number', 'Porcentaje de adjudicaciones a un mismo proveedor (por cantidad)', 1, true),
  ((SELECT id FROM indicator_definitions WHERE code = 'R040'), 'share_amount_threshold', '55', 'number', 'Porcentaje de adjudicaciones a un mismo proveedor (por monto)', 1, true),
  ((SELECT id FROM indicator_definitions WHERE code = 'R040'), 'min_awards', '10', 'number', 'Número mínimo de adjudicaciones para evaluar', 1, true);

-- ============================================================
-- 6. Add alert_level to alerts table (process, institution, buyer_supplier)
-- ============================================================
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS alert_level text DEFAULT 'process',
  ADD COLUMN IF NOT EXISTS quality_note text;

-- ============================================================
-- 7. Add confidentiality_level to procurement_processes (inherits from upload)
-- ============================================================
ALTER TABLE procurement_processes
  ADD COLUMN IF NOT EXISTS confidentiality_level text DEFAULT 'internal';
