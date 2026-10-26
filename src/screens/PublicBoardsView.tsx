import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BarChart3, Check, CheckCircle2, ClipboardCheck,
  Clock3, Copy, ExternalLink, FileClock, Info, Link2, Plus, ShieldCheck,
  Smartphone, Monitor, PauseCircle, Send, Sparkles, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import type { ViewKey } from '@/components/AppShell';

interface PublicBoard {
  id: string;
  title: string;
  description: string;
  responsible_unit: string;
  reference_period: string;
  data_source: string;
  cutoff_date: string | null;
  methodology_note: string;
  status: BoardStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

type BoardStatus = 'draft' | 'pending_approval' | 'approved' | 'published' | 'suspended' | 'archived';

interface Publication {
  id: string;
  public_id: string;
  board_id: string;
  version_id: string;
  status: 'published' | 'suspended';
  published_at: string;
}

interface BoardVersion {
  id: string;
  board_id: string;
  version: number;
  status: string;
  selected_components: string[];
  content: { title?: string; description?: string; methodology_note?: string };
  created_at: string;
  review_note: string | null;
}

interface PublicPublication {
  public_id: string;
  title: string;
  description: string;
  responsible_unit: string;
  source_label: string;
  reference_period: string;
  cutoff_date: string | null;
  methodology_note: string;
  snapshot: PublicSnapshot;
  published_at: string;
  status: 'published' | 'suspended';
}

interface PublicSnapshot {
  total_processes: number | null;
  institutions: number | null;
  coverage_period: { from: string | null; to: string | null } | null;
  completeness: number | null;
  monthly_trend: { month: string; count: number }[];
  status_distribution: { status: string; count: number }[];
}

const COMPONENTS = [
  { key: 'total_processes', label: 'Número total de procesos incluidos', description: 'Conteo agregado del conjunto publicado.' },
  { key: 'institutions', label: 'Número de instituciones representadas', description: 'Conteo de instituciones, sin mostrar nombres.' },
  { key: 'coverage_period', label: 'Periodo cubierto', description: 'Primera y última fecha disponible.' },
  { key: 'completeness', label: 'Porcentaje de registros completos', description: 'Calidad agregada de los campos básicos.' },
  { key: 'monthly_trend', label: 'Procesos registrados por mes', description: 'Evolución mensual agregada.' },
  { key: 'status_distribution', label: 'Distribución general por estado', description: 'Disponible sólo si se autoriza durante la revisión.' },
];

const STATUS_LABELS: Record<BoardStatus, string> = {
  draft: 'Borrador',
  pending_approval: 'Pendiente de aprobación',
  approved: 'Aprobado',
  published: 'Publicado',
  suspended: 'Suspendido',
  archived: 'Archivado',
};

const STATUS_STYLES: Record<BoardStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_approval: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  published: 'bg-blue-50 text-blue-800 border-blue-200',
  suspended: 'bg-red-50 text-red-800 border-red-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};

const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('es-SV') : '—';
const publicUrl = (publicId: string) => `${window.location.origin}/publico/tableros/${publicId}`;
const embedUrl = (publicId: string) => `${window.location.origin}/publico/tableros/${publicId}/embed`;

export function PublicBoardsView({ onNavigate }: { onNavigate: (view: ViewKey) => void }) {
  const { hasPermission, logAction } = useAuth();
  const [boards, setBoards] = useState<PublicBoard[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [showShare, setShowShare] = useState<Publication | null>(null);
  const [historyBoard, setHistoryBoard] = useState<PublicBoard | null>(null);
  const [history, setHistory] = useState<BoardVersion[]>([]);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canManage = hasPermission('manage_public_boards');
  const canApprove = hasPermission('approve_public_boards');

  const loadBoards = useCallback(async () => {
    setLoading(true);
    const [boardResult, publicationResult] = await Promise.all([
      supabase.from('public_boards').select('*').order('created_at', { ascending: false }),
      supabase.from('public_board_publications').select('id, public_id, board_id, version_id, status, published_at').order('published_at', { ascending: false }),
    ]);
    if (boardResult.error || publicationResult.error) {
      setError('No se pudieron cargar los tableros públicos.');
    } else {
      setBoards((boardResult.data || []) as PublicBoard[]);
      setPublications((publicationResult.data || []) as Publication[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadBoards(); }, [loadBoards]);

  const stats = useMemo(() => ({
    total: boards.length,
    published: boards.filter((board) => board.status === 'published').length,
    pending: boards.filter((board) => board.status === 'pending_approval').length,
    suspended: boards.filter((board) => board.status === 'suspended').length,
  }), [boards]);

  const runAction = async (boardId: string, action: () => PromiseLike<{ error?: { message: string } | null }>, success: string) => {
    setWorkingId(boardId);
    setError(null);
    const result = await action();
    if (result.error) {
      setError('No se pudo completar la operación.');
    } else {
      setNotice(success);
      await loadBoards();
    }
    setWorkingId(null);
  };

  const submitForApproval = (board: PublicBoard) => runAction(
    board.id,
    () => supabase.rpc('submit_public_board_for_approval', { p_board_id: board.id }),
    'El tablero fue enviado a revisión.',
  ).then(() => logAction('public_board_submitted', 'publications', `Solicitud de aprobación: ${board.title}`, board.id));

  const review = (board: PublicBoard, versionId: string, decision: 'approved' | 'rejected') => runAction(
    board.id,
    () => supabase.rpc('review_public_board_version', { p_version_id: versionId, p_decision: decision, p_note: '' }),
    decision === 'approved' ? 'El tablero fue aprobado.' : 'El tablero volvió a borrador.',
  ).then(() => logAction(`public_board_${decision}`, 'publications', `${decision === 'approved' ? 'Aprobación' : 'Rechazo'}: ${board.title}`, board.id));

  const publish = async (board: PublicBoard) => {
    const { data: version } = await supabase.from('public_board_versions').select('id').eq('board_id', board.id).eq('status', 'approved').order('version', { ascending: false }).limit(1).maybeSingle();
    if (!version) {
      setError('No existe una versión aprobada para publicar.');
      return;
    }
    setWorkingId(board.id);
    const { error: publishError } = await supabase.rpc('publish_public_board', { p_version_id: version.id });
    if (publishError) setError('No se pudo publicar el tablero.');
    else {
      setNotice('El tablero fue publicado y ya tiene un enlace público.');
      await logAction('public_board_published', 'publications', `Publicación: ${board.title}`, board.id);
      await loadBoards();
    }
    setWorkingId(null);
  };

  const suspend = (board: PublicBoard) => runAction(
    board.id,
    () => supabase.rpc('suspend_public_board', { p_board_id: board.id }),
    'La publicación fue suspendida.',
  ).then(() => logAction('public_board_suspended', 'publications', `Suspensión: ${board.title}`, board.id));

  const openHistory = async (board: PublicBoard) => {
    setHistoryBoard(board);
    const { data } = await supabase.from('public_board_versions').select('id, board_id, version, status, selected_components, content, created_at, review_note').eq('board_id', board.id).order('version', { ascending: false });
    setHistory((data || []) as BoardVersion[]);
  };

  const latestVersion = async (boardId: string) => {
    const { data } = await supabase.from('public_board_versions').select('id').eq('board_id', boardId).eq('status', 'pending_approval').order('version', { ascending: false }).limit(1).maybeSingle();
    return data?.id as string | undefined;
  };

  const handleApprove = async (board: PublicBoard, decision: 'approved' | 'rejected') => {
    const versionId = await latestVersion(board.id);
    if (versionId) await review(board, versionId, decision);
    else setError('No se encontró la versión pendiente de revisión.');
  };

  const copy = async (value: string, message: string) => {
    await navigator.clipboard.writeText(value);
    setNotice(message);
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Publicación' }, { label: 'Tableros públicos' }]} onNavigate={onNavigate} />
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableros públicos</h1>
          <p className="text-sm text-slate-500 mt-1">Cree, administre y publique estadísticas institucionales de forma segura.</p>
        </div>
        {canManage && <button className="btn-primary" onClick={() => { setShowWizard(true); setNotice(null); }}><Plus className="w-4 h-4" /> Nuevo tablero público</button>}
      </div>

      {notice && <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</span><button onClick={() => setNotice(null)}><X className="w-4 h-4" /></button></div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon={BarChart3} label="Total de tableros" value={stats.total} color="blue" />
        <SummaryCard icon={CheckCircle2} label="Publicados" value={stats.published} color="emerald" />
        <SummaryCard icon={Clock3} label="Pendientes" value={stats.pending} color="amber" />
        <SummaryCard icon={PauseCircle} label="Suspendidos" value={stats.suspended} color="red" />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-900">Publicaciones institucionales</h2><p className="text-xs text-slate-500 mt-1">Cada publicación se basa en una versión aprobada e independiente.</p></div><ShieldCheck className="w-5 h-5 text-blue-700" /></div>
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Cargando tableros...</div> : boards.length === 0 ? <EmptyState onCreate={() => setShowWizard(true)} canCreate={canManage} /> : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-slate-50"><th className="table-header">Nombre del tablero</th><th className="table-header">Versión</th><th className="table-header">Estado</th><th className="table-header">Creación</th><th className="table-header">Última publicación</th><th className="table-header">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">{boards.map((board) => { const publication = publications.find((item) => item.board_id === board.id && item.status === 'published'); const busy = workingId === board.id; return <tr key={board.id} className="hover:bg-slate-50/70"><td className="px-4 py-4 min-w-[250px]"><p className="text-sm font-semibold text-slate-900">{board.title}</p><p className="text-xs text-slate-500 mt-1 line-clamp-2">{board.description || 'Sin descripción'}</p><p className="text-[11px] text-slate-400 mt-2">Responsable: {board.responsible_unit || 'No definido'}</p></td><td className="table-cell">{publication ? 'Publicada' : 'Borrador'}</td><td className="table-cell"><span className={`badge ${STATUS_STYLES[board.status]}`}>{STATUS_LABELS[board.status]}</span></td><td className="table-cell whitespace-nowrap">{formatDate(board.created_at)}</td><td className="table-cell whitespace-nowrap">{formatDate(publication?.published_at || null)}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-1.5 min-w-[220px]">{board.status === 'draft' && canManage && <button className="btn-ghost text-xs" onClick={() => submitForApproval(board)} disabled={busy}><Send className="w-3.5 h-3.5" />Solicitar</button>}{board.status === 'pending_approval' && canApprove && <><button className="btn-ghost text-xs text-emerald-700" onClick={() => handleApprove(board, 'approved')} disabled={busy}><Check className="w-3.5 h-3.5" />Aprobar</button><button className="btn-ghost text-xs text-red-700" onClick={() => handleApprove(board, 'rejected')} disabled={busy}><X className="w-3.5 h-3.5" />Rechazar</button></>}{board.status === 'approved' && canApprove && <button className="btn-primary text-xs py-1.5" onClick={() => publish(board)} disabled={busy}><ExternalLink className="w-3.5 h-3.5" />Publicar</button>}{publication && <button className="btn-ghost text-xs" onClick={() => setShowShare(publication)}><Link2 className="w-3.5 h-3.5" />Compartir</button>}{publication && canApprove && <button className="btn-ghost text-xs text-red-700" onClick={() => suspend(board)} disabled={busy}><PauseCircle className="w-3.5 h-3.5" />Suspender</button>}<button className="btn-ghost text-xs" onClick={() => openHistory(board)}><FileClock className="w-3.5 h-3.5" />Historial</button></div></td></tr>; })}</tbody></table></div>}
      </div>

      {showWizard && <BoardWizard onClose={() => setShowWizard(false)} onCreated={async () => { setShowWizard(false); await loadBoards(); setNotice('El tablero fue creado como borrador.'); }} />}
      {showShare && <ShareDialog publication={showShare} onClose={() => setShowShare(null)} onCopy={copy} />}
      {historyBoard && <HistoryDialog board={historyBoard} history={history} onClose={() => setHistoryBoard(null)} />}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: typeof BarChart3; label: string; value: number; color: 'blue' | 'emerald' | 'amber' | 'red' }) {
  const styles = { blue: 'text-blue-700 bg-blue-50', emerald: 'text-emerald-700 bg-emerald-50', amber: 'text-amber-700 bg-amber-50', red: 'text-red-700 bg-red-50' };
  return <div className="stat-card"><div className="flex items-center justify-between"><span className="text-xs text-slate-500">{label}</span><span className={`w-8 h-8 rounded-lg flex items-center justify-center ${styles[color]}`}><Icon className="w-4 h-4" /></span></div><span className="text-2xl font-bold text-slate-900 mt-2">{value}</span></div>;
}

function EmptyState({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  return <div className="p-12 text-center"><Sparkles className="w-9 h-9 text-blue-700 mx-auto mb-3" /><h3 className="font-semibold text-slate-900">Aún no hay tableros públicos</h3><p className="text-sm text-slate-500 max-w-md mx-auto mt-1">Cree una publicación estadística con componentes autorizados y sométala a revisión institucional.</p>{canCreate && <button className="btn-primary mt-5" onClick={onCreate}><Plus className="w-4 h-4" />Crear primer tablero</button>}</div>;
}

function BoardWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: 'Estadísticas generales de compras públicas', description: 'Información estadística agregada sobre los procesos de contratación incluidos en los registros disponibles para el periodo seleccionado.', responsibleUnit: '', period: '', source: '', cutoffDate: '', methodology: 'Los datos representan exclusivamente el universo disponible en los registros institucionales para el periodo indicado. No constituyen una representación completa de todas las compras nacionales salvo que la cobertura se encuentre acreditada.' });
  const [selected, setSelected] = useState<string[]>(['total_processes', 'institutions', 'coverage_period', 'completeness', 'monthly_trend']);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const create = async () => {
    setSaving(true); setError(null);
    const { data: boardId, error: createError } = await supabase.rpc('create_public_board', { p_title: form.title, p_description: form.description, p_responsible_unit: form.responsibleUnit, p_reference_period: form.period, p_data_source: form.source, p_cutoff_date: form.cutoffDate || null, p_methodology_note: form.methodology });
    if (createError || !boardId) { setError('No se pudo crear el tablero. Revise los datos e inténtelo nuevamente.'); setSaving(false); return; }
    const { error: versionError } = await supabase.rpc('prepare_public_board_version', { p_board_id: boardId, p_selected_components: selected, p_visible_title: form.title, p_public_description: form.description, p_methodology_note: form.methodology });
    if (versionError) { setError('El tablero se creó, pero no se pudo preparar su snapshot estadístico.'); setSaving(false); return; }
    await onCreated();
    setSaving(false);
  };

  const steps = ['Información general', 'Contenido autorizado', 'Diseño y vista previa', 'Revisión', 'Guardar borrador'];
  return <div className="fixed inset-0 z-50 bg-slate-950/40 p-3 sm:p-6 overflow-y-auto"><div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden"><div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Asistente de publicación</p><h2 className="text-lg font-bold text-slate-900 mt-1">Nuevo tablero público</h2></div><button className="btn-ghost" onClick={onClose}><X className="w-5 h-5" /></button></div><div className="px-5 pt-4 overflow-x-auto"><div className="flex min-w-[650px] items-center gap-2">{steps.map((label, index) => <div key={label} className="flex items-center gap-2 flex-1"><span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step > index + 1 ? 'bg-emerald-600 text-white' : step === index + 1 ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{step > index + 1 ? <Check className="w-4 h-4" /> : index + 1}</span><span className={`text-xs whitespace-nowrap ${step === index + 1 ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>{label}</span>{index < steps.length - 1 && <div className="h-px bg-slate-200 flex-1" />}</div>)}</div></div><div className="p-5 sm:p-7 min-h-[390px]">{step === 1 && <WizardGeneral form={form} update={update} />}{step === 2 && <WizardContent selected={selected} setSelected={setSelected} />}{step === 3 && <WizardPreview form={form} selected={selected} />}{step === 4 && <WizardReview form={form} selected={selected} />}{step === 5 && <WizardSave form={form} selected={selected} />}{error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}</div><div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between"><button className="btn-secondary" onClick={() => step === 1 ? onClose() : setStep(step - 1)}>{step === 1 ? 'Cancelar' : <><ArrowLeft className="w-4 h-4" />Anterior</>}</button>{step < 5 ? <button className="btn-primary" onClick={() => setStep(step + 1)} disabled={step === 1 && !form.title.trim()}>{step === 4 ? 'Continuar' : 'Siguiente'}<ArrowRight className="w-4 h-4" /></button> : <button className="btn-primary" onClick={create} disabled={saving || selected.length === 0}>{saving ? 'Preparando...' : 'Crear borrador'}<Check className="w-4 h-4" /></button>}</div></div></div>;
}

function WizardGeneral({ form, update }: { form: { title: string; description: string; responsibleUnit: string; period: string; source: string; cutoffDate: string; methodology: string }; update: (key: 'title' | 'description' | 'responsibleUnit' | 'period' | 'source' | 'cutoffDate' | 'methodology', value: string) => void }) {
  return <div><SectionTitle icon={Info} title="Información general" description="Defina el contexto institucional y la fuente autorizada del tablero." /><div className="grid sm:grid-cols-2 gap-4 mt-6"><Field label="Nombre del tablero" value={form.title} onChange={(value) => update('title', value)} className="sm:col-span-2" /><Field label="Descripción pública" value={form.description} onChange={(value) => update('description', value)} multiline className="sm:col-span-2" /><Field label="Unidad responsable" value={form.responsibleUnit} onChange={(value) => update('responsibleUnit', value)} placeholder="Ej. Dirección de análisis" /><Field label="Periodo de referencia" value={form.period} onChange={(value) => update('period', value)} placeholder="Ej. Enero a diciembre de 2026" /><Field label="Fuente autorizada" value={form.source} onChange={(value) => update('source', value)} placeholder="Ej. Registros institucionales de contratación" /><Field label="Fecha de corte" value={form.cutoffDate} onChange={(value) => update('cutoffDate', value)} type="date" /><Field label="Nota metodológica" value={form.methodology} onChange={(value) => update('methodology', value)} multiline className="sm:col-span-2" /></div></div>;
}

function WizardContent({ selected, setSelected }: { selected: string[]; setSelected: (value: string[]) => void }) {
  const toggle = (key: string) => setSelected(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  return <div><SectionTitle icon={ClipboardCheck} title="Selección de contenido" description="Sólo puede elegir componentes estadísticos autorizados. No se exponen datos individuales." /><div className="grid sm:grid-cols-2 gap-3 mt-6">{COMPONENTS.map((component) => <label key={component.key} className={`flex gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${selected.includes(component.key) ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'}`}><input type="checkbox" checked={selected.includes(component.key)} onChange={() => toggle(component.key)} className="mt-1 accent-blue-900" /><span><span className="block text-sm font-semibold text-slate-800">{component.label}</span><span className="block text-xs text-slate-500 mt-1">{component.description}</span></span></label>)}</div><div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">Los filtros públicos por proveedor, institución, contrato, identificador de proceso y monto no están habilitados en esta primera versión.</div></div>;
}

function WizardPreview({ form, selected }: { form: { title: string; description: string; period: string; source: string }; selected: string[] }) {
  return <div><SectionTitle icon={Monitor} title="Diseño y previsualización" description="Esta vista muestra la estructura pública sin inventar cifras. Los valores reales se calculan al crear el snapshot." /><div className="flex gap-2 mt-5 mb-4"><span className="badge bg-blue-50 text-blue-700 border-blue-200"><Monitor className="w-3.5 h-3.5" /> Escritorio</span><span className="badge bg-slate-100 text-slate-600 border-slate-200"><Smartphone className="w-3.5 h-3.5" /> Móvil</span></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-6"><div className="bg-white rounded-xl border border-slate-200 p-5"><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Tablero estadístico</p><h3 className="text-xl font-bold text-slate-900 mt-2">{form.title || 'Título del tablero'}</h3><p className="text-sm text-slate-500 mt-2 max-w-2xl">{form.description || 'Descripción institucional'}</p><div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">{selected.slice(0, 4).map((key) => <div key={key} className="rounded-lg border border-slate-200 p-3"><div className="h-2 w-16 rounded bg-slate-200" /><div className="h-5 w-20 rounded bg-slate-100 mt-3" /></div>)}</div><div className="h-24 rounded-lg bg-slate-50 border border-dashed border-slate-300 mt-4 flex items-center justify-center text-xs text-slate-400">Gráficas agregadas, sin datos ficticios</div><p className="text-[11px] text-slate-400 mt-4">Fuente: {form.source || 'Fuente autorizada'} · Cobertura: {form.period || 'Periodo de referencia'}</p></div></div></div>;
}

function WizardReview({ form, selected }: { form: { title: string; description: string; period: string; source: string; cutoffDate: string }; selected: string[] }) {
  return <div><SectionTitle icon={ShieldCheck} title="Revisión y aprobación" description="El borrador será revisado por un usuario autorizado antes de su publicación." /><div className="grid sm:grid-cols-2 gap-4 mt-6"><ReviewItem label="Título" value={form.title} /><ReviewItem label="Periodo" value={form.period || 'No definido'} /><ReviewItem label="Fuente" value={form.source || 'No definida'} /><ReviewItem label="Fecha de corte" value={form.cutoffDate || 'No definida'} /><ReviewItem label="Componentes" value={`${selected.length} seleccionados`} /><ReviewItem label="Protección" value="Sin datos individuales ni alertas" /></div><div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />La preparación y la aprobación están separadas. El usuario editor no publica directamente.</div></div>;
}

function WizardSave({ form, selected }: { form: { title: string; description: string; period: string; source: string }; selected: string[] }) {
  return <div className="flex flex-col items-center justify-center text-center py-10"><div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><CheckCircle2 className="w-7 h-7" /></div><h3 className="text-xl font-bold text-slate-900 mt-5">Listo para crear el borrador</h3><p className="text-sm text-slate-500 max-w-lg mt-2">Se generará un snapshot agregado con {selected.length} componentes autorizados para “{form.title}”. La nueva publicación quedará en estado Borrador.</p><div className="mt-5 text-xs text-slate-400">{form.source || 'Fuente pendiente de definir'} · {form.period || 'Periodo pendiente de definir'}</div></div>;
}

function Field({ label, value, onChange, placeholder, type = 'text', multiline = false, className = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; multiline?: boolean; className?: string }) {
  return <label className={`block ${className}`}><span className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</span>{multiline ? <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="input-field resize-y" /> : <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} className="input-field" />}</label>;
}

function SectionTitle({ icon: Icon, title, description }: { icon: typeof Info; title: string; description: string }) {
  return <div className="flex gap-3"><span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0"><Icon className="w-5 h-5" /></span><div><h3 className="text-lg font-bold text-slate-900">{title}</h3><p className="text-sm text-slate-500 mt-1">{description}</p></div></div>;
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 p-3"><p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p><p className="text-sm text-slate-800 mt-1">{value}</p></div>;
}

function ShareDialog({ publication, onClose, onCopy }: { publication: Publication; onClose: () => void; onCopy: (value: string, message: string) => Promise<void> }) {
  const [tab, setTab] = useState<'link' | 'embed'>('link');
  const link = publicUrl(publication.public_id);
  const embed = `<iframe\n  src="${embedUrl(publication.public_id)}"\n  title="Tablero estadístico DINAC"\n  width="100%"\n  height="650"\n  loading="lazy"\n  style="border:0;border-radius:12px;"\n></iframe>`;
  return <Modal title="Compartir tablero público" onClose={onClose}><div className="flex gap-1 border-b border-slate-200 mb-5"><button className={`px-3 py-2 text-sm ${tab === 'link' ? 'border-b-2 border-blue-900 text-blue-900 font-semibold' : 'text-slate-500'}`} onClick={() => setTab('link')}>Enlace público</button><button className={`px-3 py-2 text-sm ${tab === 'embed' ? 'border-b-2 border-blue-900 text-blue-900 font-semibold' : 'text-slate-500'}`} onClick={() => setTab('embed')}>Código Embed</button></div>{tab === 'link' ? <><p className="text-sm text-slate-500 mb-2">Comparta este enlace para abrir el tablero sin iniciar sesión.</p><div className="flex gap-2"><input readOnly value={link} className="input-field text-xs" /><button className="btn-primary flex-shrink-0" onClick={() => onCopy(link, 'Enlace copiado.')}><Copy className="w-4 h-4" />Copiar</button></div><a className="inline-flex items-center gap-1.5 text-sm text-blue-700 mt-4 hover:underline" href={link} target="_blank" rel="noreferrer">Abrir tablero <ExternalLink className="w-3.5 h-3.5" /></a></> : <><p className="text-sm text-slate-500 mb-2">Pegue este código en un sitio autorizado por DINAC.</p><textarea readOnly value={embed} rows={8} className="input-field font-mono text-xs" /><button className="btn-primary mt-3" onClick={() => onCopy(embed, 'Código Embed copiado.')}><Copy className="w-4 h-4" />Copiar código</button></>}</Modal>;
}

function HistoryDialog({ board, history, onClose }: { board: PublicBoard; history: BoardVersion[]; onClose: () => void }) {
  return <Modal title={`Historial: ${board.title}`} onClose={onClose}>{history.length === 0 ? <p className="text-sm text-slate-500">No hay versiones registradas.</p> : <div className="space-y-3">{history.map((version) => <div key={version.id} className="rounded-lg border border-slate-200 p-3 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-900">Versión {version.version}</p><p className="text-xs text-slate-500 mt-1">{formatDate(version.created_at)} · {version.selected_components.length} componentes</p>{version.review_note && <p className="text-xs text-slate-600 mt-2">Observación: {version.review_note}</p>}</div><span className="badge bg-slate-100 text-slate-700 border-slate-200">{version.status}</span></div>)}</div>}</Modal>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 bg-slate-950/40 p-4 flex items-center justify-center"><div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl"><div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between"><h2 className="font-bold text-slate-900">{title}</h2><button className="btn-ghost" onClick={onClose}><X className="w-5 h-5" /></button></div><div className="p-5">{children}</div></div></div>;
}

export function PublicBoardView({ publicId, embed = false }: { publicId: string; embed?: boolean }) {
  const [publication, setPublication] = useState<PublicPublication | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from('public_board_publications').select('*').eq('public_id', publicId).eq('status', 'published').maybeSingle().then(({ data }) => {
      setPublication(data as PublicPublication | null);
      setLoading(false);
    });
  }, [publicId]);
  if (loading) return <PublicLoading embed={embed} />;
  if (!publication) return <PublicNotFound embed={embed} />;
  return <PublicBoardContent publication={publication} embed={embed} />;
}

function PublicBoardContent({ publication, embed }: { publication: PublicPublication; embed: boolean }) {
  const snapshot = publication.snapshot;
  const maxMonthly = Math.max(...(snapshot.monthly_trend || []).map((item) => item.count), 1);
  return <div className={`min-h-screen bg-slate-50 ${embed ? '' : 'py-6 sm:py-10'}`}><div className={`${embed ? 'max-w-6xl' : 'max-w-6xl mx-auto px-4'} `}><div className="card overflow-hidden"><header className="bg-blue-950 text-white px-5 py-6 sm:px-8 sm:py-8"><div className="flex items-center gap-3"><img src="/dinac-logo.svg" alt="DINAC" className="h-10 w-auto object-contain" /><div><p className="text-xs uppercase tracking-[0.18em] text-blue-200">Estadísticas públicas</p><p className="text-sm font-semibold mt-1">DINAC</p></div></div><h1 className="text-2xl sm:text-3xl font-bold mt-7">{publication.title}</h1><p className="text-blue-100 text-sm leading-relaxed max-w-3xl mt-3">{publication.description}</p></header><main className="p-5 sm:p-8"><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{snapshot.total_processes !== null && <PublicMetric label="Procesos incluidos" value={snapshot.total_processes.toLocaleString('es-SV')} />}{snapshot.institutions !== null && <PublicMetric label="Instituciones representadas" value={snapshot.institutions.toLocaleString('es-SV')} />}{snapshot.coverage_period && <PublicMetric label="Periodo de cobertura" value={`${formatDate(snapshot.coverage_period.from)} — ${formatDate(snapshot.coverage_period.to)}`} compact />}{snapshot.completeness !== null && <PublicMetric label="Registros completos" value={`${snapshot.completeness.toLocaleString('es-SV')}%`} />}</div>{snapshot.monthly_trend?.length > 0 && <section className="mt-8"><h2 className="text-lg font-bold text-slate-900">Evolución mensual</h2><p className="text-sm text-slate-500 mt-1">Número agregado de procesos registrados por mes.</p><div className="mt-5 flex items-end gap-2 sm:gap-4 h-56 border-b border-l border-slate-200 px-3 pb-0 pt-4 overflow-x-auto">{snapshot.monthly_trend.map((item) => <div key={item.month} className="h-full min-w-[34px] flex flex-col items-center justify-end gap-2"><span className="text-[10px] text-slate-500">{item.count}</span><div className="w-7 rounded-t-md bg-blue-700 hover:bg-blue-800 transition-colors" style={{ height: `${Math.max((item.count / maxMonthly) * 80, 5)}%` }} title={`${item.month}: ${item.count}`} /><span className="text-[10px] text-slate-400 -rotate-45 origin-top-left mt-2">{item.month}</span></div>)}</div></section>}{snapshot.status_distribution?.length > 0 && <section className="mt-8"><h2 className="text-lg font-bold text-slate-900">Distribución general por estado</h2><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">{snapshot.status_distribution.map((item) => <div key={item.status} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between"><span className="text-sm text-slate-600">{item.status}</span><span className="text-sm font-bold text-slate-900">{item.count.toLocaleString('es-SV')}</span></div>)}</div></section>}<section className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-2"><Info className="w-4 h-4 text-blue-700" /><h2 className="text-sm font-bold text-slate-900">Información metodológica</h2></div><div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm"><div><span className="text-xs text-slate-400 block">Fuente</span><span className="text-slate-700">{publication.source_label || 'Fuente institucional autorizada'}</span></div><div><span className="text-xs text-slate-400 block">Fecha de publicación</span><span className="text-slate-700">{formatDate(publication.published_at)}</span></div><div><span className="text-xs text-slate-400 block">Fecha de corte</span><span className="text-slate-700">{formatDate(publication.cutoff_date)}</span></div><div><span className="text-xs text-slate-400 block">Cobertura</span><span className="text-slate-700">{publication.reference_period || 'Periodo indicado en el tablero'}</span></div></div><p className="text-xs text-slate-500 leading-relaxed mt-5 pt-4 border-t border-slate-200">{publication.methodology_note}</p></section></main><footer className="px-5 py-4 sm:px-8 border-t border-slate-100 text-xs text-slate-400">Información agregada para consulta pública · DINAC</footer></div></div></div>;
}

function PublicMetric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5"><p className="text-xs text-slate-500 leading-relaxed">{label}</p><p className={`${compact ? 'text-sm sm:text-base' : 'text-2xl'} font-bold text-slate-900 mt-2 break-words`}>{value}</p></div>;
}

function PublicLoading({ embed }: { embed: boolean }) { return <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${embed ? '' : 'p-6'}`}><div className="text-center"><img src="/dinac-logo.svg" alt="DINAC" className="h-12 w-auto mx-auto mb-4" /><p className="text-sm text-slate-500">Cargando tablero público...</p></div></div>; }
function PublicNotFound({ embed }: { embed: boolean }) { return <div className={`min-h-screen bg-slate-50 flex items-center justify-center ${embed ? '' : 'p-6'}`}><div className="card max-w-md p-8 text-center"><img src="/dinac-logo.svg" alt="DINAC" className="h-12 w-auto mx-auto mb-4" /><h1 className="text-lg font-bold text-slate-900">Tablero no disponible</h1><p className="text-sm text-slate-500 mt-2">El enlace no existe o la publicación fue suspendida.</p></div></div>; }
