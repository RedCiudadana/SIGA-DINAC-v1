import { useEffect, useState, useCallback } from 'react';
import {
  Users, UserPlus, Shield, Ban, CheckCircle, XCircle, Download,
  Search, Mail,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  ROLE_LABELS, USER_STATUS_LABELS, USER_STATUS_COLORS,
  type UserProfile, type Role,
} from '@/types';
import { HelpTooltip, InfoNote } from '@/components/HelpUI';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function UsersView() {
  const { profile, logAction } = useAuth();
  const [users, setUsers] = useState<(UserProfile & { role: Role | null })[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<UserProfile | null>(null);

  const [inviteForm, setInviteForm] = useState({
    email: '', full_name: '', position: '', unit: '', role_id: '',
  });
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('*, role:roles(*)')
      .order('created_at', { ascending: false });
    setUsers((data || []) as (UserProfile & { role: Role | null })[]);

    const { data: roleData } = await supabase.from('roles').select('*').eq('is_active', true);
    setRoles((roleData || []) as Role[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  }).filter((u) => !filterRole || u.role?.code === filterRole)
    .filter((u) => !filterStatus || u.status === filterStatus);

  const handleInvite = async () => {
    setInviteLoading(true);
    setInviteError(null);

    if (!inviteForm.email || !inviteForm.full_name || !inviteForm.role_id || !invitePassword) {
      setInviteError('Todos los campos son obligatorios, incluyendo la contraseña temporal.');
      setInviteLoading(false);
      return;
    }

    try {
      const { data: result, error: invokeError } = await supabase.functions.invoke('create-user', {
        body: {
          email: inviteForm.email,
          password: invitePassword,
          full_name: inviteForm.full_name,
          position: inviteForm.position,
          organizational_unit: inviteForm.unit,
          role_id: inviteForm.role_id,
        },
      });

      if (invokeError) {
        setInviteError('Error al conectar con el servidor: ' + invokeError.message);
        setInviteLoading(false);
        return;
      }

      if (result?.error) {
        setInviteError(result.error);
        setInviteLoading(false);
        return;
      }

      logAction('user_created', 'admin', `Usuario creado: ${inviteForm.email}`, result?.user_id);
      setShowInviteModal(false);
      setInviteForm({ email: '', full_name: '', position: '', unit: '', role_id: '' });
      setInvitePassword('');
      loadUsers();
    } catch (err) {
      setInviteError('Error al crear el usuario: ' + (err instanceof Error ? err.message : 'desconocido'));
    }
    setInviteLoading(false);
  };

  const handleToggleStatus = async (user: UserProfile) => {
    const newStatus = user.status === 'active' ? 'suspended' : 'active';
    await supabase
      .from('user_profiles')
      .update({ status: newStatus, is_active: newStatus === 'active', updated_at: new Date().toISOString() })
      .eq('id', user.id);

    logAction(
      newStatus === 'active' ? 'user_activated' : 'user_suspended',
      'admin',
      `${newStatus === 'active' ? 'Activado' : 'Suspendido'}: ${user.email}`,
      user.id
    );
    setSuspendTarget(null);
    loadUsers();
  };

  const handleEditUser = async () => {
    if (!editingUser) return;
    await supabase
      .from('user_profiles')
      .update({
        full_name: editingUser.full_name,
        position: editingUser.position,
        organizational_unit: editingUser.organizational_unit,
        role_id: editingUser.role_id,
        updated_at: new Date().toISOString(),
        updated_by: profile?.user_id,
      })
      .eq('id', editingUser.id);

    logAction('user_modified', 'admin', `Usuario modificado: ${editingUser.email}`, editingUser.id);
    setShowEditModal(false);
    setEditingUser(null);
    loadUsers();
  };

  const handleExport = () => {
    const csv = [
      ['ID', 'Nombre', 'Correo', 'Cargo', 'Unidad', 'Rol', 'Estado', 'MFA', 'Creado', 'Último acceso'].join(','),
      ...filtered.map((u) => [
        u.id, u.full_name, u.email, u.position || '', u.organizational_unit || '',
        u.role?.name || '', u.status, u.mfa_enabled ? 'Sí' : 'No',
        new Date(u.created_at).toLocaleDateString('es-SV'),
        u.last_login_at ? new Date(u.last_login_at).toLocaleDateString('es-SV') : 'Nunca',
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios_sia-dinac_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    logAction('users_exported', 'admin', 'Exportación de listado de usuarios');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-bold text-slate-900">Administración de usuarios</h1>
            <HelpTooltip text="Gestione las personas que pueden acceder al sistema. Cada usuario debe tener un rol asignado que determina qué puede ver y hacer. Las acciones de creación, edición y suspensión quedan registradas en la bitácora." />
          </div>
          <p className="text-sm text-slate-500 mt-1">Gestión de usuarios autorizados del sistema.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button onClick={() => setShowInviteModal(true)} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Crear usuario
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              className="input-field pl-9"
            />
          </div>
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="input-field">
            <option value="">Todos los roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.code}>{r.name}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field">
            <option value="">Todos los estados</option>
            {Object.entries(USER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="table-header">Nombre</th>
                <th className="table-header">Correo</th>
                <th className="table-header">Cargo</th>
                <th className="table-header">Rol</th>
                <th className="table-header">Estado</th>
                <th className="table-header">MFA</th>
                <th className="table-header">Último acceso</th>
                <th className="table-header">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={8} className="table-cell text-center text-slate-400 py-8">Cargando usuarios...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center text-slate-400 py-8">No hay usuarios.</td></tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <p className="font-medium text-slate-800">{user.full_name}</p>
                      {user.organizational_unit && <p className="text-xs text-slate-400">{user.organizational_unit}</p>}
                    </td>
                    <td className="table-cell text-xs text-slate-600">{user.email}</td>
                    <td className="table-cell text-sm text-slate-600">{user.position || '—'}</td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-600">{user.role?.name || 'Sin rol'}</span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${USER_STATUS_COLORS[user.status] || ''}`}>
                        {USER_STATUS_LABELS[user.status] || user.status}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${user.mfa_enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {user.mfa_enabled ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-slate-500">
                      {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString('es-SV') : 'Nunca'}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingUser(user);
                            setShowEditModal(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-700"
                          title="Editar"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setSuspendTarget(user)}
                          className={`p-1.5 rounded-lg hover:bg-slate-100 ${
                            user.status === 'active' ? 'text-slate-500 hover:text-orange-600' : 'text-slate-500 hover:text-green-600'
                          }`}
                          title={user.status === 'active' ? 'Suspender' : 'Activar'}
                        >
                          {user.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear usuario */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Crear nuevo usuario</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre completo *</label>
                <input
                  type="text"
                  value={inviteForm.full_name}
                  onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo institucional *</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña temporal *</label>
                <input
                  type="text"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  className="input-field"
                  placeholder="Mínimo 12 caracteres"
                />
                <p className="text-xs text-slate-400 mt-1">El usuario deberá cambiarla al ingresar.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cargo</label>
                  <input
                    type="text"
                    value={inviteForm.position}
                    onChange={(e) => setInviteForm({ ...inviteForm, position: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Unidad</label>
                  <input
                    type="text"
                    value={inviteForm.unit}
                    onChange={(e) => setInviteForm({ ...inviteForm, unit: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Rol *</label>
                <select
                  value={inviteForm.role_id}
                  onChange={(e) => setInviteForm({ ...inviteForm, role_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Seleccione un rol</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              {inviteError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
                  <p className="text-xs text-red-800">{inviteError}</p>
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowInviteModal(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleInvite} disabled={inviteLoading} className="btn-primary">
                  {inviteLoading ? 'Creando...' : 'Crear usuario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar usuario */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Editar usuario</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre completo</label>
                <input
                  type="text"
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo</label>
                <input
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="input-field bg-slate-50 text-slate-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Cargo</label>
                  <input
                    type="text"
                    value={editingUser.position || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, position: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Unidad</label>
                  <input
                    type="text"
                    value={editingUser.organizational_unit || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, organizational_unit: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Rol</label>
                <select
                  value={editingUser.role_id || ''}
                  onChange={(e) => setEditingUser({ ...editingUser, role_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Sin rol</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowEditModal(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleEditUser} className="btn-primary">Guardar cambios</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={suspendTarget !== null}
        title={suspendTarget?.status === 'active' ? 'Suspender usuario' : 'Activar usuario'}
        message={
          suspendTarget?.status === 'active'
            ? `¿Seguro que desea suspender a ${suspendTarget?.full_name}? Este usuario no podrá iniciar sesión hasta que se reactive.`
            : `¿Seguro que desea reactivar a ${suspendTarget?.full_name}? Este usuario podrá iniciar sesión nuevamente.`
        }
        confirmLabel={suspendTarget?.status === 'active' ? 'Suspender' : 'Activar'}
        cancelLabel="Cancelar"
        variant={suspendTarget?.status === 'active' ? 'danger' : 'info'}
        onConfirm={() => suspendTarget && handleToggleStatus(suspendTarget)}
        onCancel={() => setSuspendTarget(null)}
      />
    </div>
  );
}
