import { useEffect, useState } from 'react';
import { Save, Shield, Lock, Clock, FileText, Key } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { SecuritySettings } from '@/types';
import { HelpTooltip } from '@/components/HelpUI';

export function SecurityView() {
  const { logAction } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('security_settings').select('*').maybeSingle();
      if (data) setSettings(data as SecuritySettings);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from('security_settings').update({
      max_session_minutes: settings.max_session_minutes,
      inactivity_timeout_minutes: settings.inactivity_timeout_minutes,
      max_failed_attempts: settings.max_failed_attempts,
      lockout_duration_minutes: settings.lockout_duration_minutes,
      password_min_length: settings.password_min_length,
      password_require_uppercase: settings.password_require_uppercase,
      password_require_lowercase: settings.password_require_lowercase,
      password_require_number: settings.password_require_number,
      password_require_special: settings.password_require_special,
      mfa_required: settings.mfa_required,
      default_access_expiry_days: settings.default_access_expiry_days,
      file_retention_days: settings.file_retention_days,
      audit_retention_days: settings.audit_retention_days,
      allowed_file_types: settings.allowed_file_types,
      max_file_size_mb: settings.max_file_size_mb,
      allow_export: settings.allow_export,
      allow_download: settings.allow_download,
      restricted_access_message: settings.restricted_access_message,
      updated_at: new Date().toISOString(),
    }).eq('id', settings.id);

    if (!error) {
      setSaved(true);
      logAction('security_config_changed', 'admin', 'Configuración de seguridad actualizada');
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  if (loading || !settings) {
    return <div className="flex items-center justify-center h-64 text-slate-400">Cargando configuración...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-bold text-slate-900">Configuración de seguridad</h1>
            <HelpTooltip text="Defina las políticas de contraseñas, sesiones, bloqueo por intentos fallidos y retención de datos. Los cambios afectan a todos los usuarios inmediatamente." />
          </div>
          <p className="text-sm text-slate-500 mt-1">Parámetros de seguridad del sistema. Los cambios quedan registrados en la bitácora.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" /> {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Sesiones */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Sesiones</h2>
          </div>
          <div className="space-y-3">
            <NumberField
              label="Duración máxima de sesión (minutos)"
              value={settings.max_session_minutes}
              onChange={(v) => setSettings({ ...settings, max_session_minutes: v })}
            />
            <NumberField
              label="Cierre por inactividad (minutos)"
              value={settings.inactivity_timeout_minutes}
              onChange={(v) => setSettings({ ...settings, inactivity_timeout_minutes: v })}
            />
            <NumberField
              label="Máximo de intentos fallidos"
              value={settings.max_failed_attempts}
              onChange={(v) => setSettings({ ...settings, max_failed_attempts: v })}
            />
            <NumberField
              label="Duración del bloqueo temporal (minutos)"
              value={settings.lockout_duration_minutes}
              onChange={(v) => setSettings({ ...settings, lockout_duration_minutes: v })}
            />
          </div>
        </div>

        {/* Contraseñas */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Contraseñas y MFA</h2>
          </div>
          <div className="space-y-3">
            <NumberField
              label="Longitud mínima de contraseña"
              value={settings.password_min_length}
              onChange={(v) => setSettings({ ...settings, password_min_length: v })}
            />
            <ToggleField
              label="Requerir mayúsculas"
              value={settings.password_require_uppercase}
              onChange={(v) => setSettings({ ...settings, password_require_uppercase: v })}
            />
            <ToggleField
              label="Requerir minúsculas"
              value={settings.password_require_lowercase}
              onChange={(v) => setSettings({ ...settings, password_require_lowercase: v })}
            />
            <ToggleField
              label="Requerir números"
              value={settings.password_require_number}
              onChange={(v) => setSettings({ ...settings, password_require_number: v })}
            />
            <ToggleField
              label="Requerir caracteres especiales"
              value={settings.password_require_special}
              onChange={(v) => setSettings({ ...settings, password_require_special: v })}
            />
            <ToggleField
              label="Autenticación multifactor obligatoria"
              value={settings.mfa_required}
              onChange={(v) => setSettings({ ...settings, mfa_required: v })}
            />
          </div>
        </div>

        {/* Retención y archivos */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Retención y archivos</h2>
          </div>
          <div className="space-y-3">
            <NumberField
              label="Expiración de acceso de usuarios (días)"
              value={settings.default_access_expiry_days}
              onChange={(v) => setSettings({ ...settings, default_access_expiry_days: v })}
            />
            <NumberField
              label="Conservación de archivos (días)"
              value={settings.file_retention_days}
              onChange={(v) => setSettings({ ...settings, file_retention_days: v })}
            />
            <NumberField
              label="Conservación de bitácoras (días)"
              value={settings.audit_retention_days}
              onChange={(v) => setSettings({ ...settings, audit_retention_days: v })}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipos de archivos permitidos</label>
              <input
                type="text"
                value={settings.allowed_file_types}
                onChange={(e) => setSettings({ ...settings, allowed_file_types: e.target.value })}
                className="input-field"
                placeholder="csv,xlsx,xls"
              />
            </div>
            <NumberField
              label="Tamaño máximo de archivos (MB)"
              value={settings.max_file_size_mb}
              onChange={(v) => setSettings({ ...settings, max_file_size_mb: v })}
            />
          </div>
        </div>

        {/* Permisos y mensaje */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-900">Permisos y mensaje institucional</h2>
          </div>
          <div className="space-y-3">
            <ToggleField
              label="Permitir exportaciones"
              value={settings.allow_export}
              onChange={(v) => setSettings({ ...settings, allow_export: v })}
            />
            <ToggleField
              label="Permitir descargas"
              value={settings.allow_download}
              onChange={(v) => setSettings({ ...settings, allow_download: v })}
            />
            <ToggleField
              label="Visibilidad de datos por unidad"
              value={settings.unit_visibility_enabled}
              onChange={(v) => setSettings({ ...settings, unit_visibility_enabled: v })}
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mensaje de acceso restringido</label>
              <textarea
                value={settings.restricted_access_message}
                onChange={(e) => setSettings({ ...settings, restricted_access_message: e.target.value })}
                className="input-field resize-y"
                rows={3}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="input-field"
      />
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-blue-700' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
