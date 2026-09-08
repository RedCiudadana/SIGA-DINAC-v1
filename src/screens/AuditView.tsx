import { useEffect, useState, useCallback } from 'react';
import { Search, ScrollText, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { AuditLog } from '@/types';
import { HelpTooltip, InfoNote } from '@/components/HelpUI';

export function AuditView() {
  const { logAction } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterModule, setFilterModule] = useState('');
  const [filterResult, setFilterResult] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (filterAction) query = query.eq('action_type', filterAction);
    if (filterModule) query = query.eq('module', filterModule);
    if (filterResult) query = query.eq('result', filterResult);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

    const { data } = await query;
    setLogs((data || []) as AuditLog[]);
    setLoading(false);
  }, [filterAction, filterModule, filterResult, dateFrom, dateTo]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    logAction('audit_log_viewed', 'admin', 'Consulta de bitácora');
  }, []);

  const filtered = logs.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (l.user_email || '').toLowerCase().includes(s) ||
      (l.description || '').toLowerCase().includes(s) ||
      (l.action_type || '').toLowerCase().includes(s)
    );
  });

  const handleExport = () => {
    const csv = [
      ['Fecha', 'Usuario', 'Rol', 'Unidad', 'Acción', 'Módulo', 'Descripción', 'Resultado'].join(','),
      ...filtered.map((l) => [
        new Date(l.created_at).toLocaleString('es-SV'),
        l.user_email || '—',
        l.user_role || '—',
        l.user_unit || '—',
        l.action_type,
        l.module,
        (l.description || '').replace(/"/g, '""'),
        l.result,
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bitacora_sia-dinac_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    logAction('audit_log_exported', 'admin', 'Exportación de bitácora');
  };

  const actionTypes = [...new Set(logs.map((l) => l.action_type))].sort();
  const modules = [...new Set(logs.map((l) => l.module))].sort();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-bold text-slate-900">Bitácora de auditoría</h1>
            <HelpTooltip text="Registro automático e inmutable de todas las acciones realizadas en el sistema: quién, qué, cuándo y con qué resultado. No puede modificarse ni eliminarse." />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Registro inmutable de acciones. Solo lectura. No puede modificarse ni eliminarse.
          </p>
        </div>
        <button onClick={handleExport} className="btn-secondary">
          <Download className="w-4 h-4" /> Exportar
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en bitácora..."
              className="input-field pl-9"
            />
          </div>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="input-field">
            <option value="">Todas las acciones</option>
            {actionTypes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className="input-field">
            <option value="">Todos los módulos</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filterResult} onChange={(e) => setFilterResult(e.target.value)} className="input-field">
            <option value="">Todos los resultados</option>
            <option value="success">Exitoso</option>
            <option value="failure">Fallido</option>
            <option value="warning">Advertencia</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field" />
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-header">Fecha y hora</th>
                <th className="table-header">Usuario</th>
                <th className="table-header">Rol</th>
                <th className="table-header">Acción</th>
                <th className="table-header">Módulo</th>
                <th className="table-header">Descripción</th>
                <th className="table-header">Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-400 py-8">
                  <ScrollText className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  Cargando bitácora...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-400 py-8">
                  No hay registros que coincidan con los filtros.
                </td></tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="table-cell text-xs text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('es-SV')}
                    </td>
                    <td className="table-cell text-xs text-slate-600">
                      {log.user_email || '—'}
                    </td>
                    <td className="table-cell text-xs text-slate-500">
                      {log.user_role || '—'}
                    </td>
                    <td className="table-cell">
                      <span className="text-xs font-mono text-slate-600">{log.action_type}</span>
                    </td>
                    <td className="table-cell text-xs text-slate-500">{log.module}</td>
                    <td className="table-cell text-xs text-slate-700 max-w-md truncate">
                      {log.description}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${
                        log.result === 'success' ? 'bg-green-50 text-green-700 border-green-200' :
                        log.result === 'failure' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {log.result === 'success' ? 'Exitoso' : log.result === 'failure' ? 'Fallido' : 'Advertencia'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
            {filtered.length} registro(s) — Mostrando máximo 500. Use filtros para acotar resultados.
          </div>
        )}
      </div>
    </div>
  );
}
