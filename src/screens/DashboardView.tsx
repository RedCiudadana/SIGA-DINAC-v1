import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  AlertTriangle, FileBarChart, Building2, ArrowRight,
  Download, Search, ArrowUpDown, ChevronRight, BarChart3,
  Factory, Flag, Clock, CheckCircle2, Layers, Filter, X,
  FileSpreadsheet, Upload as UploadIcon, Cpu, FileSearch, ClipboardCheck, Lightbulb,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  PRIORITY_LABELS, PRIORITY_COLORS,
  ALERT_STATUS_LABELS, ALERT_STATUS_COLORS,
  INDICATOR_LABELS,
  type ProcurementProcess,
} from '@/types';
import type { ViewKey } from '@/components/AppShell';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { HelpTooltip, InfoNote } from '@/components/HelpUI';

// ---- Constants ----
const METHOD_LABELS: Record<string, string> = {
  LP: 'Licitación Pública',
  LC: 'Licitación por Catálogo',
  CD: 'Contratación Directa',
  CE: 'Contratación de Emergencia',
  LI: 'Licitación Internacional',
  CP: 'Compra Pública',
  EB: 'Express Buy',
};

// Group modalities into management categories
const METHOD_CATEGORIES: Record<string, 'competitive' | 'comparison' | 'direct' | 'special' | 'other'> = {
  LP: 'competitive', LI: 'competitive', EB: 'competitive',
  LC: 'comparison', CP: 'comparison',
  CD: 'direct',
  CE: 'special',
};
const CATEGORY_LABELS: Record<string, string> = {
  competitive: 'Licitación competitiva',
  comparison: 'Comparación de precios',
  direct: 'Compra directa',
  special: 'Procedimiento especial',
  other: 'Otras modalidades',
};
const CATEGORY_ORDER = ['competitive', 'comparison', 'direct', 'special', 'other'];

// Which methods are eligible for each indicator
const INDICATOR_ELIGIBLE_METHODS: Record<string, Set<string>> = {
  R018: new Set(['LP', 'LC', 'LI', 'EB', 'CP']),
  R040: new Set(['LP', 'LC', 'CD', 'CE', 'LI', 'CP', 'EB']),
  R013: new Set(['LP', 'LC', 'LI', 'EB', 'CP']),
  R063: new Set(['LP', 'LC', 'CD', 'CE', 'LI', 'CP', 'EB']),
  R003: new Set(['LP', 'LC', 'LI', 'EB', 'CP']),
};

const INDICATOR_ORDER = [
  'R018', 'R040', 'R013',
  'R063', 'R003',
];

const REVIEW_FLOW_STATES = ['new', 'assigned', 'in_review', 'requires_info', 'referred', 'discarded', 'closed'];
const ACTIVE_REVIEW_STATES = ['new', 'assigned', 'in_review', 'requires_info'];
const CLOSED_STATES = ['discarded', 'closed'];

// ---- Types ----
interface AlertRow {
  id: string; alert_code: string; title: string;
  priority: string; status: string; indicator_code: string;
  created_at: string; data_used: Record<string, unknown> | null;
}
interface MonthlyPoint {
  month: string;
  total: number;
  withAlerts: number;
  highPriority: number;
}
interface IndicatorFreq {
  code: string;
  triggered: number;
  eligible: number;
  rate: number;
}
interface InstitutionBreakdown {
  name: string;
  total: number;
  noAlert: number;
  withAlert: number;
  highPriority: number;
}
interface MethodBreakdown {
  category: string;
  total: number;
  withAlerts: number;
  rate: number;
}
interface ReviewStatusBreakdown {
  status: string;
  count: number;
  pct: number;
}

interface DashboardData {
  totalProcesses: number;
  totalAmount: number;
  processesWithAlerts: number;
  pctWithAlerts: number;
  highPriorityPending: number;
  alertsReviewed: number;
  totalAlerts: number;
  monthlyTrend: MonthlyPoint[];
  indicatorFreq: IndicatorFreq[];
  institutions: InstitutionBreakdown[];
  methods: MethodBreakdown[];
  reviewStatus: ReviewStatusBreakdown[];
  recentAlerts: { id: string; alert_code: string; title: string; priority: string; status: string; indicator_code: string; created_at: string }[];
  processes: ProcurementProcess[];
  processAlertMap: Record<string, Set<string>>;
  alertStatusMap: Record<string, string>;
  alertPriorityMap: Record<string, string>;
  dataDate: string;
}

type SortField = 'process_id' | 'institution_name' | 'awarded_amount' | 'award_date' | 'alert_count';
type SortDir = 'asc' | 'desc';

