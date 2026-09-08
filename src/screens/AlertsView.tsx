import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Search, AlertTriangle, ChevronDown, ChevronRight, Info,
  Calculator, Database, Scale, FileText, Building2, Factory,
  TrendingUp, Clock, Layers, ShieldAlert, Filter, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  ALERT_STATUS_LABELS, ALERT_STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  INDICATOR_LABELS,
  type Alert, type IndicatorDefinition,
} from '@/types';
import type { ViewKey } from '@/components/AppShell';
import { HelpTooltip, InfoNote, PageHeader } from '@/components/HelpUI';

interface AlertsViewProps {
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}

interface IndicatorMeta {
  code: string;
  name: string;
  description: string | null;
  methodology: string | null;
  formula: string | null;
  exclusions: string | null;
}

const INDICATOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  R018: TrendingUp,
  R040: Layers,
  R013: ShieldAlert,
  R063: FileText,
  R003: Clock,
  single_bidder: TrendingUp,
  award_concentration: Layers,
  non_competitive_methods: ShieldAlert,
  contract_splitting: FileText,
  short_timelines: Clock,
};

const INDICATOR_UNIT: Record<string, string> = {
  R018: 'Unidad de análisis: proceso',
  R040: 'Unidad de análisis: proveedor × institución',
  R013: 'Unidad de análisis: institución',
  R063: 'Unidad de análisis: proceso',
  R003: 'Unidad de análisis: proceso',
  single_bidder: 'Unidad de análisis: proceso',
  award_concentration: 'Unidad de análisis: proveedor × institución',
  non_competitive_methods: 'Unidad de análisis: institución',
  contract_splitting: 'Unidad de análisis: proceso',
  short_timelines: 'Unidad de análisis: proceso',
};

