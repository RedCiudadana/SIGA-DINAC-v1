import { useState } from 'react';
import { User, Lock, Save, Key } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ROLE_LABELS } from '@/types';

export function ProfileView() {
  const { profile, refreshProfile, logAction } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [position, setPosition] = useState(profile?.position || '');
  const [unit, setUnit] = useState(profile?.organizational_unit || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    await supabase.from('user_profiles').update({
      full_name: fullName,
      position,
      organizational_unit: unit,
      updated_at: new Date().toISOString(),
    }).eq('id', profile?.id);
    logAction('profile_updated', 'profile', 'Perfil actualizado');
    await refreshProfile();
    setSavingProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 12) {
      setPasswordError('La contraseña debe tener al menos 12 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.');
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setPasswordError('No se pudo cambiar la contraseña. Verifique su contraseña actual.');
    } else {
      await supabase.from('user_profiles').update({
        password_changed_at: new Date().toISOString(),
        force_password_change: false,
      }).eq('user_id', profile?.user_id);
      logAction('password_changed', 'profile', 'Cambio de contraseña');
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setChangingPassword(false);
  };

  if (!profile) {
    return <div className="text-center text-slate-400 py-8">No se pudo cargar el perfil.</div>;
  }

  const roleName = profile.role ? ROLE_LABELS[profile.role.code] || profile.role.name : 'Sin rol';

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Mi perfil</h1>
        <p className="text-sm text-slate-500 mt-1">Información personal y configuración de cuenta.</p>
      </div>

      {/* Información de cuenta */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">Información personal</h2>
        </div>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full bg-blue-900 text-white flex items-center justify-center text-2xl font-bold">
            {profile.full_name.charAt(0)}
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">{profile.full_name}</p>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <p className="text-xs text-slate-400 mt-0.5">{roleName}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre completo</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cargo</label>
            <input value={position} onChange={(e) => setPosition(e.target.value)} className="input-field" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Unidad organizativa</label>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className="input-field" />
          </div>
        </div>
        <button onClick={handleSaveProfile} disabled={savingProfile} className="btn-primary mt-4">
          <Save className="w-4 h-4" /> {savingProfile ? 'Guardando...' : profileSaved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </div>

      {/* Cambio de contraseña */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">Cambiar contraseña</h2>
        </div>
        {profile.force_password_change && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-800">Debe cambiar su contraseña temporal antes de continuar.</p>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña actual</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nueva contraseña</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" />
            <p className="text-xs text-slate-400 mt-1">Mínimo 12 caracteres.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar nueva contraseña</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-field" />
          </div>
          {passwordError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5">
              <p className="text-xs text-red-800">{passwordError}</p>
            </div>
          )}
          {passwordSuccess && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
              <p className="text-xs text-green-800">Contraseña cambiada exitosamente.</p>
            </div>
          )}
          <button onClick={handleChangePassword} disabled={changingPassword || !newPassword} className="btn-primary">
            <Key className="w-4 h-4" /> {changingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
          </button>
        </div>
      </div>

      {/* Seguridad */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-5 h-5 text-blue-700" />
          <h2 className="text-sm font-semibold text-slate-900">Seguridad de la cuenta</h2>
        </div>
        <dl className="space-y-2.5">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-600">Autenticación multifactor</dt>
            <dd>
              <span className={`badge ${profile.mfa_enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                {profile.mfa_enabled ? 'Activa' : 'Inactiva'}
              </span>
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-600">Último cambio de contraseña</dt>
            <dd className="text-sm text-slate-700">{new Date(profile.password_changed_at).toLocaleDateString('es-SV')}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-600">Último acceso</dt>
            <dd className="text-sm text-slate-700">{profile.last_login_at ? new Date(profile.last_login_at).toLocaleString('es-SV') : 'Nunca'}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-slate-600">Expiración de acceso</dt>
            <dd className="text-sm text-slate-700">{profile.access_expires_at ? new Date(profile.access_expires_at).toLocaleDateString('es-SV') : 'Sin expiración'}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
