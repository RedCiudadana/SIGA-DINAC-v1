import { useEffect, useState, useCallback } from 'react';
import {
  Settings, Save, Power, History, Plus, Trash2, Pencil, X,
  AlertTriangle, FileText, GitBranch, RotateCcw, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type {
  IndicatorDefinition, IndicatorParameter,
  IndicatorVersion, IndicatorConfigHistory,
} from '@/types';
import { HelpTooltip } from '@/components/HelpUI';

type TabKey = 'detail' | 'params' | 'versions' | 'history';

interface NewParam {
  param_key: string;
  param_value: string;
  param_type: string;
  description: string;
}

const PARAM_TYPES = [
  { value: 'number', label: 'Número' },
  { value: 'text', label: 'Texto' },
  { value: 'json', label: 'JSON' },
  { value: 'boolean', label: 'Booleano' },
];

export function IndicatorsView() {
  const { profile, logAction } = useAuth();
  const [indicators, setIndicators] = useState<IndicatorDefinition[]>([]);
  const [params, setParams] = useState<Record<string, IndicatorParameter[]>>({});
  const [versions, setVersions] = useState<IndicatorVersion[]>([]);
  const [history, setHistory] = useState<IndicatorConfigHistory[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<TabKey>('detail');

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showParamModal, setShowParamModal] = useState(false);
  const [editingParam, setEditingParam] = useState<IndicatorParameter | null>(null);
  const [newParam, setNewParam] = useState<NewParam>({ param_key: '', param_value: '', param_type: 'number', description: '' });

  // Formulario crear/editar indicador
  const [indicatorForm, setIndicatorForm] = useState({
    code: '', name: '', description: '', methodology: '',
    formula: '', required_fields: '', exclusions: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: indData } = await supabase.from('indicator_definitions').select('*').order('code');
    const indList = (indData || []) as IndicatorDefinition[];
    setIndicators(indList);

    const paramMap: Record<string, IndicatorParameter[]> = {};
    for (const ind of indList) {
      const { data: p } = await supabase
        .from('indicator_parameters')
        .select('*')
        .eq('indicator_id', ind.id)
        .eq('is_active', true);
      paramMap[ind.id] = (p || []) as IndicatorParameter[];
    }
    setParams(paramMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Cargar versiones e historial cuando se selecciona un indicador
  useEffect(() => {
    if (!selected) {
      setVersions([]);
      setHistory([]);
      return;
    }
    setTab('detail');
    supabase.from('indicator_versions')
      .select('*').eq('indicator_id', selected).order('version', { ascending: false })
      .then(({ data }) => setVersions((data || []) as IndicatorVersion[]));

    supabase.from('indicator_config_history')
      .select('*').eq('indicator_id', selected).order('created_at', { ascending: false })
      .then(({ data }) => setHistory((data || []) as IndicatorConfigHistory[]));
  }, [selected]);

  const selectedIndicator = indicators.find((i) => i.id === selected);
  const selectedParams = selected ? params[selected] || [] : [];

  // ---- Operaciones CRUD ----

  const handleCreateIndicator = async () => {
    if (!indicatorForm.code || !indicatorForm.name) return;
    const { data, error } = await supabase.from('indicator_definitions').insert({
      code: indicatorForm.code,
      name: indicatorForm.name,
      description: indicatorForm.description || null,
      methodology: indicatorForm.methodology || null,
      formula: indicatorForm.formula || null,
      required_fields: indicatorForm.required_fields || null,
      exclusions: indicatorForm.exclusions || null,
      is_active: true,
      current_version: 1,
      created_by: profile?.user_id,
    }).select('id').single();

    if (!error && data) {
      logAction('indicator_created', 'config', `Indicador creado: ${indicatorForm.name}`, data.id);
      setShowCreateModal(false);
      setIndicatorForm({ code: '', name: '', description: '', methodology: '', formula: '', required_fields: '', exclusions: '' });
      await load();
      setSelected(data.id);
    }
  };

  const handleEditIndicator = async () => {
    if (!selectedIndicator) return;
    const { error } = await supabase.from('indicator_definitions').update({
      name: indicatorForm.name,
      description: indicatorForm.description || null,
      methodology: indicatorForm.methodology || null,
      formula: indicatorForm.formula || null,
      required_fields: indicatorForm.required_fields || null,
      exclusions: indicatorForm.exclusions || null,
      updated_at: new Date().toISOString(),
      updated_by: profile?.user_id,
    }).eq('id', selectedIndicator.id);

    if (!error) {
      logAction('indicator_edited', 'config', `Indicador editado: ${indicatorForm.name}`, selectedIndicator.id);
      setShowEditModal(false);
      await load();
    }
  };

  const handleDeleteIndicator = async () => {
    if (!selectedIndicator) return;
    // Desactivar en lugar de borrar físicamente (conservar trazabilidad)
    await supabase.from('indicator_definitions').update({
      is_active: false, updated_at: new Date().toISOString(),
    }).eq('id', selectedIndicator.id);

    logAction('indicator_deleted', 'config', `Indicador desactivado: ${selectedIndicator.name}`, selectedIndicator.id);
    setShowDeleteModal(false);
    setSelected(null);
    await load();
  };

  const handleToggleIndicator = async (ind: IndicatorDefinition) => {
    const newVal = !ind.is_active;
    await supabase.from('indicator_definitions').update({
      is_active: newVal, updated_at: new Date().toISOString(),
    }).eq('id', ind.id);
    logAction('indicator_toggled', 'config', `Indicador ${ind.name} ${newVal ? 'activado' : 'desactivado'}`, ind.id);
    load();
  };

  const handleSaveParams = async () => {
    if (!selected || !selectedIndicator) return;
    setSaving(true);

    // Guardar versión anterior
    const snapshot: Record<string, string> = {};
    selectedParams.forEach((p) => { snapshot[p.param_key] = p.param_value; });

    const newVersion = selectedIndicator.current_version + 1;

    await supabase.from('indicator_versions').insert({
      indicator_id: selected,
      version: newVersion,
      parameters_snapshot: snapshot,
      change_description: `Versión ${newVersion} - actualización de parámetros`,
      published: true,
      created_by: profile?.user_id,
    });

    // Actualizar parámetros
    for (const p of selectedParams) {
      await supabase.from('indicator_parameters').update({
        param_value: p.param_value,
        version: newVersion,
        updated_at: new Date().toISOString(),
      }).eq('id', p.id);
    }

    // Actualizar versión actual del indicador
    await supabase.from('indicator_definitions').update({
      current_version: newVersion,
      updated_at: new Date().toISOString(),
      updated_by: profile?.user_id,
    }).eq('id', selected);

    // Registrar en historial
    await supabase.from('indicator_config_history').insert({
      indicator_id: selected,
      action: 'params_updated',
      field_changed: 'parameters',
      old_value: `v${selectedIndicator.current_version}`,
      new_value: `v${newVersion}`,
      version: newVersion,
      created_by: profile?.user_id,
      user_email: profile?.email,
    });

    logAction('indicator_params_changed', 'config', `Parámetros actualizados para ${selectedIndicator.name} (v${newVersion})`, selected || undefined);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    setSaving(false);
    await load();

    // Recargar versiones e historial
    if (selected) {
      supabase.from('indicator_versions')
        .select('*').eq('indicator_id', selected).order('version', { ascending: false })
        .then(({ data }) => setVersions((data || []) as IndicatorVersion[]));
      supabase.from('indicator_config_history')
        .select('*').eq('indicator_id', selected).order('created_at', { ascending: false })
        .then(({ data }) => setHistory((data || []) as IndicatorConfigHistory[]));
    }
  };

  const handleAddParam = async () => {
    if (!selected || !newParam.param_key || !newParam.param_value) return;
    const { data, error } = await supabase.from('indicator_parameters').insert({
      indicator_id: selected,
      param_key: newParam.param_key,
      param_value: newParam.param_value,
      param_type: newParam.param_type,
      description: newParam.description || null,
      version: selectedIndicator?.current_version || 1,
      is_active: true,
      created_by: profile?.user_id,
    }).select('*').single();

    if (!error && data) {
      setParams({ ...params, [selected]: [...selectedParams, data as IndicatorParameter] });
      logAction('indicator_param_added', 'config', `Parámetro agregado: ${newParam.param_key} a ${selectedIndicator?.name}`, selected || undefined);
      setShowParamModal(false);
      setNewParam({ param_key: '', param_value: '', param_type: 'number', description: '' });
    }
  };

  const handleEditParam = async () => {
    if (!selected || !editingParam) return;
    await supabase.from('indicator_parameters').update({
      param_value: editingParam.param_value,
      description: editingParam.description,
      updated_at: new Date().toISOString(),
    }).eq('id', editingParam.id);

    setParams({
      ...params,
      [selected]: selectedParams.map((p) => p.id === editingParam.id ? editingParam : p),
    });
    logAction('indicator_param_edited', 'config', `Parámetro editado: ${editingParam.param_key}`, selected || undefined);
    setShowParamModal(false);
    setEditingParam(null);
  };

  const handleDeleteParam = async (paramId: string, paramKey: string) => {
    await supabase.from('indicator_parameters').update({
      is_active: false, updated_at: new Date().toISOString(),
    }).eq('id', paramId);

    setParams({
      ...params,
      [selected!]: selectedParams.filter((p) => p.id !== paramId),
    });
    logAction('indicator_param_deleted', 'config', `Parámetro eliminado: ${paramKey}`, selected || undefined);
  };

  const handleRestoreVersion = async (ver: IndicatorVersion) => {
    if (!selected || !selectedIndicator) return;
    const snapshot = ver.parameters_snapshot as Record<string, string>;

    for (const p of selectedParams) {
      if (snapshot[p.param_key] !== undefined) {
        await supabase.from('indicator_parameters').update({
          param_value: snapshot[p.param_key],
          updated_at: new Date().toISOString(),
        }).eq('id', p.id);
      }
    }

    logAction('indicator_version_restored', 'config', `Restaurada versión ${ver.version} de ${selectedIndicator.name}`, selected || undefined);
    await load();
    if (selected) {
      supabase.from('indicator_versions')
        .select('*').eq('indicator_id', selected).order('version', { ascending: false })
        .then(({ data }) => setVersions((data || []) as IndicatorVersion[]));
    }
  };

  const openEditModal = (ind: IndicatorDefinition) => {
    setIndicatorForm({
      code: ind.code, name: ind.name,
      description: ind.description || '', methodology: ind.methodology || '',
      formula: ind.formula || '', required_fields: ind.required_fields || '',
      exclusions: ind.exclusions || '',
    });
    setShowEditModal(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Cargando indicadores...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración de indicadores</h1>
          <p className="text-sm text-slate-500 mt-1">Administre las banderas rojas del sistema: crear, editar, activar, desactivar y ajustar umbrales.</p>
          <p className="text-xs text-slate-400 mt-1">Cada indicador es una regla de análisis con su metodología, fórmula y umbrales. Los cambios crean una nueva versión y quedan registrados.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo indicador
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Lista de indicadores */}
        <div className="space-y-2">
          {indicators.length === 0 ? (
            <div className="card p-6 text-center text-slate-400 text-sm">
              No hay indicadores. Cree uno nuevo con el botón superior.
            </div>
          ) : (
            indicators.map((ind) => (
              <button
                key={ind.id}
                onClick={() => setSelected(ind.id)}
                className={`card w-full p-4 text-left transition-all ${
                  selected === ind.id ? 'ring-2 ring-blue-900' : 'hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{ind.name}</h3>
                  <span className={`badge flex-shrink-0 ${ind.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                    {ind.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{ind.description}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-mono text-slate-400">{ind.code}</span>
                  <span className="text-[10px] text-slate-400">v{ind.current_version}</span>
                  {(params[ind.id] || []).length > 0 && (
                    <span className="text-[10px] text-blue-600">{(params[ind.id] || []).length} parámetros</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detalle del indicador */}
        {selectedIndicator ? (
          <div className="lg:col-span-2 space-y-4">
            {/* Header con acciones */}
            <div className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-700" />
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">{selectedIndicator.name}</h2>
                    <p className="text-[10px] font-mono text-slate-400">{selectedIndicator.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEditModal(selectedIndicator)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleToggleIndicator(selectedIndicator)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                      selectedIndicator.is_active
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {selectedIndicator.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-3">{selectedIndicator.description}</p>
              <div className="rounded-lg bg-slate-50 p-3 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Metodología</p>
                  <p className="text-xs text-slate-600 mt-0.5">{selectedIndicator.methodology || 'No definida'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Fórmula</p>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">{selectedIndicator.formula || 'No definida'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Campos requeridos</p>
                  <p className="text-xs text-slate-600 mt-0.5">{selectedIndicator.required_fields || 'No definidos'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">Exclusiones</p>
                  <p className="text-xs text-slate-600 mt-0.5">{selectedIndicator.exclusions || 'Sin exclusiones'}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200">
              {[
                { key: 'detail' as const, label: 'Detalle', icon: FileText },
                { key: 'params' as const, label: `Parámetros (${selectedParams.length})`, icon: Settings },
                { key: 'versions' as const, label: `Versiones (${versions.length})`, icon: GitBranch },
                { key: 'history' as const, label: 'Historial', icon: History },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                      tab === t.key ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab: Detalle */}
            {tab === 'detail' && (
              <div className="card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900">Información del indicador</h2>
                <dl className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-xs text-slate-400">Código</dt>
                    <dd className="text-sm text-slate-700 font-mono">{selectedIndicator.code}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Versión actual</dt>
                    <dd className="text-sm text-slate-700">{selectedIndicator.current_version}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Estado</dt>
                    <dd>
                      <span className={`badge ${selectedIndicator.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {selectedIndicator.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Parámetros</dt>
                    <dd className="text-sm text-slate-700">{selectedParams.length} configurados</dd>
                  </div>
                </dl>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex gap-2">
                    <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Las alertas generadas por este indicador son señales preventivas. No constituyen evidencia de irregularidad. Requieren revisión técnica y documental.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Parámetros */}
            {tab === 'params' && (
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">Parámetros configurables</h2>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingParam(null); setNewParam({ param_key: '', param_value: '', param_type: 'number', description: '' }); setShowParamModal(true); }} className="btn-secondary text-xs">
                      <Plus className="w-3.5 h-3.5" /> Agregar parámetro
                    </button>
                    <button onClick={handleSaveParams} disabled={saving} className="btn-primary text-xs">
                      <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar versión'}
                    </button>
                  </div>
                </div>

                {selectedParams.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No hay parámetros configurados. Agregue uno para definir umbrales y configuraciones.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedParams.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold text-slate-700">{p.param_key}</span>
                            <span className="text-[10px] text-slate-400 uppercase">{p.param_type}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{p.description || 'Sin descripción'}</p>
                        </div>
                        <input
                          type={p.param_type === 'number' ? 'number' : 'text'}
                          value={p.param_value}
                          onChange={(e) => {
                            const updated = selectedParams.map((x) =>
                              x.id === p.id ? { ...x, param_value: e.target.value } : x
                            );
                            setParams({ ...params, [selected!]: updated });
                          }}
                          className="input-field max-w-[160px] text-sm"
                        />
                        <button
                          onClick={() => { setEditingParam(p); setShowParamModal(true); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-blue-700"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteParam(p.id, p.param_key)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-[11px] text-blue-800">
                    Al guardar, se crea una nueva versión del indicador y se registra en el historial. Los cambios quedan en la bitácora institucional.
                  </p>
                </div>
              </div>
            )}

            {/* Tab: Versiones */}
            {tab === 'versions' && (
              <div className="card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900">Historial de versiones</h2>
                {versions.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No hay versiones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {versions.map((ver) => (
                      <div key={ver.id} className="rounded-lg border border-slate-200 p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                            <GitBranch className="w-4 h-4 text-blue-700" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">Versión {ver.version}</p>
                            <p className="text-xs text-slate-500">{ver.change_description || 'Sin descripción'}</p>
                            <p className="text-[10px] text-slate-400">{new Date(ver.created_at).toLocaleString('es-SV')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {ver.version === selectedIndicator.current_version && (
                            <span className="badge bg-green-50 text-green-700 border-green-200">Actual</span>
                          )}
                          {ver.version !== selectedIndicator.current_version && (
                            <button
                              onClick={() => handleRestoreVersion(ver)}
                              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-medium"
                            >
                              <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Historial de cambios */}
            {tab === 'history' && (
              <div className="card p-5 space-y-4">
                <h2 className="text-sm font-semibold text-slate-900">Historial de modificaciones</h2>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No hay modificaciones registradas.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h) => (
                      <div key={h.id} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge ${
                            h.action.includes('created') ? 'bg-green-50 text-green-700 border-green-200' :
                            h.action.includes('deleted') ? 'bg-red-50 text-red-700 border-red-200' :
                            h.action.includes('restored') ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>{h.action}</span>
                          {h.version && <span className="text-[10px] text-slate-400">v{h.version}</span>}
                          <span className="text-[10px] text-slate-400 ml-auto">{new Date(h.created_at).toLocaleString('es-SV')}</span>
                        </div>
                        {h.field_changed && (
                          <p className="text-xs text-slate-600">
                            Campo: <span className="font-mono">{h.field_changed}</span>
                            {h.old_value && h.new_value && ` — ${h.old_value} → ${h.new_value}`}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">Por: {h.user_email || 'Sistema'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="lg:col-span-2 card p-12 text-center text-slate-400">
            <Settings className="w-8 h-8 mx-auto mb-3 text-slate-300" />
            Seleccione un indicador para ver y editar su configuración.
          </div>
        )}
      </div>

      {/* ====== Modal: Crear indicador ====== */}
      {showCreateModal && (
        <Modal title="Nuevo indicador" onClose={() => setShowCreateModal(false)}>
          <IndicatorForm
            form={indicatorForm}
            setForm={setIndicatorForm}
            codeDisabled={false}
            onSubmit={handleCreateIndicator}
            submitLabel="Crear indicador"
          />
        </Modal>
      )}

      {/* ====== Modal: Editar indicador ====== */}
      {showEditModal && (
        <Modal title="Editar indicador" onClose={() => setShowEditModal(false)}>
          <IndicatorForm
            form={indicatorForm}
            setForm={setIndicatorForm}
            codeDisabled
            onSubmit={handleEditIndicator}
            submitLabel="Guardar cambios"
          />
        </Modal>
      )}

      {/* ====== Modal: Eliminar indicador ====== */}
      {showDeleteModal && selectedIndicator && (
        <Modal title="Eliminar indicador" onClose={() => setShowDeleteModal(false)}>
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">
                  El indicador <strong>{selectedIndicator.name}</strong> será desactivado. Las alertas existentes se conservan para trazabilidad. Esta acción queda registrada en la bitácora.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowDeleteModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleDeleteIndicator} className="btn-danger">
                <Trash2 className="w-4 h-4" /> Desactivar indicador
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ====== Modal: Agregar/Editar parámetro ====== */}
      {showParamModal && (
        <Modal
          title={editingParam ? 'Editar parámetro' : 'Nuevo parámetro'}
          onClose={() => { setShowParamModal(false); setEditingParam(null); }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Clave *</label>
              <input
                type="text"
                value={editingParam ? editingParam.param_key : newParam.param_key}
                disabled={!!editingParam}
                onChange={(e) => editingParam
                  ? setEditingParam({ ...editingParam, param_key: e.target.value })
                  : setNewParam({ ...newParam, param_key: e.target.value })}
                className={`input-field ${editingParam ? 'bg-slate-50 text-slate-500' : ''}`}
                placeholder="Ej: threshold_amount"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Valor *</label>
              <input
                type={editingParam?.param_type === 'number' || newParam.param_type === 'number' ? 'number' : 'text'}
                value={editingParam ? editingParam.param_value : newParam.param_value}
                onChange={(e) => editingParam
                  ? setEditingParam({ ...editingParam, param_value: e.target.value })
                  : setNewParam({ ...newParam, param_value: e.target.value })}
                className="input-field"
                placeholder="Ej: 100000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo</label>
              <select
                value={editingParam ? editingParam.param_type : newParam.param_type}
                disabled={!!editingParam}
                onChange={(e) => {
                  if (editingParam) {
                    setEditingParam({ ...editingParam, param_type: e.target.value });
                  } else {
                    setNewParam({ ...newParam, param_type: e.target.value });
                  }
                }}
                className={`input-field ${editingParam ? 'bg-slate-50 text-slate-500' : ''}`}
              >
                {PARAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción</label>
              <input
                type="text"
                value={editingParam ? (editingParam.description || '') : newParam.description}
                onChange={(e) => editingParam
                  ? setEditingParam({ ...editingParam, description: e.target.value })
                  : setNewParam({ ...newParam, description: e.target.value })}
                className="input-field"
                placeholder="Ej: Umbral de monto acumulado"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setShowParamModal(false); setEditingParam(null); }} className="btn-secondary">Cancelar</button>
              <button
                onClick={editingParam ? handleEditParam : handleAddParam}
                disabled={editingParam ? !editingParam.param_value : !newParam.param_key || !newParam.param_value}
                className="btn-primary"
              >
                {editingParam ? 'Guardar cambios' : 'Agregar parámetro'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ====== Componente: Modal reutilizable ======
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ====== Componente: Formulario de indicador ======
function IndicatorForm({
  form, setForm, codeDisabled, onSubmit, submitLabel,
}: {
  form: { code: string; name: string; description: string; methodology: string; formula: string; required_fields: string; exclusions: string };
  setForm: (f: typeof form) => void;
  codeDisabled: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Código *</label>
          <input
            type="text"
            value={form.code}
            disabled={codeDisabled}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            className={`input-field ${codeDisabled ? 'bg-slate-50 text-slate-500' : ''}`}
            placeholder="Ej: single_bidder"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input-field"
            placeholder="Ej: Único oferente"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="input-field resize-y"
          rows={2}
          placeholder="Breve descripción del indicador"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Metodología</label>
        <textarea
          value={form.methodology}
          onChange={(e) => setForm({ ...form, methodology: e.target.value })}
          className="input-field resize-y"
          rows={3}
          placeholder="Explicación detallada de cómo se calcula el indicador"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Fórmula</label>
        <input
          type="text"
          value={form.formula}
          onChange={(e) => setForm({ ...form, formula: e.target.value })}
          className="input-field font-mono text-xs"
          placeholder="Ej: number_of_bidders = 1 AND method IN (competitive)"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Campos requeridos</label>
        <input
          type="text"
          value={form.required_fields}
          onChange={(e) => setForm({ ...form, required_fields: e.target.value })}
          className="input-field"
          placeholder="Ej: process_id, procurement_method, number_of_bidders"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Exclusiones</label>
        <input
          type="text"
          value={form.exclusions}
          onChange={(e) => setForm({ ...form, exclusions: e.target.value })}
          className="input-field"
          placeholder="Ej: Modalidades no competitivas"
        />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onSubmit} disabled={!form.code || !form.name} className="btn-primary">
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