export function AlertsView({ onNavigate }: AlertsViewProps) {
  const { hasPermission } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [indicators, setIndicators] = useState<Record<string, IndicatorMeta>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterIndicator, setFilterIndicator] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('alerts')
      .select('*, indicator:indicator_definitions(*)')
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (filterStatus) query = query.eq('status', filterStatus);
    if (filterPriority) query = query.eq('priority', filterPriority);
    if (filterIndicator) query = query.eq('indicator_code', filterIndicator);

    const { data: alertData } = await query.limit(200);
    setAlerts((alertData || []) as Alert[]);

    const { data: indData } = await supabase
      .from('indicator_definitions')
      .select('code, name, description, methodology, formula, exclusions')
      .eq('is_active', true);
    const indMap: Record<string, IndicatorMeta> = {};
    (indData || []).forEach((i) => { indMap[i.code] = i as IndicatorMeta; });
    setIndicators(indMap);

    setLoading(false);
  }, [filterStatus, filterPriority, filterIndicator]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return alerts;
    const s = search.toLowerCase();
    return alerts.filter((a) =>
      a.title.toLowerCase().includes(s) ||
      a.alert_code.toLowerCase().includes(s) ||
      (a.description || '').toLowerCase().includes(s)
    );
  }, [alerts, search]);

  // Summary counts
  const summary = useMemo(() => {
    const byPriority: Record<string, number> = { high: 0, medium: 0, low: 0 };
    const byStatus: Record<string, number> = {};
    alerts.forEach((a) => {
      byPriority[a.priority] = (byPriority[a.priority] || 0) + 1;
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    });
    return { byPriority, byStatus, total: alerts.length };
  }, [alerts]);

  const hasActiveFilters = filterStatus || filterPriority || filterIndicator || search;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold text-slate-900">Alertas de riesgo</h1>
          <HelpTooltip text="Las alertas son señales preventivas generadas por el motor de reglas al analizar los datos de contratación. Cada alerta explica qué regla se activó, con qué datos y bajo qué umbral. Haga clic en una alerta para ver el detalle completo." />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Señales preventivas generadas por el motor de reglas. Cada alerta explica qué regla se activó, con qué datos y bajo qué umbral.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <span className="text-xs text-slate-500">Total de alertas</span>
          <p className="text-2xl font-bold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-xs text-red-700">Prioridad alta</span>
          <p className="text-2xl font-bold text-red-800">{summary.byPriority.high}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-xs text-amber-700">Prioridad media</span>
          <p className="text-2xl font-bold text-amber-800">{summary.byPriority.medium}</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-xs text-blue-700">Prioridad baja</span>
          <p className="text-2xl font-bold text-blue-800">{summary.byPriority.low}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filtros</span>
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterIndicator(''); }}
              className="text-xs text-blue-700 hover:text-blue-800 flex items-center gap-1 ml-auto"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título, código o descripción..."
              className="input-field pl-9"
            />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field">
            <option value="">Todos los estados</option>
            {Object.entries(ALERT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="input-field">
            <option value="">Todas las prioridades</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select value={filterIndicator} onChange={(e) => setFilterIndicator(e.target.value)} className="input-field">
            <option value="">Todos los indicadores</option>
            {Object.entries(INDICATOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Alert cards */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">Cargando alertas...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-400">No hay alertas que coincidan con los filtros.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              indicator={indicators[alert.indicator_code]}
              isExpanded={expandedId === alert.id}
              onToggle={() => setExpandedId(expandedId === alert.id ? null : alert.id)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}

      {/* Preventive notice */}
      <InfoNote variant="warning">
        Las alertas son señales preventivas generadas mediante reglas de análisis. No constituyen por sí mismas evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requieren revisión técnica y documental.
      </InfoNote>
    </div>
  );
}

// ---- Alert Card ----
function AlertCard({ alert, indicator, isExpanded, onToggle, onNavigate }: {
  alert: Alert;
  indicator?: IndicatorMeta;
  isExpanded: boolean;
  onToggle: () => void;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}) {
  const dataUsed = alert.data_used as Record<string, unknown> | null;
  const Icon = INDICATOR_ICONS[alert.indicator_code] || AlertTriangle;
  const isHigh = alert.priority === 'high';

  return (
    <div className={`card overflow-hidden transition-all duration-200 ${isHigh ? 'border-l-4 border-l-red-500' : alert.priority === 'medium' ? 'border-l-4 border-l-amber-500' : 'border-l-4 border-l-blue-500'}`}>
      {/* Card header (always visible) */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isHigh ? 'bg-red-100' : alert.priority === 'medium' ? 'bg-amber-100' : 'bg-blue-100'
          }`}>
            <Icon className={`w-4.5 h-4.5 ${isHigh ? 'text-red-700' : alert.priority === 'medium' ? 'text-amber-700' : 'text-blue-700'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono text-slate-400">{alert.alert_code}</span>
              <span className={`badge ${PRIORITY_COLORS[alert.priority] || ''}`}>
                {PRIORITY_LABELS[alert.priority] || alert.priority}
              </span>
              <span className={`badge ${ALERT_STATUS_COLORS[alert.status] || ''}`}>
                {ALERT_STATUS_LABELS[alert.status] || alert.status}
              </span>
              {alert.is_demo && <span className="badge bg-blue-50 text-blue-700 border-blue-200">Demo</span>}
            </div>
            <p className="text-sm font-semibold text-slate-800 truncate">{alert.title}</p>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {INDICATOR_LABELS[alert.indicator_code] || alert.indicator_code}
              {dataUsed?.process_id ? ` · Proceso ${String(dataUsed.process_id)}` : null}
              {dataUsed?.institution_name ? ` · ${String(dataUsed.institution_name)}` : null}
            </p>
          </div>
          <div className="flex-shrink-0 pt-1">
            {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50/50">
          {/* Descripción del análisis */}
          <Section icon={AlertTriangle} title="Descripción del análisis">
            <p className="text-sm text-slate-700 leading-relaxed">{alert.description || 'Sin descripción disponible.'}</p>
          </Section>

          {/* Cálculo realizado */}
          {alert.calculation_detail && (
            <Section icon={Calculator} title="Cálculo realizado">
              <p className="text-sm text-slate-700 leading-relaxed font-mono bg-white rounded-lg p-3 border border-slate-200">
                {alert.calculation_detail}
              </p>
            </Section>
          )}

          {/* Datos utilizados */}
          {dataUsed ? (
            <Section icon={Database} title="Datos utilizados">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(dataUsed).filter(([, v]) => v !== null && v !== undefined).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
                    <span className="text-xs text-slate-400 font-mono flex-shrink-0">{key}</span>
                    <span className="text-xs font-semibold text-slate-700 truncate">
                      {typeof value === 'number' && key.includes('amount')
                        ? `$${value.toLocaleString('es-SV', { maximumFractionDigits: 0 })}`
                        : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {/* Umbral aplicado */}
          {alert.threshold_applied && (
            <Section icon={Scale} title="Umbral aplicado">
              <p className="text-sm text-slate-700 leading-relaxed bg-blue-50 rounded-lg p-3 border border-blue-200">
                {alert.threshold_applied}
              </p>
            </Section>
          )}

          {/* Metodología del indicador */}
          {indicator && (
            <Section icon={FileText} title="Metodología del indicador">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Descripción</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{indicator.description}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Metodología</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{indicator.methodology}</p>
                </div>
                {indicator.formula && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Fórmula</p>
                    <p className="text-sm text-slate-600 font-mono bg-white rounded-lg p-2.5 border border-slate-200">{indicator.formula}</p>
                  </div>
                )}
                {indicator.exclusions && (
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Exclusiones</p>
                    <p className="text-sm text-slate-700 leading-relaxed">{indicator.exclusions}</p>
                  </div>
                )}
                {INDICATOR_UNIT[alert.indicator_code] && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 rounded-lg px-3 py-2">
                    <Info className="w-3.5 h-3.5 text-slate-400" />
                    {INDICATOR_UNIT[alert.indicator_code]}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Datos del proceso relacionado */}
          {dataUsed && (dataUsed.institution_name || dataUsed.supplier_name) ? (
            <Section icon={Building2} title="Contexto del proceso">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {dataUsed.institution_name ? (
                  <ContextItem icon={Building2} label="Institución" value={String(dataUsed.institution_name)} />
                ) : null}
                {dataUsed.supplier_name ? (
                  <ContextItem icon={Factory} label="Proveedor" value={String(dataUsed.supplier_name)} />
                ) : null}
                {dataUsed.procurement_method ? (
                  <ContextItem icon={FileText} label="Modalidad" value={String(dataUsed.procurement_method)} />
                ) : null}
                {dataUsed.awarded_amount != null && (
                  <ContextItem icon={TrendingUp} label="Monto adjudicado" value={`$${Number(dataUsed.awarded_amount).toLocaleString('es-SV', { maximumFractionDigits: 0 })}`} />
                )}
              </div>
            </Section>
          ) : null}

          {/* Metadata footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span>{new Date(alert.created_at).toLocaleString('es-SV')}</span>
              {alert.upload_id && <span className="font-mono">Lote: {alert.upload_id.slice(0, 8)}</span>}
            </div>
            <button
              onClick={() => onNavigate('alert-detail', { id: alert.id })}
              className="text-sm text-blue-700 hover:text-blue-800 flex items-center gap-1 font-medium"
            >
              Ver detalle completo <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Helper components ----
function Section({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ContextItem({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-xs font-semibold text-slate-700 truncate">{value}</p>
      </div>
    </div>
  );
}