export function DashboardView({ onNavigate }: { onNavigate: (view: ViewKey, params?: Record<string, string>) => void }) {
  const { profile, hasPermission, logAction } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // Global filters
  const [globalPeriod, setGlobalPeriod] = useState<string>('');
  const [globalMethod, setGlobalMethod] = useState<string>('');
  const [globalInstitution, setGlobalInstitution] = useState<string>('');

  // Table state
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterInstitution, setFilterInstitution] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [sortField, setSortField] = useState<SortField>('award_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Institution chart toggle
  const [showAllInstitutions, setShowAllInstitutions] = useState(false);

  const load = useCallback(async () => {
    const { count: processCount } = await supabase
      .from('procurement_processes').select('*', { count: 'exact', head: true }).eq('is_active', true);

    const { data: allProcs } = await supabase
      .from('procurement_processes')
      .select('*').eq('is_active', true).order('created_at', { ascending: false });

    const { data: allAlerts } = await supabase
      .from('alerts')
      .select('id, alert_code, title, priority, status, indicator_code, created_at, data_used')
      .eq('is_deleted', false).order('created_at', { ascending: false }) as { data: AlertRow[] | null };

    const procs = (allProcs || []) as ProcurementProcess[];
    const alerts = (allAlerts || []) as AlertRow[];

    // Build process_id -> set of indicator_codes that triggered
    const processAlertMap: Record<string, Set<string>> = {};
    const alertStatusMap: Record<string, string> = {};
    const alertPriorityMap: Record<string, string> = {};
    alerts.forEach((a) => {
      alertStatusMap[a.id] = a.status;
      alertPriorityMap[a.id] = a.priority;
      const du = a.data_used as Record<string, unknown> | null;
      const pid = du?.process_id as string | undefined;
      if (pid) {
        if (!processAlertMap[pid]) processAlertMap[pid] = new Set();
        processAlertMap[pid].add(a.indicator_code);
      }
    });

    const totalAmount = procs.reduce((s, p) => s + (p.awarded_amount || 0), 0);
    const procWithAlerts = procs.filter((p) => p.alert_count > 0).length;

    // KPI: alerts reviewed (closed or discarded / total)
    const reviewedCount = alerts.filter((a) => CLOSED_STATES.includes(a.status)).length;
    const highPriorityPending = alerts.filter(
      (a) => a.priority === 'high' && ACTIVE_REVIEW_STATES.includes(a.status)
    ).length;

    // Monthly trend: processes analyzed, with alerts, high priority by award_date month
    const monthMap: Record<string, { total: number; withAlerts: number; highPriority: number }> = {};
    procs.forEach((p) => {
      const dateStr = p.award_date || p.publication_date || p.created_at;
      const m = dateStr.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { total: 0, withAlerts: 0, highPriority: 0 };
      monthMap[m].total++;
      if (p.alert_count > 0) monthMap[m].withAlerts++;
      if (p.priority === 'high') monthMap[m].highPriority++;
    });
    const monthlyTrend = Object.entries(monthMap)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Indicator frequency: triggered, eligible, rate
    const indicatorFreq: IndicatorFreq[] = INDICATOR_ORDER.map((code) => {
      const eligibleMethods = INDICATOR_ELIGIBLE_METHODS[code];
      const eligible = procs.filter((p) => {
        const m = p.procurement_method || '';
        return eligibleMethods.has(m);
      }).length;
      const triggered = procs.filter((p) => {
        const m = p.procurement_method || '';
        return eligibleMethods.has(m) && processAlertMap[p.process_id]?.has(code);
      }).length;
      return {
        code,
        triggered,
        eligible,
        rate: eligible > 0 ? (triggered / eligible) * 100 : 0,
      };
    }).sort((a, b) => b.triggered - a.triggered);

    // Institution breakdown: no alert, with alert, high priority
    const instMap: Record<string, InstitutionBreakdown> = {};
    procs.forEach((p) => {
      const name = p.institution_name || 'Sin especificar';
      if (!instMap[name]) instMap[name] = { name, total: 0, noAlert: 0, withAlert: 0, highPriority: 0 };
      instMap[name].total++;
      if (p.alert_count > 0) {
        instMap[name].withAlert++;
        if (p.priority === 'high') instMap[name].highPriority++;
      } else {
        instMap[name].noAlert++;
      }
    });
    const institutions = Object.values(instMap).sort((a, b) => b.withAlert - a.withAlert);

    // Method breakdown by category
    const catMap: Record<string, MethodBreakdown> = {};
    CATEGORY_ORDER.forEach((cat) => { catMap[cat] = { category: cat, total: 0, withAlerts: 0, rate: 0 }; });
    procs.forEach((p) => {
      const m = p.procurement_method || '';
      const cat = METHOD_CATEGORIES[m] || 'other';
      catMap[cat].total++;
      if (p.alert_count > 0) catMap[cat].withAlerts++;
    });
    const methods = CATEGORY_ORDER
      .map((cat) => ({ ...catMap[cat], rate: catMap[cat].total > 0 ? (catMap[cat].withAlerts / catMap[cat].total) * 100 : 0 }))
      .filter((m) => m.total > 0);

    // Review status breakdown
    const statusMap: Record<string, number> = {};
    alerts.forEach((a) => { statusMap[a.status] = (statusMap[a.status] || 0) + 1; });
    const reviewStatus = REVIEW_FLOW_STATES
      .filter((s) => statusMap[s] !== undefined)
      .map((s) => ({ status: s, count: statusMap[s] || 0, pct: alerts.length > 0 ? ((statusMap[s] || 0) / alerts.length) * 100 : 0 }));

    setData({
      totalProcesses: processCount || 0,
      totalAmount,
      processesWithAlerts: procWithAlerts,
      pctWithAlerts: procs.length > 0 ? (procWithAlerts / procs.length) * 100 : 0,
      highPriorityPending,
      alertsReviewed: reviewedCount,
      totalAlerts: alerts.length,
      monthlyTrend,
      indicatorFreq,
      institutions,
      methods,
      reviewStatus,
      recentAlerts: alerts.slice(0, 8),
      processes: procs,
      processAlertMap,
      alertStatusMap,
      alertPriorityMap,
      dataDate: new Date().toLocaleDateString('es-SV', { year: 'numeric', month: 'long', day: 'numeric' }),
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Apply global filters to processes
  const filteredProcesses = useMemo(() => {
    if (!data) return [];
    let result = data.processes;
    if (globalPeriod) {
      result = result.filter((p) => {
        const dateStr = p.award_date || p.publication_date || '';
        return dateStr.slice(0, 7) === globalPeriod;
      });
    }
    if (globalMethod) result = result.filter((p) => p.procurement_method === globalMethod);
    if (globalInstitution) result = result.filter((p) => (p.institution_name || '') === globalInstitution);
    return result;
  }, [data, globalPeriod, globalMethod, globalInstitution]);

  // Recompute chart data from filtered processes
  const filteredChartData = useMemo(() => {
    const procs = filteredProcesses;
    const procWithAlerts = procs.filter((p) => p.alert_count > 0).length;

    // Monthly trend from filtered
    const monthMap: Record<string, { total: number; withAlerts: number; highPriority: number }> = {};
    procs.forEach((p) => {
      const dateStr = p.award_date || p.publication_date || p.created_at;
      const m = dateStr.slice(0, 7);
      if (!monthMap[m]) monthMap[m] = { total: 0, withAlerts: 0, highPriority: 0 };
      monthMap[m].total++;
      if (p.alert_count > 0) monthMap[m].withAlerts++;
      if (p.priority === 'high') monthMap[m].highPriority++;
    });
    const monthlyTrend = Object.entries(monthMap)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Indicator freq from filtered
    const indicatorFreq = INDICATOR_ORDER.map((code) => {
      const eligibleMethods = INDICATOR_ELIGIBLE_METHODS[code];
      const eligible = procs.filter((p) => eligibleMethods.has(p.procurement_method || '')).length;
      const triggered = procs.filter((p) => eligibleMethods.has(p.procurement_method || '') && data?.processAlertMap[p.process_id]?.has(code)).length;
      return { code, triggered, eligible, rate: eligible > 0 ? (triggered / eligible) * 100 : 0 };
    }).sort((a, b) => b.triggered - a.triggered);

    // Institutions from filtered
    const instMap: Record<string, InstitutionBreakdown> = {};
    procs.forEach((p) => {
      const name = p.institution_name || 'Sin especificar';
      if (!instMap[name]) instMap[name] = { name, total: 0, noAlert: 0, withAlert: 0, highPriority: 0 };
      instMap[name].total++;
      if (p.alert_count > 0) {
        instMap[name].withAlert++;
        if (p.priority === 'high') instMap[name].highPriority++;
      } else {
        instMap[name].noAlert++;
      }
    });
    const institutions = Object.values(instMap).sort((a, b) => b.withAlert - a.withAlert);

    // Methods from filtered
    const catMap: Record<string, MethodBreakdown> = {};
    CATEGORY_ORDER.forEach((cat) => { catMap[cat] = { category: cat, total: 0, withAlerts: 0, rate: 0 }; });
    procs.forEach((p) => {
      const cat = METHOD_CATEGORIES[p.procurement_method || ''] || 'other';
      catMap[cat].total++;
      if (p.alert_count > 0) catMap[cat].withAlerts++;
    });
    const methods = CATEGORY_ORDER
      .map((cat) => ({ ...catMap[cat], rate: catMap[cat].total > 0 ? (catMap[cat].withAlerts / catMap[cat].total) * 100 : 0 }))
      .filter((m) => m.total > 0);

    return { procs, procWithAlerts, monthlyTrend, indicatorFreq, institutions, methods };
  }, [filteredProcesses, data]);

  // Table filtering
  const methods_list = useMemo(() => [...new Set(data?.processes.map((p) => p.procurement_method).filter(Boolean))] as string[], [data]);
  const institutions_list = useMemo(() => [...new Set(data?.processes.map((p) => p.institution_name).filter(Boolean))] as string[], [data]);
  const periods_list = useMemo(() => {
    if (!data) return [] as string[];
    const set = new Set<string>();
    data.processes.forEach((p) => {
      const d = p.award_date || p.publication_date || '';
      if (d) set.add(d.slice(0, 7));
    });
    return [...set].sort().reverse();
  }, [data]);

  const filtered = useMemo(() => {
    let result = filteredProcesses;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((p) =>
        (p.process_id || '').toLowerCase().includes(s) ||
        (p.institution_name || '').toLowerCase().includes(s) ||
        (p.supplier_name || '').toLowerCase().includes(s) ||
        (p.procurement_description || '').toLowerCase().includes(s)
      );
    }
    if (filterMethod && !globalMethod) result = result.filter((p) => p.procurement_method === filterMethod);
    if (filterInstitution && !globalInstitution) result = result.filter((p) => p.institution_name === filterInstitution);
    if (filterPriority) result = result.filter((p) => p.priority === filterPriority);

    return [...result].sort((a, b) => {
      let av: string | number | null = a[sortField];
      let bv: string | number | null = b[sortField];
      if (av === null) av = '';
      if (bv === null) bv = '';
      if (typeof av === 'string' && typeof bv === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [filteredProcesses, search, filterMethod, filterInstitution, filterPriority, globalMethod, globalInstitution, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleExport = () => {
    if (!data) return;
    const csv = [
      ['Métrica', 'Valor'].join(','),
      ['Procesos analizados', data.totalProcesses].join(','),
      ['Monto analizado', data.totalAmount].join(','),
      ['Procesos con alertas', `${data.processesWithAlerts} (${data.pctWithAlerts.toFixed(1)}%)`].join(','),
      ['Casos alta prioridad pendientes', data.highPriorityPending].join(','),
      ['Alertas revisadas (cerradas+descartadas)', `${data.alertsReviewed} de ${data.totalAlerts}`].join(','),
      ['', ''],
      ['Frecuencia por indicador', 'Activados', 'Elegibles', 'Tasa %'].join(','),
      ...data.indicatorFreq.map((i) => [INDICATOR_LABELS[i.code] || i.code, i.triggered, i.eligible, i.rate.toFixed(1)].join(',')),
      ['', ''],
      ['Por institución', 'Total', 'Con alerta', 'Alta prioridad'].join(','),
      ...data.institutions.map((i) => [i.name, i.total, i.withAlert, i.highPriority].join(',')),
      ['', ''],
      ['Por modalidad', 'Total', 'Con alerta', 'Tasa %'].join(','),
      ...data.methods.map((m) => [CATEGORY_LABELS[m.category], m.total, m.withAlerts, m.rate.toFixed(1)].join(',')),
      ['', ''],
      ['Estado de revisión', 'Cantidad', '%'].join(','),
      ...data.reviewStatus.map((r) => [ALERT_STATUS_LABELS[r.status] || r.status, r.count, r.pct.toFixed(1)].join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tablero_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    logAction('dashboard_export', 'reports', 'Exportación del tablero principal');
  };

  const clearGlobalFilters = () => {
    setGlobalPeriod('');
    setGlobalMethod('');
    setGlobalInstitution('');
  };

  const hasGlobalFilters = globalPeriod || globalMethod || globalInstitution;

  if (loading || !data) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Cargando tablero...</div>;
  }

  const fmtMoney = (n: number) => `$${n.toLocaleString('es-SV', { maximumFractionDigits: 0 })}`;
  const eligibleCount = filteredProcesses.length;
  const reviewedPct = data.totalAlerts > 0 ? (data.alertsReviewed / data.totalAlerts) * 100 : 0;

  // Period label for chart metadata
  const periodLabel = globalPeriod
    ? formatMonthFull(globalPeriod)
    : periods_list.length > 0
      ? `${formatMonthFull(periods_list[periods_list.length - 1])} – ${formatMonthFull(periods_list[0])}`
      : 'Sin datos';

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Tablero' }]} onNavigate={onNavigate} />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tablero principal</h1>
          <p className="text-sm text-slate-500 mt-1">
            Resumen ejecutivo del sistema de alertas. {profile?.full_name}, {data.totalProcesses} procesos analizados.
          </p>
        </div>
        {hasPermission('export_reports') && (
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" /> Exportar
          </button>
        )}
      </div>

      {/* Guía paso a paso */}
      <HowItWorksSection onNavigate={onNavigate} hasPermission={hasPermission} />

      {/* Global filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Filtros globales</span>
          <HelpTooltip text="Estos filtros afectan todas las gráficas y la tabla de procesos. Úselos para acotar el análisis a un periodo, modalidad o institución específica." />
          {hasGlobalFilters && (
            <button onClick={clearGlobalFilters} className="ml-auto text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors">
              <X className="w-3 h-3" /> Limpiar filtros
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Periodo</label>
            <select value={globalPeriod} onChange={(e) => setGlobalPeriod(e.target.value)} className="input-field">
              <option value="">Todos los periodos</option>
              {periods_list.map((p) => <option key={p} value={p}>{formatMonthFull(p)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Modalidad</label>
            <select value={globalMethod} onChange={(e) => setGlobalMethod(e.target.value)} className="input-field">
              <option value="">Todas las modalidades</option>
              {methods_list.map((m) => <option key={m} value={m}>{METHOD_LABELS[m] || m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">Institución</label>
            <select value={globalInstitution} onChange={(e) => setGlobalInstitution(e.target.value)} className="input-field">
              <option value="">Todas las instituciones</option>
              {institutions_list.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* 6 KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard icon={FileBarChart} label="Procesos analizados" value={data.totalProcesses.toLocaleString('es-SV')} sub={`${fmtMoney(data.totalAmount)}`} color="blue" help="Número de process_id distintos cargados en el sistema. El monto corresponde a la suma adjudicada." />
        <KpiCard icon={Factory} label="Monto analizado" value={fmtMoney(data.totalAmount)} sub="Suma adjudicada" color="slate" help="Suma del monto adjudicado de todos los procesos analizados." />
        <KpiCard icon={AlertTriangle} label="Procesos con alertas" value={data.processesWithAlerts.toLocaleString('es-SV')} sub={`de ${data.totalProcesses} procesos`} color="amber" help="Procesos distintos con al menos una bandera roja activada." />
        <KpiCard icon={Flag} label="% con alertas" value={`${data.pctWithAlerts.toFixed(1)}%`} sub="Procesos con alerta ÷ elegibles" color="slate" help="Porcentaje de procesos que tienen al menos una alerta. Se calcula sobre procesos elegibles, no sobre compras directas que no requieren competencia." />
        <KpiCard icon={Clock} label="Alta prioridad pendientes" value={data.highPriorityPending.toLocaleString('es-SV')} sub="Casos abiertos alta prioridad" color="red" help="Casos abiertos (no cerrados ni descartados) con prioridad alta. Requieren atención prioritaria." />
        <KpiCard icon={CheckCircle2} label="Alertas revisadas" value={`${data.alertsReviewed.toLocaleString('es-SV')}`} sub={`${reviewedPct.toFixed(0)}% de ${data.totalAlerts}`} color="green" help="Casos cerrados o descartados divididos entre el total de alertas. Mide el avance de la gestión de revisión." />
      </div>

      {/* Chart 1: Monthly trend — line chart */}
      <div className="card p-5">
        <ChartMeta
          title="Evolución mensual"
          icon={BarChart3}
          help="¿Las señales preventivas aumentan, disminuyen o se concentran en determinados meses? Se muestran tres series: procesos analizados, procesos con alertas y procesos con prioridad alta."
          period={periodLabel}
          updated={data.dataDate}
          eligibleCount={eligibleCount}
          filters={hasGlobalFilters ? 'Periodo, modalidad, institución' : 'Ninguno'}
          source="Datos de contratación cargados"
        />
        {filteredChartData.monthlyTrend.length === 0 ? (
          <EmptyChart />
        ) : (
          <LineChartMulti data={filteredChartData.monthlyTrend} />
        )}
      </div>

      {/* Chart 2: Indicator frequency — horizontal bars */}
      <div className="card p-5">
        <ChartMeta
          title="Frecuencia por indicador"
          icon={BarChart3}
          help="Muestra los cinco indicadores ordenados por tasa de activación. Cada barra indica cuántos procesos activaron la regla sobre cuántos eran elegibles. No se cuentan filas de alertas porque un mismo proceso puede generar varias."
          period={periodLabel}
          updated={data.dataDate}
          eligibleCount={eligibleCount}
          filters={hasGlobalFilters ? 'Periodo, modalidad, institución' : 'Ninguno'}
          source="Motor de reglas SIGA-DINAC"
        />
        <div className="space-y-4 mt-4">
          {filteredChartData.indicatorFreq.map((ind, idx) => {
            const maxTriggered = Math.max(...filteredChartData.indicatorFreq.map((i) => i.triggered), 1);
            return (
              <div key={ind.code}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-900 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                    <span className="text-sm font-medium text-slate-700">{INDICATOR_LABELS[ind.code] || ind.code}</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-800">{ind.triggered}</span>
                    {' de '}
                    <span className="font-semibold text-slate-800">{ind.eligible}</span>
                    {' procesos elegibles — '}
                    <span className="font-bold text-blue-700">{ind.rate.toFixed(1)}%</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${(ind.triggered / maxTriggered) * 100}%`, minWidth: ind.triggered > 0 ? '8px' : '0' }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart 3: Institutions — stacked 100% bars */}
      <div className="card p-5">
        <ChartMeta
          title="Instituciones con mayor incidencia"
          icon={Building2}
          help="Cada barra representa una institución dividida en procesos sin alerta (gris), con alerta (ámbar) y con prioridad alta (rojo). Solo se muestran instituciones con un mínimo de procesos para evitar distorsiones."
          period={periodLabel}
          updated={data.dataDate}
          eligibleCount={eligibleCount}
          filters={hasGlobalFilters ? 'Periodo, modalidad, institución' : 'Ninguno'}
          source="Datos de contratación cargados"
        />
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowAllInstitutions(false)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${!showAllInstitutions ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Top 10
          </button>
          <button
            onClick={() => setShowAllInstitutions(true)}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${showAllInstitutions ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Mostrar todas
          </button>
        </div>
        {filteredChartData.institutions.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="space-y-3">
            {(showAllInstitutions ? filteredChartData.institutions : filteredChartData.institutions.slice(0, 10)).map((inst) => {
              const noAlertPct = inst.total > 0 ? (inst.noAlert / inst.total) * 100 : 0;
              const withAlertPct = inst.total > 0 ? ((inst.withAlert - inst.highPriority) / inst.total) * 100 : 0;
              const highPct = inst.total > 0 ? (inst.highPriority / inst.total) * 100 : 0;
              return (
                <div key={inst.name}>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600 truncate" title={inst.name}>{inst.name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                      {inst.withAlert} con alerta / {inst.total} total
                    </span>
                  </div>
                  <div className="flex h-5 rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-slate-300 transition-all duration-500" style={{ width: `${noAlertPct}%` }} title={`Sin alerta: ${inst.noAlert}`} />
                    <div className="bg-amber-400 transition-all duration-500" style={{ width: `${withAlertPct}%` }} title={`Con alerta: ${inst.withAlert - inst.highPriority}`} />
                    <div className="bg-red-500 transition-all duration-500" style={{ width: `${highPct}%` }} title={`Alta prioridad: ${inst.highPriority}`} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
          <LegendDot color="bg-slate-300" label="Sin alerta" />
          <LegendDot color="bg-amber-400" label="Con alerta" />
          <LegendDot color="bg-red-500" label="Alta prioridad" />
        </div>
      </div>

      {/* Chart 4: Methods — grouped bars */}
      <div className="card p-5">
        <ChartMeta
          title="Alertas por modalidad de contratación"
          icon={FileBarChart}
          help="Compara la cantidad y el porcentaje de procesos alertados dentro de cada categoría de modalidad. Las modalidades se agrupan según su naturaleza competitiva."
          period={periodLabel}
          updated={data.dataDate}
          eligibleCount={eligibleCount}
          filters={hasGlobalFilters ? 'Periodo, modalidad, institución' : 'Ninguno'}
          source="Datos de contratación cargados"
        />
        {filteredChartData.methods.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="space-y-3 mt-4">
            {filteredChartData.methods.map((m) => {
              const maxTotal = Math.max(...filteredChartData.methods.map((x) => x.total), 1);
              return (
                <div key={m.category}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-700">{CATEGORY_LABELS[m.category]}</span>
                    <span className="text-xs text-slate-500">
                      <span className="font-semibold text-amber-700">{m.withAlerts}</span>
                      {' de '}
                      <span className="font-semibold text-slate-700">{m.total}</span>
                      {' — '}
                      <span className="font-bold text-blue-700">{m.rate.toFixed(1)}%</span>
                    </span>
                  </div>
                  <div className="flex h-6 rounded-full overflow-hidden bg-slate-100">
                    <div className="bg-slate-300 transition-all duration-500" style={{ width: `${100 - m.rate}%` }} />
                    <div className="bg-amber-500 transition-all duration-500" style={{ width: `${m.rate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
          <LegendDot color="bg-slate-300" label="Sin alerta" />
          <LegendDot color="bg-amber-500" label="Con alerta" />
        </div>
      </div>

      {/* Chart 5: Review status — stacked bar */}
      <div className="card p-5">
        <ChartMeta
          title="Estado de revisión"
          icon={CheckCircle2}
          help="Convierte el tablero en una herramienta de gestión: muestra la carga pendiente (nuevas, asignadas, en revisión) versus las ya resueltas (remitidas, descartadas, cerradas)."
          period={periodLabel}
          updated={data.dataDate}
          eligibleCount={eligibleCount}
          filters={hasGlobalFilters ? 'Periodo, modalidad, institución' : 'Ninguno'}
          source="Bitácora de alertas"
        />
        {data.reviewStatus.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="mt-4">
            {/* Stacked horizontal bar */}
            <div className="flex h-8 rounded-lg overflow-hidden bg-slate-100">
              {data.reviewStatus.map((r) => (
                <div
                  key={r.status}
                  className={`transition-all duration-500 flex items-center justify-center ${STATUS_BAR_COLORS[r.status] || 'bg-slate-300'}`}
                  style={{ width: `${r.pct}%`, minWidth: r.count > 0 ? '20px' : '0' }}
                  title={`${ALERT_STATUS_LABELS[r.status] || r.status}: ${r.count} (${r.pct.toFixed(1)}%)`}
                >
                  {r.pct > 5 && <span className="text-[10px] font-bold text-white">{r.count}</span>}
                </div>
              ))}
            </div>
            {/* Legend with counts */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mt-4">
              {data.reviewStatus.map((r) => (
                <div key={r.status} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${STATUS_BAR_COLORS[r.status] || 'bg-slate-300'}`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 truncate">{ALERT_STATUS_LABELS[r.status] || r.status}</p>
                    <p className="text-xs font-semibold text-slate-700">{r.count}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent alerts */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Alertas recientes</h2>
          {hasPermission('view_alerts') && (
            <button onClick={() => onNavigate('alerts')} className="text-sm text-blue-700 hover:text-blue-800 flex items-center gap-1">
              Ver todas <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-100">
          {data.recentAlerts.length === 0 ? (
            <p className="p-5 text-sm text-slate-400">No hay alertas recientes.</p>
          ) : (
            data.recentAlerts.map((alert) => (
              <button
                key={alert.id}
                onClick={() => onNavigate('alert-detail', { id: alert.id })}
                className="w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-slate-400">{alert.alert_code}</span>
                    <span className={`badge ${PRIORITY_COLORS[alert.priority] || ''}`}>{PRIORITY_LABELS[alert.priority] || alert.priority}</span>
                    <span className={`badge ${ALERT_STATUS_COLORS[alert.status] || ''}`}>{ALERT_STATUS_LABELS[alert.status] || alert.status}</span>
                  </div>
                  <p className="text-sm text-slate-700 truncate">{alert.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{INDICATOR_LABELS[alert.indicator_code] || alert.indicator_code}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Processes table (drill-down) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Procesos de contratación</h2>
            <HelpTooltip text="Tabla de detalle con todos los procesos. Use los filtros para acotar y hacer clic en una fila para ver el expediente completo." />
          </div>
          <span className="text-xs text-slate-400">{filtered.length} de {data.processes.length}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="input-field pl-9" />
          </div>
          <select value={filterInstitution} onChange={(e) => setFilterInstitution(e.target.value)} className="input-field" disabled={!!globalInstitution}>
            <option value="">Todas las instituciones</option>
            {institutions_list.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="input-field" disabled={!!globalMethod}>
            <option value="">Todas las modalidades</option>
            {methods_list.map((m) => <option key={m} value={m}>{METHOD_LABELS[m] || m}</option>)}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="input-field">
            <option value="">Todas las prioridades</option>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-header cursor-pointer" onClick={() => handleSort('process_id')}>
                  <span className="flex items-center gap-1">Código <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="table-header cursor-pointer" onClick={() => handleSort('institution_name')}>
                  <span className="flex items-center gap-1">Institución <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="table-header">Objeto</th>
                <th className="table-header">Modalidad</th>
                <th className="table-header">Oferentes</th>
                <th className="table-header">Proveedor</th>
                <th className="table-header cursor-pointer" onClick={() => handleSort('awarded_amount')}>
                  <span className="flex items-center gap-1">Monto <ArrowUpDown className="w-3 h-3" /></span>
                </th>
                <th className="table-header">Banderas</th>
                <th className="table-header">Prioridad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="table-cell text-center text-slate-400 py-8">No hay procesos que coincidan.</td></tr>
              ) : (
                filtered.slice(0, 100).map((proc) => (
                  <tr key={proc.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onNavigate('process-detail', { id: proc.process_id })}>
                    <td className="table-cell font-mono text-xs">{proc.process_id}</td>
                    <td className="table-cell text-xs">{proc.institution_name}</td>
                    <td className="table-cell text-xs max-w-xs truncate" title={proc.procurement_description || ''}>
                      {proc.procurement_description || '—'}
                    </td>
                    <td className="table-cell text-xs">{METHOD_LABELS[proc.procurement_method || ''] || proc.procurement_method || '—'}</td>
                    <td className="table-cell text-xs text-center">{proc.number_of_bidders ?? '—'}</td>
                    <td className="table-cell text-xs max-w-[150px] truncate" title={proc.supplier_name || ''}>
                      {proc.supplier_name || '—'}
                    </td>
                    <td className="table-cell text-xs font-mono">
                      {proc.awarded_amount ? fmtMoney(proc.awarded_amount) : '—'}
                    </td>
                    <td className="table-cell text-center">
                      {proc.alert_count > 0 ? (
                        <span className="badge bg-amber-50 text-amber-700 border-amber-200">{proc.alert_count}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {proc.priority && (
                        <span className={`badge ${PRIORITY_COLORS[proc.priority] || ''}`}>{PRIORITY_LABELS[proc.priority]}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            Mostrando 100 de {filtered.length} procesos. Use filtros para acotar.
          </div>
        )}
      </div>

      {/* Preventive notice */}
      <InfoNote variant="warning">
        Las alertas son señales preventivas generadas mediante reglas de análisis. No constituyen por sí mismas evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requieren revisión técnica y documental. Los porcentajes mostrados se calculan sobre procesos elegibles según el indicador.
      </InfoNote>

      {/* Institutional footer */}
      <InstitutionalFooter />
    </div>
  );
}

// ---- Institutional footer ----
const FOOTER_IMPLEMENTED_BY = [
  { name: 'Global Gateway', url: 'https://media.springernature.com/m685/springer-static/image/art%3A10.1057%2Fs41254-026-00441-9/MediaObjects/41254_2026_441_Fig1_HTML.png' },
  { name: 'Unión Europea', url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQjMp1mVg2XJPGG7eeNHDR-BW-QlIFxXuvO5BD9PrZKmQ&s' },
  { name: 'Cooperación Alemana', url: 'https://datos.minfin.gob.gt/img/cintillo/01_COOPERACION%20ALEMANA.png' },
  { name: 'GIZ', url: 'https://datos.minfin.gob.gt/img/cintillo/02_GIZ.png' },
];

const FOOTER_COORDINATED_BY = [
  { name: 'DINAC', url: 'https://dinac.gob.sv/wp-content/uploads/2026/01/LOGO-DINAC2.png' },
];

function InstitutionalFooter() {
  return (
    <div className="card p-6">
      <div className="space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">Implementado por</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {FOOTER_IMPLEMENTED_BY.map((org) => (
              <img
                key={org.name}
                src={org.url}
                alt={org.name}
                className="h-10 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ))}
          </div>
        </div>

        <div className="h-px bg-slate-100" />

        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-3">En coordinación</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {FOOTER_COORDINATED_BY.map((org) => (
              <img
                key={org.name}
                src={org.url}
                alt={org.name}
                className="h-10 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- How it works guide ----
function HowItWorksSection({ onNavigate, hasPermission }: {
  onNavigate: (view: ViewKey) => void;
  hasPermission: (code: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const steps = [
    {
      icon: FileSpreadsheet,
      title: 'Descargue la plantilla',
      description: 'Obtenga el archivo CSV con el formato correcto, incluyendo columnas para institución, proveedor, modalidad, montos y fechas. Puede descargarlo con datos de ejemplo o vacío.',
      action: hasPermission('upload_data') ? { label: 'Ir a carga de datos', view: 'upload' as ViewKey } : null,
      color: 'bg-blue-100 text-blue-700',
    },
    {
      icon: UploadIcon,
      title: 'Cargue sus datos',
      description: 'Seleccione el archivo CSV con los datos de contratación. El sistema valida automáticamente campos obligatorios, formatos numéricos, fechas y duplicados antes de procesar.',
      action: hasPermission('upload_data') ? { label: 'Cargar archivo', view: 'upload' as ViewKey } : null,
      color: 'bg-amber-100 text-amber-700',
    },
    {
      icon: Cpu,
      title: 'El motor analiza automáticamente',
      description: 'Al confirmar la carga, el sistema ejecuta cinco reglas de banderas rojas sobre cada proceso: único oferente, concentración de adjudicaciones, modalidades no competitivas, posible fraccionamiento y plazos atípicos.',
      action: null,
      color: 'bg-purple-100 text-purple-700',
    },
    {
      icon: FileSearch,
      title: 'Revise las alertas generadas',
      description: 'Cada alerta incluye el indicador que la activó, el umbral aplicado, los datos utilizados y una descripción. Filtre por prioridad, institución o indicador para priorizar su revisión.',
      action: hasPermission('view_alerts') ? { label: 'Ver alertas', view: 'alerts' as ViewKey } : null,
      color: 'bg-red-100 text-red-700',
    },
    {
      icon: ClipboardCheck,
      title: 'Gestione el estado de revisión',
      description: 'Asigne alertas, cambie su estado (en revisión, requiere información, remitida, descartada o cerrada), registre hallazgos y adjunte documentación de respaldo.',
      action: hasPermission('view_alerts') ? { label: 'Gestionar alertas', view: 'alerts' as ViewKey } : null,
      color: 'bg-emerald-100 text-emerald-700',
    },
    {
      icon: BarChart3,
      title: 'Genere reportes',
      description: 'Descargue reportes consolidados con métricas, frecuencia por indicador, desglose por institución y modalidad, y el estado de revisión del conjunto de alertas.',
      action: hasPermission('view_reports') ? { label: 'Ver reportes', view: 'reports' as ViewKey } : null,
      color: 'bg-slate-200 text-slate-700',
    },
  ];

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 transition-colors hover:bg-blue-50/80"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">¿Cómo funciona esta herramienta?</h2>
          {!expanded && (
            <span className="text-xs text-slate-400 font-normal hidden sm:inline">Haga clic para ver la guía paso a paso</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${expanded ? '' : '-rotate-90'}`}
        />
      </button>

      {expanded && (
      <div className="p-5">
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          El Sistema de Identificación y Gestión de Alertas (SIGA-DINAC) analiza datos de contratación pública para identificar señales preventivas que requieren revisión técnica. Siga estos pasos para utilizarlo:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="relative rounded-lg border border-slate-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${step.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-bold text-slate-400">PASO {idx + 1}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">{step.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
                    {step.action && (
                      <button
                        onClick={() => onNavigate(step.action!.view)}
                        className="mt-2.5 text-xs font-medium text-blue-700 hover:text-blue-800 flex items-center gap-1 transition-colors"
                      >
                        {step.action.label} <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            Las alertas son señales preventivas generadas mediante reglas de análisis. No constituyen por sí mismas evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requieren revisión técnica y documental.
          </p>
        </div>
      </div>
      )}
    </div>
  );
}

// ---- KPI Card component ----
function KpiCard({ icon: Icon, label, value, sub, color, help }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string;
  color: 'blue' | 'amber' | 'red' | 'slate' | 'green';
  help?: string;
}) {
  const colorMap = {
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    slate: 'text-slate-600',
    green: 'text-emerald-600',
  };
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-500 flex items-center gap-1">{label}{help && <HelpTooltip text={help} size="xs" />}</span>
        <Icon className={`w-5 h-5 ${colorMap[color]}`} />
      </div>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      {sub && <span className="text-xs text-slate-400 block mt-1">{sub}</span>}
    </div>
  );
}

// ---- Chart metadata header ----
function ChartMeta({ title, icon: Icon, help, period, updated, eligibleCount, filters, source }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  help: string;
  period: string;
  updated: string;
  eligibleCount: number;
  filters: string;
  source: string;
}) {
  return (
    <div className="border-b border-slate-100 pb-4 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <HelpTooltip text={help} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-1 text-[10px] text-slate-400">
        <MetaItem label="Periodo" value={period} />
        <MetaItem label="Actualizado" value={updated} />
        <MetaItem label="Fuente" value={source} />
        <MetaItem label="Elegibles" value={eligibleCount.toLocaleString('es-SV')} />
        <MetaItem label="Filtros" value={filters} />
      </div>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="font-medium text-slate-400">{label}: </span>
      <span className="text-slate-600 truncate">{value}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function EmptyChart() {
  return <p className="text-sm text-slate-400 text-center py-8">Sin datos suficientes para los filtros aplicados.</p>;
}

// ---- Multi-series line chart (pure CSS/SVG) ----
function LineChartMulti({ data }: { data: MonthlyPoint[] }) {
  const w = 600;
  const h = 200;
  const pad = { top: 20, right: 20, bottom: 30, left: 35 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;
  const scaleY = (v: number) => chartH - (v / maxVal) * chartH;

  const linePoints = (key: 'total' | 'withAlerts' | 'highPriority') =>
    data.map((d, i) => `${pad.left + i * xStep},${pad.top + scaleY(d[key])}`).join(' ');

  const areaPath = (key: 'total' | 'withAlerts' | 'highPriority') => {
    const pts = data.map((d, i) => `${pad.left + i * xStep},${pad.top + scaleY(d[key])}`);
    return `M ${pts.join(' L ')} L ${pad.left + (data.length - 1) * xStep},${pad.top + chartH} L ${pad.left},${pad.top + chartH} Z`;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxVal * t));

  return (
    <div className="w-full overflow-x-auto scrollbar-thin">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[500px] h-auto">
        {/* Grid lines */}
        {yTicks.map((t, i) => {
          const y = pad.top + scaleY(t);
          return (
            <g key={i}>
              <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
              <text x={pad.left - 5} y={y + 3} textAnchor="end" className="fill-slate-400" style={{ fontSize: '9px' }}>{t}</text>
            </g>
          );
        })}
        {/* Area for total */}
        {data.length > 1 && <path d={areaPath('total')} fill="#3b82f6" opacity="0.08" />}
        {/* Lines */}
        <polyline points={linePoints('total')} fill="none" stroke="#3b82f6" strokeWidth="2" />
        <polyline points={linePoints('withAlerts')} fill="none" stroke="#f59e0b" strokeWidth="2" />
        <polyline points={linePoints('highPriority')} fill="none" stroke="#ef4444" strokeWidth="2" />
        {/* Dots */}
        {data.map((d, i) => {
          const cx = pad.left + i * xStep;
          return (
            <g key={i}>
              <circle cx={cx} cy={pad.top + scaleY(d.total)} r="3" fill="#3b82f6" />
              <circle cx={cx} cy={pad.top + scaleY(d.withAlerts)} r="3" fill="#f59e0b" />
              {d.highPriority > 0 && <circle cx={cx} cy={pad.top + scaleY(d.highPriority)} r="3" fill="#ef4444" />}
              <text x={cx} y={h - 8} textAnchor="middle" className="fill-slate-400" style={{ fontSize: '9px' }}>
                {formatMonth(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <LegendDot color="bg-blue-500" label="Procesos analizados" />
        <LegendDot color="bg-amber-500" label="Con alertas" />
        <LegendDot color="bg-red-500" label="Alta prioridad" />
      </div>
    </div>
  );
}

// ---- Status bar colors for review chart ----
const STATUS_BAR_COLORS: Record<string, string> = {
  new: 'bg-blue-500',
  assigned: 'bg-cyan-500',
  in_review: 'bg-amber-500',
  requires_info: 'bg-orange-500',
  referred: 'bg-purple-500',
  discarded: 'bg-slate-400',
  closed: 'bg-emerald-500',
};

// ---- Helpers ----
function formatMonth(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${months[Number(m) - 1] || m} ${y.slice(2)}`;
}

function formatMonthFull(ym: string): string {
  const [y, m] = ym.split('-');
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${months[Number(m) - 1] || m} ${y}`;
}
