/*
# Banderas rojas priorizadas — catálogo ampliado

1. Objetivo
- Incorporar 9 banderas rojas al catálogo existente de SIGA-DINAC.
- Reutiliza la estructura de `indicator_definitions` e `indicator_parameters` existentes.
- No reemplaza ni modifica los 5 indicadores actuales (R018, R003, R063, R013, R040).

2. Banderas ya existentes (sin cambios)
- BR-02 (Se recibió una única oferta) = R018 ya existe y calcula.
- BR-05 (El contrato no está publicado) = R063 ya existe y calcula.

3. Nuevas banderas agregadas
- R101 — Manipulación de umbrales de contratación (Parcial)
- R103 — Similitudes comerciales entre oferentes (Pendiente de datos)
- R104 — Período de decisión extremadamente corto (Aproximado)
- R106 — El contrato tiene modificaciones (Parcial)
- R107 — Modificaciones reiteradas de la convocatoria vigente (Pendiente de datos)
- R108 — Cambios de último momento en las fechas del proceso (Pendiente de datos)
- R109 — Tiempo inusualmente corto entre apertura y firma del contrato (Pendiente de datos)

4. Parámetros
- R101: umbral_referencia_salarios (240), comparacion_precios (flag), modalidades_competitivas (LP,LC)
- R104: max_dias_decision (3), modalidades_competitivas (LP,LC)
- R106: umbral_modificacion_pct (30)
- Las banderas pendientes de datos se crean inactivas para evaluación pero visibles en el catálogo.

5. Seguridad
- No crea nuevas tablas. Usa `indicator_definitions` e `indicator_parameters` existentes.
- No altera políticas RLS existentes.
- Las funciones RPC y el motor de cálculo manejan los nuevos códigos.
*/

