import { useEffect, useState } from 'react';
import { Database, Building2, Truck, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Institution, Supplier } from '@/types';
import { HelpTooltip } from '@/components/HelpUI';

export function CatalogsView() {
  const { hasPermission, logAction } = useAuth();
  const [tab, setTab] = useState<'institutions' | 'suppliers'>('institutions');
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ code: '', name: '', legal_id: '' });

  useEffect(() => {
    async function load() {
      const { data: instData } = await supabase.from('institutions').select('*').order('name');
      setInstitutions((instData || []) as Institution[]);
      const { data: supData } = await supabase.from('suppliers').select('*').order('name');
      setSuppliers((supData || []) as Supplier[]);
      setLoading(false);
    }
    load();
  }, []);

  const handleAdd = async () => {
    if (tab === 'institutions') {
      if (!newItem.code || !newItem.name) return;
      await supabase.from('institutions').insert({ code: newItem.code, name: newItem.name });
      logAction('catalog_added', 'config', `Institución agregada: ${newItem.name}`);
    } else {
      if (!newItem.code || !newItem.name) return;
      await supabase.from('suppliers').insert({ supplier_id: newItem.code, name: newItem.name, legal_id: newItem.legal_id });
      logAction('catalog_added', 'config', `Proveedor agregado: ${newItem.name}`);
    }
    setShowAdd(false);
    setNewItem({ code: '', name: '', legal_id: '' });
    setLoading(true);
    const { data: instData } = await supabase.from('institutions').select('*').order('name');
    setInstitutions((instData || []) as Institution[]);
    const { data: supData } = await supabase.from('suppliers').select('*').order('name');
    setSuppliers((supData || []) as Supplier[]);
    setLoading(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-bold text-slate-900">Catálogos institucionales</h1>
            <HelpTooltip text="Listas de instituciones compradoras y proveedores registrados en el sistema. Los catálogos se usan para identificar y agrupar procesos por entidad." />
          </div>
          <p className="text-sm text-slate-500 mt-1">Instituciones y proveedores registrados.</p>
        </div>
        {hasPermission('manage_catalogs') && (
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab('institutions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'institutions' ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500'}`}
        >
          <Building2 className="w-4 h-4" /> Instituciones ({institutions.length})
        </button>
        <button
          onClick={() => setTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 ${tab === 'suppliers' ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500'}`}
        >
          <Truck className="w-4 h-4" /> Proveedores ({suppliers.length})
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-header">Código</th>
                <th className="table-header">Nombre</th>
                {tab === 'suppliers' && <th className="table-header">Identificación</th>}
                <th className="table-header">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="table-cell text-center text-slate-400 py-8">Cargando...</td></tr>
              ) : tab === 'institutions' ? (
                institutions.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50">
                    <td className="table-cell font-mono text-xs">{inst.code}</td>
                    <td className="table-cell font-medium text-slate-800">{inst.name}</td>
                    <td className="table-cell">
                      <span className={`badge ${inst.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {inst.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                suppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-slate-50">
                    <td className="table-cell font-mono text-xs">{sup.supplier_id}</td>
                    <td className="table-cell font-medium text-slate-800">{sup.name}</td>
                    <td className="table-cell text-xs text-slate-500">{sup.legal_id || '—'}</td>
                    <td className="table-cell">
                      <span className={`badge ${sup.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {sup.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Agregar {tab === 'institutions' ? 'institución' : 'proveedor'}
            </h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Código *</label>
              <input value={newItem.code} onChange={(e) => setNewItem({ ...newItem, code: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre *</label>
              <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="input-field" />
            </div>
            {tab === 'suppliers' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Identificación legal</label>
                <input value={newItem.legal_id} onChange={(e) => setNewItem({ ...newItem, legal_id: e.target.value })} className="input-field" />
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleAdd} className="btn-primary">Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
