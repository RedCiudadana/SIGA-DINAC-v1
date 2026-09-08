import { useEffect, useState } from 'react';
import { History, Loader } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { DataUpload } from '@/types';
import type { ViewKey } from '@/components/AppShell';
import { HelpTooltip, InfoNote } from '@/components/HelpUI';

export function UploadsView({ onNavigate }: { onNavigate: (view: ViewKey) => void }) {
  const [uploads, setUploads] = useState<DataUpload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('data_uploads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setUploads((data || []) as DataUpload[]);
      setLoading(false);
    }
    load();
  }, []);

  const statusLabels: Record<string, string> = {
    pending: 'Pendiente', validating: 'Validando', preview: 'Previsualización',
    processing: 'Procesando', completed: 'Completada', failed: 'Fallida', cancelled: 'Cancelada',
  };
  const statusColors: Record<string, string> = {
    pending: 'bg-slate-100 text-slate-600 border-slate-200',
    validating: 'bg-blue-100 text-blue-700 border-blue-200',
    preview: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    processing: 'bg-amber-100 text-amber-700 border-amber-200',
    completed: 'bg-green-100 text-green-700 border-green-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold text-slate-900">Historial de cargas</h1>
          <HelpTooltip text="Cada carga de datos queda registrada aquí con su estado, número de registros y alertas generadas. Puede ver qué cargas se completaron, fallaron o están en proceso." />
        </div>
        <p className="text-sm text-slate-500 mt-1">Registro de todas las cargas de datos procesadas.</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-header">Nombre</th>
                <th className="table-header">Periodo</th>
                <th className="table-header">Archivo</th>
                <th className="table-header">Registros</th>
                <th className="table-header">Alertas</th>
                <th className="table-header">Estado</th>
                <th className="table-header">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-400 py-8">
                  <Loader className="w-5 h-5 mx-auto mb-2 text-slate-300 animate-spin" />
                  Cargando historial...
                </td></tr>
              ) : uploads.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center text-slate-400 py-8">
                  <History className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                  No hay cargas registradas.
                </td></tr>
              ) : (
                uploads.map((upload) => (
                  <tr key={upload.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <p className="font-medium text-slate-800">{upload.name}</p>
                      {upload.is_demo && <span className="text-xs text-blue-600">Demo</span>}
                    </td>
                    <td className="table-cell text-sm">{upload.period}</td>
                    <td className="table-cell text-xs text-slate-500">{upload.file_name}</td>
                    <td className="table-cell text-sm">{upload.total_records}</td>
                    <td className="table-cell">
                      <span className="text-sm font-semibold text-amber-700">{upload.alerts_generated}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${statusColors[upload.status] || ''}`}>
                        {statusLabels[upload.status] || upload.status}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-slate-500">
                      {new Date(upload.created_at).toLocaleString('es-SV')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
