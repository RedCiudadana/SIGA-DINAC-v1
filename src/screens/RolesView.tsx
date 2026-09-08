import { useEffect, useState } from 'react';
import { Shield, Check, X, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Role, Permission } from '@/types';
import { HelpTooltip, InfoNote } from '@/components/HelpUI';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function RolesView() {
  const { logAction } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [pendingRevoke, setPendingRevoke] = useState<{ role: Role; perm: Permission } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: roleData } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('code');
      setRoles((roleData || []) as Role[]);

      const { data: permData } = await supabase
        .from('permissions')
        .select('*')
        .order('module')
        .order('name');
      setPermissions((permData || []) as Permission[]);

      const { data: rpData } = await supabase
        .from('role_permissions')
        .select('role_id, permission_id');

      const m: Record<string, Set<string>> = {};
      (rpData || []).forEach((rp: { role_id: string; permission_id: string }) => {
        if (!m[rp.role_id]) m[rp.role_id] = new Set();
        m[rp.role_id].add(rp.permission_id);
      });
      setMatrix(m);
      setLoading(false);
    }
    load();
  }, []);

  const togglePermission = async (roleId: string, permissionId: string, currentlyHas: boolean) => {
    if (currentlyHas) {
      const role = roles.find((r) => r.id === roleId);
      const perm = permissions.find((p) => p.id === permissionId);
      if (role && perm) {
        setPendingRevoke({ role, perm });
        return;
      }
    }
    await executeToggle(roleId, permissionId, currentlyHas);
  };

  const executeToggle = async (roleId: string, permissionId: string, currentlyHas: boolean) => {
    if (currentlyHas) {
      await supabase.from('role_permissions').delete()
        .eq('role_id', roleId).eq('permission_id', permissionId);
      setMatrix((prev) => {
        const next = { ...prev };
        next[roleId]?.delete(permissionId);
        return { ...next, [roleId]: new Set(next[roleId] || []) };
      });
    } else {
      await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permissionId });
      setMatrix((prev) => {
        const s = new Set(prev[roleId] || []);
        s.add(permissionId);
        return { ...prev, [roleId]: s };
      });
    }
    const role = roles.find((r) => r.id === roleId);
    const perm = permissions.find((p) => p.id === permissionId);
    logAction('permission_changed', 'admin', `${currentlyHas ? 'Revocado' : 'Otorgado'} permiso "${perm?.name}" a rol "${role?.name}"`);
  };

  const modules = [...new Set(permissions.map((p) => p.module))];

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Cargando roles y permisos...</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold text-slate-900">Roles y permisos</h1>
          <HelpTooltip text="La matriz muestra qué puede hacer cada rol. Haga clic en las casillas para otorgar o revocar permisos. Los roles del sistema no se pueden eliminar." />
        </div>
        <p className="text-sm text-slate-500 mt-1">Matriz de permisos por rol. Los cambios quedan registrados en la bitácora.</p>
      </div>

      {/* Roles cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {roles.map((role) => {
          const permCount = matrix[role.id]?.size || 0;
          const isAdmin = role.code === 'admin_general';
          return (
            <div key={role.id} className="card p-5">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isAdmin ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {isAdmin ? <Shield className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">{role.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{role.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className={`badge ${isAdmin ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                      {permCount} permisos
                    </span>
                    {role.is_system && <span className="badge bg-slate-50 text-slate-500 border-slate-200">Sistema</span>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Matriz de permisos */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-header sticky left-0 bg-slate-50 min-w-[200px]">Permiso</th>
                {roles.map((r) => (
                  <th key={r.id} className="table-header text-center min-w-[120px]">
                    <span className="text-[11px] leading-tight block font-semibold">{r.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {modules.map((mod) => (
                <ModuleGroup
                  key={mod}
                  module={mod}
                  permissions={permissions.filter((p) => p.module === mod)}
                  roles={roles}
                  matrix={matrix}
                  onToggle={togglePermission}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <InfoNote variant="info">
        El sistema funciona con dos roles: Administrador General (control total del sistema) y Fiscalización (consulta y gestión de alertas asignadas). Al crear un usuario, elija el rol según las funciones que desempeñará.
      </InfoNote>

      <ConfirmDialog
        open={pendingRevoke !== null}
        title="Revocar permiso"
        message={`¿Seguro que desea revocar el permiso "${pendingRevoke?.perm.name}" del rol "${pendingRevoke?.role.name}"? Esto afectará a todos los usuarios con ese rol.`}
        confirmLabel="Revocar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={() => {
          if (pendingRevoke) executeToggle(pendingRevoke.role.id, pendingRevoke.perm.id, true);
          setPendingRevoke(null);
        }}
        onCancel={() => setPendingRevoke(null)}
      />
    </div>
  );
}

function ModuleGroup({ module, permissions, roles, matrix, onToggle }: {
  module: string;
  permissions: Permission[];
  roles: Role[];
  matrix: Record<string, Set<string>>;
  onToggle: (roleId: string, permissionId: string, currentlyHas: boolean) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <tr className="bg-slate-50/50 cursor-pointer" onClick={() => setCollapsed(!collapsed)}>
        <td colSpan={roles.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className={`inline-block transition-transform ${collapsed ? 'rotate-[-90deg]' : ''}`}>▾</span>
            {module}
          </span>
        </td>
      </tr>
      {!collapsed && permissions.map((perm) => (
        <tr key={perm.id} className="hover:bg-slate-50">
          <td className="table-cell">
            <p className="text-sm font-medium text-slate-700">{perm.name}</p>
            <p className="text-xs text-slate-400">{perm.description}</p>
          </td>
          {roles.map((role) => {
            const has = matrix[role.id]?.has(perm.id) || false;
            return (
              <td key={role.id} className="table-cell text-center">
                <button
                  onClick={() => onToggle(role.id, perm.id, has)}
                  className={`inline-flex w-7 h-7 items-center justify-center rounded-lg transition-colors ${
                    has
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                  title={has ? 'Revocar' : 'Otorgar'}
                >
                  {has ? <Check className="w-4 h-4" /> : <X className="w-3.5 h-3.5" />}
                </button>
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