-- ============================================================
-- R101 — Manipulación de umbrales de contratación
-- ============================================================
INSERT INTO indicator_definitions (code, name, description, methodology, formula, required_fields, exclusions, is_active, current_version)
VALUES (
  'R101',
  'R101 — Manipulación de umbrales de contratación',
  'Identifica contrataciones que excedan el umbral permitido para su modalidad, comparando montos con umbrales institucionales aplicables.',
  'Se comparan los montos adjudicados y estimados con los umbrales aplicables a cada modalidad. El umbral referido a 240 salarios mínimos se aplica únicamente cuando el valor está configurado y validado. No clasifica compras repetidas como fragmentación ilegal sin información y metodología suficientes.',
  'awarded_amount > umbral_modalidad OR (procurement_method = ''CP'' AND awarded_amount > 240 * salario_minimo)',
  'procurement_method, awarded_amount, estimated_amount, institution_id, publication_date',
  'Umbrales no configurados o no validados. Comparación de Precios evaluada solo cuando el umbral institucional está disponible.',
  true,
  1
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  methodology = EXCLUDED.methodology,
  formula = EXCLUDED.formula,
  required_fields = EXCLUDED.required_fields,
  exclusions = EXCLUDED.exclusions;

INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'umbral_referencia_salarios', '240', 'number', 'Número de salarios mínimos como umbral de referencia institucional.'
FROM indicator_definitions WHERE code = 'R101'
ON CONFLICT DO NOTHING;

INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'modalidades_competitivas', 'LP,LC', 'text', 'Modalidades competitivas donde se evalúa el umbral.'
FROM indicator_definitions WHERE code = 'R101'
ON CONFLICT DO NOTHING;

INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'salario_minimo_mensual', '0', 'number', 'Valor del salario mínimo mensual configurado. Cero significa no configurado (la regla no se evalúa).'
FROM indicator_definitions WHERE code = 'R101'
ON CONFLICT DO NOTHING;

-- ============================================================
-- R103 — Similitudes comerciales entre oferentes
-- ============================================================
INSERT INTO indicator_definitions (code, name, description, methodology, formula, required_fields, exclusions, is_active, current_version)
VALUES (
  'R103',
  'R103 — Similitudes comerciales entre oferentes',
  'Identifica oferentes de un mismo proceso que compartan teléfono, correo, dirección o contacto comercial.',
  'Requiere información individual de todos los oferentes participantes. La plantilla actual contiene únicamente datos del proveedor adjudicado, por lo que esta bandera no puede calcularse con los datos disponibles. No se generan alertas ficticias ni se asumen coincidencias inexistentes.',
  'COUNT(oferentes con telefono, correo o direccion compartidos) >= 2',
  'datos_individuales_oferentes (telefono, correo, direccion)',
  'No aplicable con la plantilla actual. Pendiente de incorporar datos de todos los oferentes.',
  true,
  1
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  methodology = EXCLUDED.methodology,
  formula = EXCLUDED.formula,
  required_fields = EXCLUDED.required_fields,
  exclusions = EXCLUDED.exclusions;

-- ============================================================
-- R104 — Período de decisión extremadamente corto
-- ============================================================
INSERT INTO indicator_definitions (code, name, description, methodology, formula, required_fields, exclusions, is_active, current_version)
VALUES (
  'R104',
  'R104 — Período de decisión extremadamente corto',
  'Identifica procesos con un intervalo extremadamente corto entre la recepción de ofertas y la adjudicación.',
  'Se calcula como la diferencia en días entre bid_deadline y award_date. El cálculo es aproximado porque no se dispone de las fechas exactas de evaluación de ofertas. Se aplica un umbral demostrativo de 3 días calendario para LP y LC.',
  'dias_decision = award_date - bid_deadline; dias_decision <= max_dias_decision AND procurement_method IN (LP,LC)',
  'bid_deadline, award_date, procurement_method',
  'Procesos sin fechas de recepción o adjudicación. Modalidades no competitivas.',
  true,
  1
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  methodology = EXCLUDED.methodology,
  formula = EXCLUDED.formula,
  required_fields = EXCLUDED.required_fields,
  exclusions = EXCLUDED.exclusions;

INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'max_dias_decision', '3', 'number', 'Número máximo de días calendario entre recepción de ofertas y adjudicación para considerar el plazo extremadamente corto.'
FROM indicator_definitions WHERE code = 'R104'
ON CONFLICT DO NOTHING;

INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'modalidades_competitivas', 'LP,LC', 'text', 'Modalidades competitivas donde se evalúa el período de decisión.'
FROM indicator_definitions WHERE code = 'R104'
ON CONFLICT DO NOTHING;

-- ============================================================
-- R106 — El contrato tiene modificaciones
-- ============================================================
INSERT INTO indicator_definitions (code, name, description, methodology, formula, required_fields, exclusions, is_active, current_version)
VALUES (
  'R106',
  'R106 — El contrato tiene modificaciones',
  'Identifica contratos con modificaciones monetarias, especialmente aquellas que superan el 30% del monto adjudicado.',
  'Se evalúa cuando amendment_amount > 0. Se calcula el porcentaje de modificación como (amendment_amount / awarded_amount) * 100. Las modificaciones superiores al 30% se marcan como condición demostrativa configurable, no como incumplimiento legal. La plantilla actual no permite conocer todas las modificaciones de plazo o alcance.',
  'amendment_amount > 0 AND (amendment_amount / awarded_amount) * 100 >= umbral_modificacion_pct',
  'amendment_amount, awarded_amount',
  'Procesos sin monto de modificación registrado. Modificaciones de plazo o alcance no disponibles en la plantilla actual.',
  true,
  1
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  methodology = EXCLUDED.methodology,
  formula = EXCLUDED.formula,
  required_fields = EXCLUDED.required_fields,
  exclusions = EXCLUDED.exclusions;

INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'umbral_modificacion_pct', '30', 'number', 'Porcentaje de modificación sobre el monto adjudicado que activa la alerta.'
FROM indicator_definitions WHERE code = 'R106'
ON CONFLICT DO NOTHING;

-- ============================================================
-- R107 — Modificaciones reiteradas de la convocatoria vigente
-- ============================================================
INSERT INTO indicator_definitions (code, name, description, methodology, formula, required_fields, exclusions, is_active, current_version)
VALUES (
  'R107',
  'R107 — Modificaciones reiteradas de la convocatoria vigente',
  'Identifica dos o más enmiendas a los documentos de convocatoria de un proceso de licitación.',
  'Requiere la cantidad, fecha y tipo de enmiendas de la convocatoria. No utiliza amendment_amount, que corresponde a modificaciones contractuales. La plantilla actual no contiene datos de enmiendas a la convocatoria.',
  'COUNT(enmiendas_convocatoria) >= 2',
  'cantidad_enmiendas, fecha_enmienda, tipo_enmienda',
  'No aplicable con la plantilla actual. Pendiente de incorporar datos de enmiendas a la convocatoria.',
  true,
  1
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  methodology = EXCLUDED.methodology,
  formula = EXCLUDED.formula,
  required_fields = EXCLUDED.required_fields,
  exclusions = EXCLUDED.exclusions;

-- ============================================================
-- R108 — Cambios de último momento en las fechas del proceso
-- ============================================================
INSERT INTO indicator_definitions (code, name, description, methodology, formula, required_fields, exclusions, is_active, current_version)
VALUES (
  'R108',
  'R108 — Cambios de último momento en las fechas del proceso',
  'Identifica modificaciones a fechas clave del proceso poco antes de su vencimiento.',
  'Requiere la fecha original, la fecha modificada y el momento en que se registró el cambio. Umbral demostrativo: 48 horas anteriores al vencimiento. La plantilla actual no contiene el historial de cambios de fechas.',
  'cambio_fecha dentro de 48 horas del vencimiento',
  'fecha_original, fecha_modificada, momento_cambio',
  'No aplicable con la plantilla actual. Pendiente de incorporar historial de cambios de fechas.',
  true,
  1
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  methodology = EXCLUDED.methodology,
  formula = EXCLUDED.formula,
  required_fields = EXCLUDED.required_fields,
  exclusions = EXCLUDED.exclusions;

INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'horas_antes_vencimiento', '48', 'number', 'Número de horas antes del vencimiento que definen un cambio de último momento.'
FROM indicator_definitions WHERE code = 'R108'
ON CONFLICT DO NOTHING;

-- ============================================================
-- R109 — Tiempo inusualmente corto entre apertura y firma del contrato
-- ============================================================
INSERT INTO indicator_definitions (code, name, description, methodology, formula, required_fields, exclusions, is_active, current_version)
VALUES (
  'R109',
  'R109 — Tiempo inusualmente corto entre apertura y firma del contrato',
  'Identifica intervalos extremadamente cortos entre la apertura de ofertas y la firma del contrato.',
  'Requiere bid_opening_date y contract_signature_date. La plantilla actual no incluye la fecha de firma del contrato. No se sustituye automáticamente esta fecha por contract_start_date.',
  'dias_apertura_firma = contract_signature_date - bid_opening_date; dias_apertura_firma <= umbral_dias',
  'bid_opening_date, contract_signature_date, procurement_method',
  'No aplicable con la plantilla actual. Pendiente de incorporar fecha de firma del contrato.',
  true,
  1
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  methodology = EXCLUDED.methodology,
  formula = EXCLUDED.formula,
  required_fields = EXCLUDED.required_fields,
  exclusions = EXCLUDED.exclusions;

INSERT INTO indicator_parameters (indicator_id, param_key, param_value, param_type, description)
SELECT id, 'max_dias_apertura_firma', '5', 'number', 'Número máximo de días entre apertura de ofertas y firma del contrato para considerar el tiempo inusualmente corto.'
FROM indicator_definitions WHERE code = 'R109'
ON CONFLICT DO NOTHING;
