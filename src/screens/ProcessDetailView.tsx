import { useEffect, useState } from 'react';
import {
  ArrowLeft, Building2, Calendar, DollarSign, Users, FileText,
  AlertTriangle, ChevronRight, ShieldAlert, CheckCircle2, XCircle,
  TrendingUp, Loader,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  ALERT_STATUS_LABELS, ALERT_STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  INDICATOR_LABELS, INDICATOR_SHORT,
  INDICATOR_LEVEL_LABEL,
  INDICATOR_RULE_EXPLANATIONS,
  type Alert, type ProcurementProcess,
} from '@/types';
import type { ViewKey } from '@/components/AppShell';

interface ProcessDetailViewProps {
  processId: string;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}

interface ProcessAlert extends Omit<Alert, 'indicator'> {
  indicator?: { current_version: number } | null;
}

const METHOD_LABELS: Record<string, string> = {
  LP: 'Licitación Pública',
  LC: 'Licitación por Catálogo',
  CD: 'Contratación Directa',
  CE: 'Contratación de Emergencia',
  LI: 'Licitación Internacional',
  CP: 'Compra Pública',
  EB: 'Express Buy',
};

function fmtDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('es-SV', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr;
  }
}

function fmtMoney(amount: number | null): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
}

function getObservedResult(alert: Alert, dataUsed: Record<string, unknown> | null): string {
  const code = alert.indicator_code;
  switch (code) {
    case 'R018':
    case 'single_bidder': {
      const valid = dataUsed?.number_of_valid_bids ?? dataUsed?.number_of_bidders ?? 1;
      return `${valid} oferta válida`;
    }
    case 'R003':
    case 'short_timelines': {
      const days = dataUsed?.days_between ?? dataUsed?.days ?? '—';
      return `${days} día(s)`;
    }
    case 'R063':
    case 'contract_splitting': {
      return 'Documento no publicado';
    }
    case 'R013':
    case 'non_competitive_methods': {
      const pct = dataUsed?.non_competitive_percentage ?? dataUsed?.percentage ?? '—';
      return `${pct}% no competitivo`;
    }
    case 'R040':
    case 'award_concentration': {
      const pct = dataUsed?.concentration_percentage ?? dataUsed?.percentage ?? '—';
      return `${pct}% concentración`;
    }
    default:
      return alert.calculation_detail || '—';
  }
}

function getConfidence(alert: Alert): { label: string; color: string } {
  if (alert.quality_note) return { label: 'Media', color: 'text-amber-600' };
  return { label: 'Alta', color: 'text-emerald-600' };
}

