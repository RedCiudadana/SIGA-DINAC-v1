/*
# SIA-DINAC: Datos de demostración (ficticios)

## Resumen
Puebla el sistema con datos completamente ficticios para permitir probar:
- 5 instituciones ficticias con unidades organizativas.
- 12 proveedores ficticios.
- 40 procesos de contratación que cubren los 5 indicadores:
  * Único oferente (processes con number_of_bidders = 1 en modalidades competitivas).
  * Concentración de adjudicaciones (proveedor con muchos contratos en una institución).
  * Modalidades no competitivas recurrentes.
  * Posible fraccionamiento (grupos de contratos cercanos con montos próximos al umbral).
  * Plazos atípicamente cortos.

## Importante
- Todos los datos son ficticios. No se usan nombres reales de funcionarios,
  proveedores, empresas, personas o unidades sensibles.
- Los registros se marcan con is_demo = true para separarlos de datos institucionales.
*/

-- ============================================================
-- Instituciones ficticias
-- ============================================================
INSERT INTO institutions (code, name, type, is_active) VALUES
  ('INST-001', 'Ministerio de Ficción A', 'ministerio', true),
  ('INST-002', 'Institución Autónoma B', 'autonoma', true),
  ('INST-003', 'Municipalidad Ficticia C', 'municipal', true),
  ('INST-004', 'Entidad Descentralizada D', 'descentralizada', true),
  ('INST-005', 'Secretaría Técnica E', 'secretaria', true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- Unidades organizativas ficticias
-- ============================================================
INSERT INTO organizational_units (institution_id, code, name) VALUES
  ((SELECT id FROM institutions WHERE code='INST-001'), 'UAC-01', 'Unidad de Adquisiciones Central'),
  ((SELECT id FROM institutions WHERE code='INST-001'), 'UAD-01', 'Unidad Administrativa Departamental'),
  ((SELECT id FROM institutions WHERE code='INST-002'), 'ULA-02', 'Unidad de Logística y Abastecimiento'),
  ((SELECT id FROM institutions WHERE code='INST-003'), 'UCM-03', 'Unidad de Compras Municipales'),
  ((SELECT id FROM institutions WHERE code='INST-004'), 'UPA-04', 'Unidad de Procesos Administrativos'),
  ((SELECT id FROM institutions WHERE code='INST-005'), 'UST-05', 'Unidad de Servicios Técnicos')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Proveedores ficticios
-- ============================================================
INSERT INTO suppliers (supplier_id, name, legal_id, is_active) VALUES
  ('SUP-001', 'Empresa Ficticia Alfa S.A. de C.V.', 'fak-001-100', true),
  ('SUP-002', 'Grupo Ficticio Beta Ltda.', 'fak-002-200', true),
  ('SUP-003', 'Corporación Ficticia Gamma', 'fak-003-300', true),
  ('SUP-004', 'Soluciones Ficticias Delta S.A.', 'fak-004-400', true),
  ('SUP-005', 'Servicios Ficticios Épsilon', 'fak-005-500', true),
  ('SUP-006', 'Tecnología Ficticia Zeta S.A. de C.V.', 'fak-006-600', true),
  ('SUP-007', 'Construcciones Ficticias Eta', 'fak-007-700', true),
  ('SUP-008', 'Insumos Ficticios Theta Ltda.', 'fak-008-800', true),
  ('SUP-009', 'Consultoría Ficticia Iota', 'fak-009-900', true),
  ('SUP-010', 'Distribuidora Ficticia Kappa', 'fak-010-100', true),
  ('SUP-011', 'Industria Ficticia Lambda S.A.', 'fak-011-200', true),
  ('SUP-012', 'Comercializadora Ficticia Mu', 'fak-012-300', true)
ON CONFLICT (supplier_id) DO NOTHING;

-- ============================================================
-- Procesos de contratación ficticios
-- ============================================================
-- Limpieza previa de procesos demo (en caso de re-ejecución)
DELETE FROM procurement_processes WHERE is_demo = true;

-- Lote de carga demo
INSERT INTO data_uploads (name, period, source, institution_scope, description, file_name, file_type, status, total_records, valid_records, is_demo, processed_at)
VALUES ('Carga de demostración 2024-Q1', '2024-Q1', 'Sistema ficticio de pruebas', 'Instituciones ficticias', 'Conjunto de datos ficticios para demostración del sistema.', 'demo_2024_q1.csv', 'csv', 'completed', 40, 40, true, now())
ON CONFLICT DO NOTHING;

-- Casos para Indicador 1: Único oferente en modalidades competitivas
INSERT INTO procurement_processes
  (process_id, upload_id, institution_name, purchasing_unit, procurement_method, procurement_category, procurement_description, publication_date, bid_deadline, award_date, supplier_name, supplier_id_code, number_of_bidders, estimated_amount, awarded_amount, currency, contract_status, is_demo)
VALUES
  ('PRC-2024-0001', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Ministerio de Ficción A', 'Unidad de Adquisiciones Central', 'LP', 'Bienes', 'Adquisición de equipo de cómputo ficticio', '2024-01-10', '2024-01-25', '2024-01-30', 'Empresa Ficticia Alfa S.A. de C.V.', 'SUP-001', 1, 45000.00, 43800.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0002', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Institución Autónoma B', 'Unidad de Logística y Abastecimiento', 'LC', 'Servicios', 'Servicios ficticios de limpieza institucional', '2024-02-01', '2024-02-16', '2024-02-20', 'Servicios Ficticios Épsilon', 'SUP-005', 1, 32000.00, 31000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0003', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Municipalidad Ficticia C', 'Unidad de Compras Municipales', 'LI', 'Obras', 'Reparación ficticia de infraestructura municipal', '2024-01-15', '2024-02-05', '2024-02-10', 'Construcciones Ficticias Eta', 'SUP-007', 1, 78000.00, 76500.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0004', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Ministerio de Ficción A', 'Unidad de Adquisiciones Central', 'LP', 'Bienes', 'Compra ficticia de mobiliario institucional', '2024-03-01', '2024-03-20', '2024-03-25', 'Distribuidora Ficticia Kappa', 'SUP-010', 1, 25000.00, 24500.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0005', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Entidad Descentralizada D', 'Unidad de Procesos Administrativos', 'EB', 'Servicios', 'Servicios ficticios de consultoría técnica', '2024-02-10', '2024-02-28', '2024-03-05', 'Consultoría Ficticia Iota', 'SUP-009', 1, 52000.00, 51000.00, 'USD', 'adjudicado', true);

-- Casos para Indicador 2: Concentración (SUP-001 con muchos contratos en INST-001)
INSERT INTO procurement_processes
  (process_id, upload_id, institution_name, purchasing_unit, procurement_method, procurement_category, procurement_description, publication_date, bid_deadline, award_date, supplier_name, supplier_id_code, number_of_bidders, estimated_amount, awarded_amount, currency, contract_status, is_demo)
VALUES
  ('PRC-2024-0010', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Ministerio de Ficción A', 'Unidad de Adquisiciones Central', 'LP', 'Bienes', 'Insumos ficticios de oficina lote 1', '2024-01-05', '2024-01-20', '2024-01-25', 'Empresa Ficticia Alfa S.A. de C.V.', 'SUP-001', 3, 18000.00, 17500.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0011', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Ministerio de Ficción A', 'Unidad de Adquisiciones Central', 'LC', 'Bienes', 'Insumos ficticios de oficina lote 2', '2024-01-15', '2024-01-30', '2024-02-05', 'Empresa Ficticia Alfa S.A. de C.V.', 'SUP-001', 2, 22000.00, 21000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0012', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Ministerio de Ficción A', 'Unidad de Adquisiciones Central', 'LP', 'Bienes', 'Insumos ficticios de oficina lote 3', '2024-02-01', '2024-02-16', '2024-02-20', 'Empresa Ficticia Alfa S.A. de C.V.', 'SUP-001', 2, 15000.00, 14800.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0013', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Ministerio de Ficción A', 'Unidad de Adquisiciones Central', 'LP', 'Servicios', 'Mantenimiento ficticio de equipos lote 1', '2024-02-10', '2024-02-25', '2024-03-01', 'Empresa Ficticia Alfa S.A. de C.V.', 'SUP-001', 1, 30000.00, 29500.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0014', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Ministerio de Ficción A', 'Unidad de Adquisiciones Central', 'LC', 'Bienes', 'Insumos ficticios de oficina lote 4', '2024-03-01', '2024-03-15', '2024-03-20', 'Empresa Ficticia Alfa S.A. de C.V.', 'SUP-001', 2, 20000.00, 19500.00, 'USD', 'adjudicado', true);

-- Casos para Indicador 3: Modalidades no competitivas recurrentes
INSERT INTO procurement_processes
  (process_id, upload_id, institution_name, purchasing_unit, procurement_method, procurement_category, procurement_description, publication_date, bid_deadline, award_date, supplier_name, supplier_id_code, number_of_bidders, estimated_amount, awarded_amount, currency, contract_status, is_demo)
VALUES
  ('PRC-2024-0020', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Institución Autónoma B', 'Unidad de Logística y Abastecimiento', 'CD', 'Servicios', 'Contratación ficticia directa de servicios técnicos', '2024-01-08', '2024-01-08', '2024-01-10', 'Tecnología Ficticia Zeta S.A. de C.V.', 'SUP-006', 1, 12000.00, 12000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0021', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Institución Autónoma B', 'Unidad de Logística y Abastecimiento', 'CD', 'Bienes', 'Compra ficticia directa de equipos especializados', '2024-01-20', '2024-01-20', '2024-01-22', 'Tecnología Ficticia Zeta S.A. de C.V.', 'SUP-006', 1, 8500.00, 8500.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0022', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Institución Autónoma B', 'Unidad de Logística y Abastecimiento', 'CP', 'Servicios', 'Contratación ficticia por catálogo de capacitación', '2024-02-05', '2024-02-05', '2024-02-07', 'Consultoría Ficticia Iota', 'SUP-009', 1, 9500.00, 9500.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0023', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Institución Autónoma B', 'Unidad de Logística y Abastecimiento', 'CD', 'Bienes', 'Adquisición ficticia directa de insumos médicos', '2024-02-15', '2024-02-15', '2024-02-17', 'Insumos Ficticios Theta Ltda.', 'SUP-008', 1, 15000.00, 15000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0024', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Institución Autónoma B', 'Unidad de Logística y Abastecimiento', 'CE', 'Servicios', 'Contratación ficticia por excepción de mantenimiento', '2024-03-01', '2024-03-01', '2024-03-03', 'Servicios Ficticios Épsilon', 'SUP-005', 1, 11000.00, 11000.00, 'USD', 'adjudicado', true);

-- Casos para Indicador 4: Posible fraccionamiento (3 contratos cercanos, mismos proveedor e institución, montos ~$30k, suma >$100k)
INSERT INTO procurement_processes
  (process_id, upload_id, institution_name, purchasing_unit, procurement_method, procurement_category, procurement_description, publication_date, bid_deadline, award_date, supplier_name, supplier_id_code, number_of_bidders, estimated_amount, awarded_amount, currency, contract_status, is_demo)
VALUES
  ('PRC-2024-0030', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Entidad Descentralizada D', 'Unidad de Procesos Administrativos', 'LP', 'Bienes', 'Adquisición ficticia de equipo médico parte 1', '2024-01-10', '2024-01-25', '2024-01-28', 'Industria Ficticia Lambda S.A.', 'SUP-011', 3, 35000.00, 34000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0031', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Entidad Descentralizada D', 'Unidad de Procesos Administrativos', 'LP', 'Bienes', 'Adquisición ficticia de equipo médico parte 2', '2024-01-12', '2024-01-27', '2024-01-30', 'Industria Ficticia Lambda S.A.', 'SUP-011', 3, 33000.00, 32000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0032', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Entidad Descentralizada D', 'Unidad de Procesos Administrativos', 'LP', 'Bienes', 'Adquisición ficticia de equipo médico parte 3', '2024-01-15', '2024-01-30', '2024-02-02', 'Industria Ficticia Lambda S.A.', 'SUP-011', 3, 38000.00, 37000.00, 'USD', 'adjudicado', true);

-- Casos para Indicador 5: Plazos atípicamente cortos
INSERT INTO procurement_processes
  (process_id, upload_id, institution_name, purchasing_unit, procurement_method, procurement_category, procurement_description, publication_date, bid_deadline, award_date, supplier_name, supplier_id_code, number_of_bidders, estimated_amount, awarded_amount, currency, contract_status, is_demo)
VALUES
  ('PRC-2024-0040', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Secretaría Técnica E', 'Unidad de Servicios Técnicos', 'LP', 'Bienes', 'Compra ficticia de suministros tecnológicos urgentes', '2024-02-10', '2024-02-13', '2024-02-15', 'Tecnología Ficticia Zeta S.A. de C.V.', 'SUP-006', 4, 28000.00, 27000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0041', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Secretaría Técnica E', 'Unidad de Servicios Técnicos', 'LC', 'Servicios', 'Servicios ficticios de impresión urgente', '2024-03-01', '2024-03-03', '2024-03-05', 'Comercializadora Ficticia Mu', 'SUP-012', 3, 18000.00, 17500.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0042', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Municipalidad Ficticia C', 'Unidad de Compras Municipales', 'LP', 'Obras', 'Obra ficticia de mantenimiento vial rápido', '2024-02-20', '2024-02-23', '2024-02-26', 'Construcciones Ficticias Eta', 'SUP-007', 2, 42000.00, 41000.00, 'USD', 'adjudicado', true);

-- Casos normales (sin alertas) para balancear el panel
INSERT INTO procurement_processes
  (process_id, upload_id, institution_name, purchasing_unit, procurement_method, procurement_category, procurement_description, publication_date, bid_deadline, award_date, supplier_name, supplier_id_code, number_of_bidders, estimated_amount, awarded_amount, currency, contract_status, is_demo)
VALUES
  ('PRC-2024-0050', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Ministerio de Ficción A', 'Unidad Administrativa Departamental', 'LP', 'Bienes', 'Adquisición ficticia de papelería', '2024-01-10', '2024-02-05', '2024-02-15', 'Distribuidora Ficticia Kappa', 'SUP-010', 5, 12000.00, 11500.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0051', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Institución Autónoma B', 'Unidad de Logística y Abastecimiento', 'LP', 'Servicios', 'Servicios ficticios de seguridad', '2024-01-15', '2024-02-10', '2024-02-20', 'Servicios Ficticios Épsilon', 'SUP-005', 4, 55000.00, 54000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0052', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Entidad Descentralizada D', 'Unidad de Procesos Administrativos', 'LC', 'Bienes', 'Compra ficticia de combustible', '2024-02-01', '2024-02-25', '2024-03-05', 'Comercializadora Ficticia Mu', 'SUP-012', 6, 65000.00, 64000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0053', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Secretaría Técnica E', 'Unidad de Servicios Técnicos', 'LP', 'Servicios', 'Servicios ficticios de capacitación', '2024-03-01', '2024-03-25', '2024-04-01', 'Consultoría Ficticia Iota', 'SUP-009', 5, 22000.00, 21000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0054', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Municipalidad Ficticia C', 'Unidad de Compras Municipales', 'LC', 'Obras', 'Construcción ficticia de parque', '2024-01-20', '2024-02-15', '2024-02-25', 'Construcciones Ficticias Eta', 'SUP-007', 4, 95000.00, 93000.00, 'USD', 'adjudicado', true),
  ('PRC-2024-0055', (SELECT id FROM data_uploads WHERE is_demo=true LIMIT 1), 'Ministerio de Ficción A', 'Unidad de Adquisiciones Central', 'LP', 'Bienes', 'Adquisición ficticia de vehículos', '2024-02-05', '2024-03-01', '2024-03-10', 'Industria Ficticia Lambda S.A.', 'SUP-011', 4, 120000.00, 118000.00, 'USD', 'adjudicado', true);
