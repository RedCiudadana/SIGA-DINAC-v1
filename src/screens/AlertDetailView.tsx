import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, AlertTriangle, User, MessageSquare, Paperclip,
  History, Save, X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  ALERT_STATUS_LABELS, ALERT_STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  INDICATOR_LABELS, INDICATOR_LEVEL_LABEL,
  INDICATOR_RULE_EXPLANATIONS,
  type Alert, type AlertComment, type AlertStatusHistory,
} from '@/types';
import { Lightbulb, CheckCircle2, FileCheck2, Calendar, GitBranch } from 'lucide-react';
import type { ViewKey } from '@/components/AppShell';
import { HelpTooltip } from '@/components/HelpUI';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { ConfirmDialog } from '@/components/ConfirmDialog';

interface AlertDetailViewProps {
  alertId: string;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}

export function AlertDetailView({ alertId, onNavigate }: AlertDetailViewProps) {
  const { profile, hasPermission, logAction } = useAuth();
  const [alert, setAlert] = useState<Alert | null>(null);
  const [comments, setComments] = useState<AlertComment[]>([]);
  const [history, setHistory] = useState<AlertStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [activeTab, setActiveTab] = useState<'detail' | 'comments' | 'history'>('detail');
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);

  const loadAlert = useCallback(async () => {
    setLoading(true);
    const { data: alertData } = await supabase
      .from('alerts')
      .select('*, indicator:indicator_definitions(*)')
      .eq('id', alertId)
      .maybeSingle();
    setAlert(alertData as Alert | null);

    const { data: commentData } = await supabase
      .from('alert_comments')
      .select('*')
      .eq('alert_id', alertId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });
    setComments((commentData || []) as AlertComment[]);

    const { data: historyData } = await supabase
      .from('alert_status_history')
      .select('*')
      .eq('alert_id', alertId)
      .order('changed_at', { ascending: false });
    setHistory((historyData || []) as AlertStatusHistory[]);

    setLoading(false);
  }, [alertId]);

  useEffect(() => {
    loadAlert();
  }, [loadAlert]);

  useEffect(() => {
    if (alert) {
      setConclusion(alert.conclusion || '');
      logAction('alert_viewed', 'alerts', `Consulta de alerta ${alert.alert_code}`, alert.id);
    }
  }, [alert?.id]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !alert) return;
    const { data } = await supabase
      .from('alert_comments')
      .insert({
        alert_id: alert.id,
        comment: newComment.trim(),
        is_internal: true,
        created_by: profile?.user_id,
        user_name: profile?.full_name,
      })
      .select('*')
      .single();

    if (data) {
      setComments([data as AlertComment, ...comments]);
      setNewComment('');
      logAction('comment_added', 'alerts', `Comentario agregado a alerta ${alert.alert_code}`, alert.id);
    }
  };

  const handleStatusChange = async () => {
    if (!alert || !newStatus) return;
    const requiresJustification = newStatus === 'discarded' || newStatus === 'closed';
    if (requiresJustification && !statusReason.trim()) return;
    setShowStatusConfirm(true);
  };

  const executeStatusChange = async () => {
    if (!alert || !newStatus) return;
    const requiresJustification = newStatus === 'discarded' || newStatus === 'closed';

    const { error } = await supabase
      .from('alerts')
      .update({
        status: newStatus,
        conclusion: requiresJustification ? statusReason : alert.conclusion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alert.id);

    if (!error) {
      await supabase.from('alert_status_history').insert({
        alert_id: alert.id,
        from_status: alert.status,
        to_status: newStatus,
        reason: statusReason,
        changed_by: profile?.user_id,
        user_name: profile?.full_name,
      });

      logAction('status_changed', 'alerts', `Estado cambiado de ${ALERT_STATUS_LABELS[alert.status]} a ${ALERT_STATUS_LABELS[newStatus]} en ${alert.alert_code}`, alert.id);

      setShowStatusModal(false);
      setStatusReason('');
      setNewStatus('');
      setShowStatusConfirm(false);
      loadAlert();
    }
  };

  const handleSaveConclusion = async () => {
    if (!alert) return;
    await supabase
      .from('alerts')
      .update({ conclusion, updated_at: new Date().toISOString() })
      .eq('id', alert.id);
    logAction('conclusion_updated', 'alerts', `Conclusión actualizada en ${alert.alert_code}`, alert.id);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Cargando alerta...</div>;
  }

  if (!alert) {
    return (
      <div className="space-y-4">
        <button onClick={() => onNavigate('alerts')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <p className="text-slate-500">Alerta no encontrada.</p>
      </div>
    );
  }

  const dataUsed = alert.data_used as Record<string, unknown> | null;

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Alertas', view: 'alerts' }, { label: alert.alert_code }]} onNavigate={onNavigate} />
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('alerts')} className="btn-secondary">
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400">{alert.alert_code}</span>
            <HelpTooltip text="Código único de la alerta. Úselo para referenciar esta alerta en comunicaciones internas o reportes." />
            <span className={`badge ${PRIORITY_COLORS[alert.priority] || ''}`}>
              Prioridad {PRIORITY_LABELS[alert.priority]}
            </span>
            <span className={`badge ${ALERT_STATUS_COLORS[alert.status] || ''}`}>
              {ALERT_STATUS_LABELS[alert.status]}
            </span>
            {alert.is_demo && (
              <span className="badge bg-blue-50 text-blue-700 border-blue-200">Demo</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">{alert.title}</h1>
        </div>
      </div>

      {/* Aviso preventivo permanente */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-xs text-amber-800 leading-relaxed">
          Esta alerta es una señal preventiva generada mediante reglas de análisis. No constituye por sí misma evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción. Requiere revisión técnica y documental.
        </p>
      </div>

      {/* ¿Por qué se generó esta alerta? */}
      <ExplainabilitySection alert={alert} dataUsed={dataUsed} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {[
          { key: 'detail' as const, label: 'Detalle', icon: AlertTriangle },
          { key: 'comments' as const, label: `Comentarios (${comments.length})`, icon: MessageSquare },
          { key: 'history' as const, label: 'Historial', icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'detail' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Descripción del análisis</h2>
              <p className="text-sm text-slate-700 leading-relaxed">{alert.description}</p>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Cálculo realizado</h2>
              <p className="text-sm text-slate-700 leading-relaxed font-mono bg-slate-50 rounded-lg p-3">
                {alert.calculation_detail}
              </p>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Datos utilizados</h2>
              <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 overflow-x-auto scrollbar-thin">
                {JSON.stringify(dataUsed, null, 2)}
              </pre>
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Conclusión del análisis</h2>
              <textarea
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                disabled={!hasPermission('manage_alerts')}
                placeholder="Registre la conclusión del análisis técnico y documental..."
                className="input-field min-h-[100px] resize-y"
              />
              {hasPermission('manage_alerts') && (
                <button onClick={handleSaveConclusion} className="btn-primary mt-3">
                  <Save className="w-4 h-4" /> Guardar conclusión
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Información de la alerta</h2>
              <dl className="space-y-2.5">
                <div>
                  <dt className="text-xs text-slate-400">Indicador</dt>
                  <dd className="text-sm text-slate-700">{INDICATOR_LABELS[alert.indicator_code] || alert.indicator_code}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Umbral aplicado</dt>
                  <dd className="text-sm text-slate-700">{alert.threshold_applied}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Fecha de generación</dt>
                  <dd className="text-sm text-slate-700">{new Date(alert.created_at).toLocaleString('es-SV')}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Lote de carga</dt>
                  <dd className="text-sm text-slate-700 font-mono text-xs">{alert.upload_id || 'N/A'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Prioridad</dt>
                  <dd>
                    <span className={`badge ${PRIORITY_COLORS[alert.priority] || ''}`}>
                      {PRIORITY_LABELS[alert.priority]}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Estado</dt>
                  <dd>
                    <span className={`badge ${ALERT_STATUS_COLORS[alert.status] || ''}`}>
                      {ALERT_STATUS_LABELS[alert.status]}
                    </span>
                  </dd>
                </div>
                {alert.alert_level && (
                  <div>
                    <dt className="text-xs text-slate-400">Nivel de análisis</dt>
                    <dd>
                      <span className="badge bg-slate-50 text-slate-700 border-slate-200">
                        {INDICATOR_LEVEL_LABEL[alert.alert_level] || alert.alert_level}
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {alert.quality_note && (
              <div className="card p-4">
                <div className="flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Nota de calidad</p>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">{alert.quality_note}</p>
                  </div>
                </div>
              </div>
            )}

            {hasPermission('manage_alerts') && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Gestión de la alerta</h2>
                <button
                  onClick={() => {
                    setNewStatus(alert.status);
                    setShowStatusModal(true);
                  }}
                  className="btn-primary w-full"
                >
                  Cambiar estado
                </button>
              </div>
            )}

            {hasPermission('assign_alerts') && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-slate-900 mb-3">Asignación</h2>
                <p className="text-xs text-slate-500">
                  {alert.assigned_to
                    ? `Asignada a: ${alert.assigned_to}`
                    : 'Sin asignar'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'comments' && (
        <div className="space-y-4">
          {hasPermission('view_alerts') && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Agregar comentario interno</h2>
              <div className="flex gap-3">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escriba un comentario interno..."
                  className="input-field resize-y"
                  rows={3}
                />
              </div>
              <button onClick={handleAddComment} disabled={!newComment.trim()} className="btn-primary mt-3">
                <MessageSquare className="w-4 h-4" /> Publicar comentario
              </button>
            </div>
          )}

          <div className="space-y-3">
            {comments.length === 0 ? (
              <div className="card p-5 text-center text-slate-400 text-sm">
                No hay comentarios. Sea el primero en agregar uno.
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-blue-700" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{comment.user_name || 'Usuario'}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(comment.created_at).toLocaleString('es-SV')}
                      </p>
                    </div>
                    {comment.is_internal && (
                      <span className="badge bg-slate-100 text-slate-600 border-slate-200 ml-auto">
                        Interno
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{comment.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card overflow-hidden">
          <div className="divide-y divide-slate-100">
            {history.length === 0 ? (
              <p className="p-5 text-center text-slate-400 text-sm">No hay cambios de estado registrados.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="p-4 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {h.from_status && (
                      <span className={`badge ${ALERT_STATUS_COLORS[h.from_status] || ''}`}>
                        {ALERT_STATUS_LABELS[h.from_status] || h.from_status}
                      </span>
                    )}
                    <span className="text-slate-400">→</span>
                    <span className={`badge ${ALERT_STATUS_COLORS[h.to_status] || ''}`}>
                      {ALERT_STATUS_LABELS[h.to_status] || h.to_status}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {h.reason && <p className="text-sm text-slate-700 truncate">{h.reason}</p>}
                    <p className="text-xs text-slate-400">
                      {h.user_name} — {new Date(h.changed_at).toLocaleString('es-SV')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal de cambio de estado */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Cambiar estado de la alerta</h2>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nuevo estado</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="input-field"
                >
                  {Object.entries(ALERT_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>

              {(newStatus === 'discarded' || newStatus === 'closed') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Justificación <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Explique la justificación para este cambio de estado..."
                    className="input-field resize-y"
                    rows={3}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Este campo es obligatorio para descartar o cerrar una alerta.
                  </p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowStatusModal(false)} className="btn-secondary">
                  Cancelar
                </button>
                <button
                  onClick={handleStatusChange}
                  disabled={(newStatus === 'discarded' || newStatus === 'closed') && !statusReason.trim()}
                  className="btn-primary"
                >
                  Confirmar cambio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showStatusConfirm}
        title="Confirmar cambio de estado"
        message={`Se cambiará el estado de "${ALERT_STATUS_LABELS[alert.status]}" a "${ALERT_STATUS_LABELS[newStatus]}". Esta acción quedará registrada en la bitácora.`}
        confirmLabel="Sí, cambiar estado"
        cancelLabel="No, cancelar"
        variant={newStatus === 'discarded' || newStatus === 'closed' ? 'danger' : 'warning'}
        onConfirm={executeStatusChange}
        onCancel={() => setShowStatusConfirm(false)}
      />
    </div>
  );
}

function getObservedResult(alert: Alert, dataUsed: Record<string, unknown> | null): string {
  const code = alert.indicator_code;
  switch (code) {
    case 'R018':
    case 'single_bidder': {
      const valid = dataUsed?.number_of_valid_bids ?? dataUsed?.number_of_bidders ?? 1;
      return `${valid} oferta válida recibida`;
    }
    case 'R003':
    case 'short_timelines': {
      const days = dataUsed?.days_between ?? dataUsed?.days ?? '—';
      return `${days} día(s) entre publicación y recepción de ofertas`;
    }
    case 'R063':
    case 'contract_splitting': {
      return dataUsed?.contract_published === false || dataUsed?.contract_document_published === false
        ? 'Sin documento contractual publicado'
        : 'Documento contractual no publicado dentro del período de gracia';
    }
    case 'R013':
    case 'non_competitive_methods': {
      const pct = dataUsed?.non_competitive_percentage ?? dataUsed?.percentage ?? '—';
      return `${pct}% de procesos no competitivos`;
    }
    case 'R040':
    case 'award_concentration': {
      const pct = dataUsed?.concentration_percentage ?? dataUsed?.percentage ?? '—';
      return `${pct}% de concentración del proveedor`;
    }
    default:
      return alert.calculation_detail || '—';
  }
}

function getConfidence(alert: Alert): string {
  if (alert.quality_note) return 'Media';
  return 'Alta';
}

function ExplainabilitySection({ alert, dataUsed }: { alert: Alert; dataUsed: Record<string, unknown> | null }) {
  const indicatorCode = alert.indicator_code;
  const indicatorName = INDICATOR_LABELS[indicatorCode] || indicatorCode;
  const ruleExplanation = INDICATOR_RULE_EXPLANATIONS[indicatorCode] || 'Regla de análisis automático aplicada a los datos del proceso.';
  const observedResult = getObservedResult(alert, dataUsed);
  const confidence = getConfidence(alert);
  const calcDate = new Date(alert.created_at).toLocaleDateString('es-SV');
  const indicatorVersion = alert.indicator?.current_version ? `${alert.indicator.current_version}.0` : '1.0';

  const rows = [
    { label: 'Indicador', value: indicatorName },
    { label: 'Resultado observado', value: observedResult },
    { label: 'Regla', value: ruleExplanation },
    { label: 'Resultado', value: 'Alerta activada', highlight: true },
    { label: 'Confianza del dato', value: confidence, withIcon: confidence === 'Alta' ? CheckCircle2 : undefined, iconColor: confidence === 'Alta' ? 'text-emerald-600' : 'text-amber-600' },
    { label: 'Fecha de cálculo', value: calcDate, withIcon: Calendar, iconColor: 'text-slate-400' },
    { label: 'Versión del indicador', value: indicatorVersion, withIcon: GitBranch, iconColor: 'text-slate-400' },
  ];

  return (
    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-slate-50 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5 bg-blue-900 text-white">
        <Lightbulb className="w-5 h-5 flex-shrink-0" />
        <h2 className="text-sm font-semibold">¿Por qué se generó esta alerta?</h2>
      </div>
      <div className="p-5">
        <dl className="space-y-0">
          {rows.map((row, i) => {
            const Icon = row.withIcon;
            return (
              <div
                key={row.label}
                className={`flex items-start gap-3 py-2.5 ${i < rows.length - 1 ? 'border-b border-slate-200/70' : ''}`}
              >
                <dt className="w-40 flex-shrink-0 text-xs font-medium text-slate-500 uppercase tracking-wide pt-0.5">
                  {row.label}
                </dt>
                <dd className={`flex items-center gap-1.5 text-sm flex-1 ${row.highlight ? 'font-semibold text-emerald-700' : 'text-slate-800'}`}>
                  {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${row.iconColor || ''}`} />}
                  {row.value}
                </dd>
              </div>
            );
          })}
        </dl>
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
          <p className="text-xs text-amber-800 leading-relaxed">
            Esta alerta constituye una señal preventiva y requiere revisión técnica. No representa por sí misma evidencia de irregularidad, responsabilidad administrativa, fraude o corrupción.
          </p>
        </div>
      </div>
    </div>
  );
}