export function ProcessDetailView({ processId, onNavigate }: ProcessDetailViewProps) {
  const [process, setProcess] = useState<ProcurementProcess | null>(null);
  const [alerts, setAlerts] = useState<ProcessAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: procData } = await supabase
        .from('procurement_processes')
        .select('*')
        .eq('process_id', processId)
        .eq('is_active', true)
        .maybeSingle();
      setProcess(procData as ProcurementProcess | null);

      if (procData) {
        const { data: alertData } = await supabase
          .from('alerts')
          .select('*, indicator:indicator_definitions(current_version)')
          .eq('is_deleted', false)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false });
        const allAlerts = (alertData || []) as ProcessAlert[];
        const procAlerts = allAlerts.filter((a) => {
          const du = a.data_used as Record<string, unknown> | null;
          return du?.process_id === processId;
        });
        setAlerts(procAlerts);
      }
      setLoading(false);
    }
    load();
  }, [processId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <Loader className="w-6 h-6 animate-spin mb-2" />
        <span className="ml-2">Cargando proceso...</span>
      </div>
    );
  }

  if (!process) {
    return (
      <div className="space-y-4">
        <button onClick={() => onNavigate('dashboard')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <p className="text-slate-500">Proceso no encontrado.</p>
      </div>
    );
  }

  const highCount = alerts.filter((a) => a.priority === 'high').length;
  const mediumCount = alerts.filter((a) => a.priority === 'medium').length;
  const lowCount = alerts.filter((a) => a.priority === 'low').length;

  const generalFields = [
    { label: 'Código', value: process.process_id, icon: FileText },
    { label: 'Institución', value: process.institution_name || '—', icon: Building2 },
    { label: 'Unidad compradora', value: process.purchasing_unit || '—', icon: Building2 },
    { label: 'Objeto', value: process.procurement_description || '—', icon: FileText },
    { label: 'Modalidad', value: METHOD_LABELS[process.procurement_method || ''] || process.procurement_method || '—', icon: FileText },
    { label: 'Estado del contrato', value: process.contract_status || '—', icon: CheckCircle2 },
    { label: 'Fecha de publicación', value: fmtDate(process.publication_date), icon: Calendar },
    { label: 'Fecha de cierre de ofertas', value: fmtDate(process.bid_deadline), icon: Calendar },
    { label: 'Fecha de adjudicación', value: fmtDate(process.award_date), icon: Calendar },
    { label: 'Fecha de contrato', value: fmtDate(process.contract_document_publication_date), icon: Calendar },
    { label: 'Monto estimado', value: fmtMoney(process.estimated_amount), icon: DollarSign },
    { label: 'Monto adjudicado', value: fmtMoney(process.awarded_amount), icon: DollarSign },
    { label: 'Proveedor', value: process.supplier_name || '—', icon: Users },
    { label: 'Cantidad de oferentes', value: process.number_of_bidders != null ? String(process.number_of_bidders) : '—', icon: Users },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('dashboard')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">{process.process_id}</span>
            {process.alert_count > 0 && (
              <span className="badge bg-red-100 text-red-800 border-red-200">
                {process.alert_count} alerta{process.alert_count !== 1 ? 's' : ''}
              </span>
            )}
            {process.is_demo && (
              <span className="badge bg-blue-50 text-blue-700 border-blue-200">Demo</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            {process.procurement_description || process.process_id}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {process.institution_name || 'Sin institución'} · {METHOD_LABELS[process.procurement_method || ''] || process.procurement_method}
          </p>
        </div>
      </div>

      {/* DATOS GENERALES */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">Datos generales</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {generalFields.map((field) => {
            const Icon = field.icon;
            return (
              <div key={field.label} className="min-w-0">
                <dt className="text-xs text-slate-400 flex items-center gap-1.5 mb-1">
                  <Icon className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                  {field.label}
                </dt>
                <dd className="text-sm text-slate-800 truncate" title={field.value}>
                  {field.value}
                </dd>
              </div>
            );
          })}
        </div>
      </div>

      {/* RESUMEN DE RIESGO */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="w-5 h-5 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">Resumen de riesgo</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <RiskStat label="Total alertas" value={alerts.length} color="slate" icon={AlertTriangle} />
          <RiskStat label="Altas" value={highCount} color="red" icon={TrendingUp} />
          <RiskStat label="Medias" value={mediumCount} color="amber" icon={TrendingUp} />
          <RiskStat label="Bajas" value={lowCount} color="blue" icon={TrendingUp} />
          <RiskStat
            label="No evaluables"
            value={5 - new Set(alerts.map((a) => a.indicator_code)).size}
            color="slate"
            icon={XCircle}
          />
        </div>
      </div>

      {/* ALERTAS DETECTADAS */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">Alertas detectadas</h2>
        </div>

        {alerts.length === 0 ? (
          <div className="card p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No se detectaron alertas para este proceso.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const dataUsed = alert.data_used as Record<string, unknown> | null;
              const observed = getObservedResult(alert as Alert, dataUsed);
              const confidence = getConfidence(alert as Alert);
              const ruleText = INDICATOR_RULE_EXPLANATIONS[alert.indicator_code] || '';

              return (
                <div
                  key={alert.id}
                  className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => onNavigate('alert-detail', { id: alert.id })}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono font-semibold text-blue-700">
                          {alert.indicator_code}
                        </span>
                        <span className={`badge ${PRIORITY_COLORS[alert.priority] || ''}`}>
                          {PRIORITY_LABELS[alert.priority]}
                        </span>
                        <span className={`badge ${ALERT_STATUS_COLORS[alert.status] || ''}`}>
                          {ALERT_STATUS_LABELS[alert.status]}
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {INDICATOR_SHORT[alert.indicator_code] || alert.title}
                      </h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0 mt-1" />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400 mb-0.5">Resultado observado</p>
                      <p className="text-slate-700 font-medium">{observed}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Severidad</p>
                      <p className="text-slate-700 font-medium">{PRIORITY_LABELS[alert.priority]}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Confianza</p>
                      <p className={`font-medium ${confidence.color}`}>{confidence.label}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-0.5">Estado de revisión</p>
                      <p className="text-slate-700 font-medium">{ALERT_STATUS_LABELS[alert.status]}</p>
                    </div>
                  </div>

                  {ruleText && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 leading-relaxed">{ruleText}</p>
                    </div>
                  )}

                  {alert.alert_level && (
                    <div className="mt-2">
                      <span className="text-[10px] text-slate-400">
                        {INDICATOR_LEVEL_LABEL[alert.alert_level] || alert.alert_level}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preventive notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          Las alertas son señales preventivas generadas mediante reglas de análisis. No constituyen por sí mismas evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requieren revisión técnica y documental.
        </p>
      </div>
    </div>
  );
}

function RiskStat({ label, value, color, icon: Icon }: {
  label: string;
  value: number;
  color: 'red' | 'amber' | 'blue' | 'slate';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const colorMap = {
    red: 'text-red-600 bg-red-50',
    amber: 'text-amber-600 bg-amber-50',
    blue: 'text-blue-600 bg-blue-50',
    slate: 'text-slate-600 bg-slate-50',
  };
  return (
    <div className={`rounded-lg p-3 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium opacity-80">{label}</span>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <span className="text-2xl font-bold">{value}</span>
    </div>
  );
}
