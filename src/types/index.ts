export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  position: string | null;
  organizational_unit: string | null;
  role_id: string | null;
  status: string;
  mfa_enabled: boolean;
  access_expires_at: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  failed_attempts: number;
  locked_until: string | null;
  password_changed_at: string;
  force_password_change: boolean;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  role?: Role;
}

export interface SecuritySettings {
  id: string;
  max_session_minutes: number;
  inactivity_timeout_minutes: number;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_number: boolean;
  password_require_special: boolean;
  mfa_required: boolean;
  default_access_expiry_days: number;
  file_retention_days: number;
  audit_retention_days: number;
  allowed_file_types: string;
  max_file_size_mb: number;
  allow_export: boolean;
  allow_download: boolean;
  unit_visibility_enabled: boolean;
  restricted_access_message: string;
}

export interface AuditLog {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  user_unit: string | null;
  action_type: string;
  module: string;
  affected_record: string | null;
  description: string | null;
  ip_address: string | null;
  result: string;
  session_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface Institution {
  id: string;
  code: string;
  name: string;
  type: string | null;
  is_active: boolean;
}

export interface OrganizationalUnit {
  id: string;
  institution_id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export interface Supplier {
  id: string;
  supplier_id: string;
  name: string;
  legal_id: string | null;
  is_active: boolean;
}

export interface ProcurementProcess {
  id: string;
  process_id: string;
  upload_id: string | null;
  institution_id: string | null;
  institution_code: string | null;
  institution_name: string | null;
  purchasing_unit: string | null;
  procurement_method: string | null;
  procurement_category: string | null;
  procurement_description: string | null;
  publication_date: string | null;
  bid_deadline: string | null;
  award_date: string | null;
  supplier_name: string | null;
  supplier_id_code: string | null;
  supplier_id: string | null;
  number_of_bidders: number | null;
  number_of_valid_bids: number | null;
  estimated_amount: number | null;
  awarded_amount: number | null;
  currency: string;
  contract_status: string | null;
  contract_document_published: boolean | null;
  contract_document_type: string | null;
  contract_document_url: string | null;
  contract_document_publication_date: string | null;
  alert_count: number;
  priority: string | null;
  is_demo: boolean;
  is_active: boolean;
  created_at: string;
  confidentiality_level: string | null;
}

export interface DataUpload {
  id: string;
  name: string;
  period: string;
  source: string | null;
  institution_scope: string | null;
  description: string | null;
  confidentiality_level: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  total_records: number;
  valid_records: number;
  warning_records: number;
  rejected_records: number;
  alerts_generated: number;
  status: string;
  processing_progress: number;
  processed_at: string | null;
  is_demo: boolean;
  created_at: string;
  created_by: string | null;
}

export interface DataQualityIssue {
  id: string;
  upload_id: string;
  row_number: number | null;
  column_name: string | null;
  issue_type: string;
  message: string;
  value: string | null;
}

export interface IndicatorDefinition {
  id: string;
  code: string;
  name: string;
  description: string | null;
  methodology: string | null;
  formula: string | null;
  required_fields: string | null;
  exclusions: string | null;
  is_active: boolean;
  current_version: number;
}

export interface IndicatorParameter {
  id: string;
  indicator_id: string;
  param_key: string;
  param_value: string;
  param_type: string;
  description: string | null;
  version: number;
  is_active: boolean;
}

export interface IndicatorVersion {
  id: string;
  indicator_id: string;
  version: number;
  parameters_snapshot: Record<string, unknown>;
  change_description: string | null;
  published: boolean;
  created_at: string;
  created_by: string | null;
}

export interface IndicatorConfigHistory {
  id: string;
  indicator_id: string;
  action: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  version: number | null;
  created_at: string;
  created_by: string | null;
  user_email: string | null;
}

export interface Alert {
  id: string;
  alert_code: string;
  indicator_id: string;
  indicator_code: string;
  upload_id: string | null;
  title: string;
  description: string | null;
  calculation_detail: string | null;
  threshold_applied: string | null;
  data_used: Record<string, unknown> | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  assigned_at: string | null;
  conclusion: string | null;
  is_deleted: boolean;
  is_demo: boolean;
  alert_level: string | null;
  quality_note: string | null;
  created_at: string;
  updated_at: string;
  indicator?: IndicatorDefinition;
}

export interface AlertComment {
  id: string;
  alert_id: string;
  comment: string;
  is_internal: boolean;
  is_deleted: boolean;
  created_at: string;
  created_by: string | null;
  user_name: string | null;
}

export interface AlertStatusHistory {
  id: string;
  alert_id: string;
  from_status: string | null;
  to_status: string;
  reason: string | null;
  changed_at: string;
  changed_by: string | null;
  user_name: string | null;
}

export interface AlertDocument {
  id: string;
  alert_id: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  storage_path: string;
  description: string | null;
  is_deleted: boolean;
  created_at: string;
  created_by: string | null;
  user_name: string | null;
}

export interface UserSession {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  started_at: string;
  last_activity_at: string;
  ended_at: string | null;
  is_active: boolean;
}

export const ALERT_STATUS_LABELS: Record<string, string> = {
  new: 'Nueva',
  assigned: 'Asignada',
  in_review: 'En revisión',
  requires_info: 'Requiere información',
  referred: 'Remitida para análisis',
  discarded: 'Descartada',
  closed: 'Cerrada',
};

export const ALERT_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  assigned: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  in_review: 'bg-amber-100 text-amber-800 border-amber-200',
  requires_info: 'bg-orange-100 text-orange-800 border-orange-200',
  referred: 'bg-purple-100 text-purple-800 border-purple-200',
  discarded: 'bg-gray-100 text-gray-600 border-gray-200',
  closed: 'bg-green-100 text-green-800 border-green-200',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 border-blue-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

export const INDICATOR_LABELS: Record<string, string> = {
  R018: 'R018 — Oferta única',
  R003: 'R003 — Plazo corto para presentar ofertas',
  R063: 'R063 — Contrato o documento contractual no publicado',
  R013: 'R013 — Alto uso de métodos no competitivos',
  R040: 'R040 — Alta concentración comprador–proveedor',
  single_bidder: 'R018 — Oferta única',
  award_concentration: 'R040 — Concentración comprador–proveedor',
  non_competitive_methods: 'R013 — Uso de métodos no competitivos',
  contract_splitting: 'R063 — Documento contractual no publicado',
  short_timelines: 'R003 — Plazo corto',
};

export const INDICATOR_SHORT: Record<string, string> = {
  R018: 'Oferta única',
  R003: 'Plazo corto',
  R063: 'Contrato no publicado',
  R013: 'Uso no competitivo',
  R040: 'Concentración C-P',
};

export const INDICATOR_LEVEL: Record<string, string> = {
  R018: 'process',
  R003: 'process',
  R063: 'process',
  R013: 'institution',
  R040: 'buyer_supplier',
};

export const INDICATOR_LEVEL_LABEL: Record<string, string> = {
  process: 'Nivel proceso',
  institution: 'Nivel institución',
  buyer_supplier: 'Nivel comprador–proveedor',
};

export const REVIEW_LEVEL_LABELS: Record<string, string> = {
  none: 'Sin alertas',
  low: 'Atención',
  medium: 'Prioridad',
  high: 'Alta prioridad',
};

export const USER_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  suspended: 'Suspendido',
  inactive: 'Inactivo',
  expired: 'Expirado',
};

export const USER_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800 border-green-200',
  suspended: 'bg-orange-100 text-orange-800 border-orange-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-red-100 text-red-800 border-red-200',
};

export const ROLE_LABELS: Record<string, string> = {
  admin_general: 'Administrador General',
  super_admin: 'Super Administrador',
  fiscalization: 'Fiscalización',
};
