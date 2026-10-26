import { useState, useEffect } from 'react';
import {
  AlertTriangle, Database, Trash2, Shield, Loader,
  CheckCircle, XCircle, Info,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { InfoNote, HelpTooltip } from '@/components/HelpUI';

type ResetScope = 'all' | 'alerts' | 'processes';

interface TableInfo {
  name: string;
  label: string;
  count: number;
  preserved: boolean;
}

export function SystemResetView() {
  const { profile, logAction, hasPermission } = useAuth();
  const [scope, setScope] = useState<ResetScope>('all');
  const [confirmationText, setConfirmationText] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; details?: Record<string, unknown> } | null>(null);
  const [tableInfo, setTableInfo] = useState<TableInfo[]>([]);

  const loadCounts = async () => {
    setLoading(true);

    const [
      { count: procCount },
      { count: alertCount },
      { count: uploadCount },
      { count: dqCount },
      { count: commentCount },
      { count: docCount },
      { count: userCount },
      { count: roleCount },
      { count: permCount },
      { count: methodCount },
      { count: statusCount },
      { count: auditCount },
    ] = await Promise.all([
      supabase.from('procurement_processes').select('id', { count: 'exact', head: true }),
      supabase.from('alerts').select('id', { count: 'exact', head: true }),
      supabase.from('data_uploads').select('id', { count: 'exact', head: true }),
      supabase.from('data_quality_issues').select('id', { count: 'exact', head: true }),
      supabase.from('alert_comments').select('id', { count: 'exact', head: true }),
      supabase.from('alert_documents').select('id', { count: 'exact', head: true }),
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('roles').select('id', { count: 'exact', head: true }),
      supabase.from('permissions').select('id', { count: 'exact', head: true }),
      supabase.from('procurement_method_catalog').select('id', { count: 'exact', head: true }),
      supabase.from('contract_status_catalog').select('id', { count: 'exact', head: true }),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
    ]);

    setTableInfo([
      { name: 'procurement_processes', label: 'Procesos de contratación', count: procCount || 0, preserved: false },
      { name: 'alerts', label: 'Alertas', count: alertCount || 0, preserved: false },
      { name: 'data_uploads', label: 'Cargas de datos', count: uploadCount || 0, preserved: false },
      { name: 'data_quality_issues', label: 'Problemas de calidad', count: dqCount || 0, preserved: false },
      { name: 'alert_comments', label: 'Comentarios de alertas', count: commentCount || 0, preserved: false },
      { name: 'alert_documents', label: 'Documentos de alertas', count: docCount || 0, preserved: false },
      { name: 'user_profiles', label: 'Usuarios', count: userCount || 0, preserved: true },
      { name: 'roles', label: 'Roles', count: roleCount || 0, preserved: true },
      { name: 'permissions', label: 'Permisos', count: permCount || 0, preserved: true },
      { name: 'procurement_method_catalog', label: 'Catálogo de métodos', count: methodCount || 0, preserved: true },
      { name: 'contract_status_catalog', label: 'Catálogo de estados', count: statusCount || 0, preserved: true },
      { name: 'audit_logs', label: 'Bitácora de auditoría', count: auditCount || 0, preserved: true },
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadCounts();
  }, []);

  const handleReset = async () => {
    if (!confirmed || confirmationText !== 'REINICIAR') return;
    if (!hasPermission('reset_database')) {
      setResult({ success: false, message: 'No tiene permisos para realizar esta acción.' });
      return;
    }

    setResetting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('reset-database', {
        body: {
          confirmation: 'RESET_CONFIRMED',
          scope,
        },
      });

      if (error) {
        setResult({ success: false, message: 'Error al conectar con el servidor: ' + error.message });
      } else if (data?.error) {
        setResult({ success: false, message: data.error });
      } else {
        setResult({
          success: true,
          message: data.message || 'Base de datos reseteada correctamente.',
          details: data,
        });
        logAction('database_reset', 'admin', `Reseteo de base de datos ejecutado. Alcance: ${scope}`, undefined, 'success');
        await loadCounts();
        setConfirmed(false);
        setConfirmationText('');
      }
    } catch (err) {
      setResult({
        success: false,
        message: 'Error inesperado: ' + (err instanceof Error ? err.message : 'desconocido'),
      });
    }
    setResetting(false);
  };

  const dataTables = tableInfo.filter((t) => !t.preserved);
  const preservedTables = tableInfo.filter((t) => t.preserved);

  const scopeOptions: { value: ResetScope; label: string; description: string; tables: string[] }[] = [
    {
      value: 'all',
      label: 'Reseteo completo',
      description: 'Elimina todos los procesos, alertas, cargas y datos asociados. Conserva usuarios, roles, permisos, catálogos y bitácora.',
      tables: ['procurement_processes', 'alerts', 'data_uploads', 'data_quality_issues', 'alert_comments', 'alert_documents'],
    },
    {
      value: 'alerts',
      label: 'Solo alertas',
      description: 'Elimina todas las alertas, comentarios y documentos. Conserva los procesos y cargas de datos.',
      tables: ['alerts', 'alert_comments', 'alert_documents'],
    },
    {
      value: 'processes',
      label: 'Solo procesos',
      description: 'Elimina todos los procesos, cargas y problemas de calidad. Conserva las alertas existentes.',
      tables: ['procurement_processes', 'data_uploads', 'data_quality_issues'],
    },
  ];

  const selectedScope = scopeOptions.find((s) => s.value === scope)!;
  const recordsToDelete = tableInfo
    .filter((t) => selectedScope.tables.includes(t.name))
    .reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Database className="w-6 h-6 text-slate-700" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reseteo de base de datos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Permite eliminar todos los datos de análisis para iniciar un nuevo período desde cero.
          </p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="rounded-lg border border-red-300 bg-red-50 px-5 py-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-red-800">Acción irreversible</p>
            <p className="text-xs text-red-700 leading-relaxed">
              Esta acción eliminará permanentemente los datos seleccionados. No es posible deshacer el reseteo.
              Asegúrese de exportar los reportes necesarios antes de continuar. La acción quedá registrada en la bitácora de auditoría.
            </p>
          </div>
        </div>
      </div>

      {/* Permission check */}
      {!hasPermission('reset_database') && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Permiso requerido</p>
              <p className="text-xs text-amber-700 mt-1">
                Su rol actual no tiene el permiso "reset_database". Contacte al Super Administrador para solicitar acceso.
              </p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-slate-400">Cargando información...</div>
      ) : (
        <>
          {/* Current state */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Estado actual de la base de datos</h2>
              <HelpTooltip text="Resumen de los registros almacenados en cada tabla. Las tablas marcadas como conservadas no se eliminan durante el reseteo." />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Datos que se eliminan
                </p>
                <div className="space-y-1.5">
                  {dataTables.map((t) => (
                    <div key={t.name} className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 px-3 py-2">
                      <span className="text-xs text-slate-700">{t.label}</span>
                      <span className={`text-xs font-semibold ${t.count > 0 ? 'text-red-700' : 'text-slate-400'}`}>
                        {t.count.toLocaleString()} {t.count === 1 ? 'registro' : 'registros'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Datos que se conservan
                </p>
                <div className="space-y-1.5">
                  {preservedTables.map((t) => (
                    <div key={t.name} className="flex items-center justify-between rounded-lg border border-green-100 bg-green-50/50 px-3 py-2">
                      <span className="text-xs text-slate-700">{t.label}</span>
                      <span className="text-xs font-semibold text-green-700">
                        {t.count.toLocaleString()} {t.count === 1 ? 'registro' : 'registros'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Scope selection */}
          <div className="card p-6">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">Alcance del reseteo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {scopeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  disabled={!hasPermission('reset_database')}
                  className={`text-left rounded-lg border p-4 transition-all ${
                    scope === opt.value
                      ? 'border-blue-900 bg-blue-50 ring-1 ring-blue-900'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  } ${!hasPermission('reset_database') ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{opt.description}</p>
                </button>
              ))}
            </div>

            {recordsToDelete > 0 && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs text-amber-800">
                  <strong>{recordsToDelete.toLocaleString()}</strong> registros serán eliminados con esta opción.
                </p>
              </div>
            )}
          </div>

          {/* Confirmation */}
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900">Confirmación</h2>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  disabled={!hasPermission('reset_database')}
                  className="mt-1 w-4 h-4 rounded border-slate-300 text-blue-900 focus:ring-blue-900"
                />
                <span className="text-sm text-slate-700">
                  Entiendo que esta acción es <strong>irreversible</strong> y eliminará permanentemente los datos seleccionados.
                  He exportado los reportes necesarios y estoy autorizado a realizar esta operación.
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Escriba <span className="font-mono font-bold text-red-700">REINICIAR</span> para confirmar
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  disabled={!hasPermission('reset_database') || !confirmed}
                  className="input-field font-mono"
                  placeholder="Escriba REINICIAR aquí"
                />
              </div>
            </div>

            <button
              onClick={handleReset}
              disabled={!hasPermission('reset_database') || !confirmed || confirmationText !== 'REINICIAR' || resetting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {resetting ? (
                <><Loader className="w-4 h-4 animate-spin" /> Reseteando...</>
              ) : (
                <><Trash2 className="w-4 h-4" /> Resetear base de datos</>
              )}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-lg border p-5 ${result.success ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
              <div className="flex gap-3">
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-2">
                  <p className={`text-sm font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.success ? 'Reseteo completado' : 'Error en el reseteo'}
                  </p>
                  <p className={`text-xs ${result.success ? 'text-green-700' : 'text-red-700'}`}>{result.message}</p>
                  {result.details && (result.details as Record<string, Record<string, number>>).remaining && (
                    <div className="mt-2 pt-2 border-t border-green-200">
                      <p className="text-[11px] font-semibold text-green-700 mb-1">Verificación:</p>
                      <p className="text-[11px] text-green-600">
                        Procesos restantes: {Number((result.details.remaining as Record<string, number>).processes) || 0} ·
                        Alertas restantes: {Number((result.details.remaining as Record<string, number>).alerts) || 0} ·
                        Cargas restantes: {Number((result.details.remaining as Record<string, number>).uploads) || 0}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <InfoNote variant="info">
            El reseteo conserva: usuarios, roles, permisos, catálogos de métodos y estados, parámetros de indicadores, configuración de seguridad y bitácora de auditoría.
            Esto permite iniciar un nuevo análisis sin reconfigurar el sistema.
          </InfoNote>
        </>
      )}
    </div>
  );
}
