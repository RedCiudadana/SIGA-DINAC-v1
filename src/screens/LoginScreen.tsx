import { useState, useEffect } from 'react';
import {
  Eye, EyeOff, Lock, Mail, AlertCircle, Clock,
  CheckCircle2, ShieldCheck, ArrowRight, KeyRound,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

const HERO_IMAGE = 'https://images.pexels.com/photos/20948982/pexels-photo-20948982.jpeg?auto=compress&cs=tinysrgb&w=1200';
const LOGO_URL = 'https://dinac.gob.sv/wp-content/uploads/2026/01/LOGO-DINAC2.png';

export function LoginScreen() {
  const { signIn, securitySettings } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  const maxAttempts = securitySettings?.max_failed_attempts || 5;
  const lockoutMinutes = securitySettings?.lockout_duration_minutes || 15;

  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        setLockoutTime((prev) => {
          if (prev <= 1) {
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) return;

    setError(null);
    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);

      if (newAttempts >= maxAttempts) {
        setLockoutTime(lockoutMinutes * 60);
        setError(`Cuenta bloqueada temporalmente por ${lockoutMinutes} minutos debido a múltiples intentos fallidos.`);
      } else {
        setError(`${signInError}. Intento ${newAttempts} de ${maxAttempts}.`);
      }
    }

    setLoading(false);
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
      redirectTo: window.location.origin,
    });

    if (recoveryError) {
      setError('No se pudo procesar la solicitud de recuperación. Intente nuevamente.');
    } else {
      setRecoverySent(true);
    }
    setLoading(false);
  };

  const fillDemoCredentials = () => {
    setEmail('admin@dinac-demo.gob.sv');
    setPassword('SIA-DINAC-2024!');
    setError(null);
  };

  const formatLockdownTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-100">
      {/* ===== Left visual panel ===== */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        {/* Hero image */}
        <img
          src={HERO_IMAGE}
          alt="Palacio Nacional de San Salvador, El Salvador"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-950/95 via-blue-900/85 to-blue-950/90" />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow accents */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/15 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-400/8 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg overflow-hidden">
              <img
                src={LOGO_URL}
                alt="Red Ciudadana"
                className="max-w-full max-h-full object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">SIGA-DINAC</h1>
              <p className="text-[11px] text-blue-300">Sistema de Identificación y Gestión de Alertas</p>
            </div>
          </div>

          {/* Hero */}
          <div className="space-y-5 my-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[11px] font-medium text-blue-100 uppercase tracking-wider">Plataforma de transparencia</span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
              Detección inteligente de<br />riesgos en contratación pública
            </h2>
            <p className="text-blue-200 text-sm leading-relaxed max-w-md">
              Análisis automático mediante banderas rojas para la Dirección Nacional de Compras Públicas.
            </p>
          </div>

          {/* Bottom badge */}
          <div className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm px-4 py-3 max-w-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <p className="text-xs text-blue-200 leading-relaxed">
              Sistema privado de uso interno. Todas las acciones quedan registradas.
            </p>
          </div>
        </div>
      </div>

      {/* ===== Right form panel ===== */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 relative bg-gradient-to-b from-slate-50 to-slate-100">
        {/* Mobile header */}
        <div className="lg:hidden flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-900 mb-3 shadow-lg overflow-hidden p-2">
            <img
              src={LOGO_URL}
              alt="DINAC"
              className="max-w-full max-h-full object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <h1 className="text-lg font-bold text-slate-900 text-center">SIGA-DINAC</h1>
          <p className="text-xs text-slate-500 text-center">Sistema de Identificación y Gestión de Alertas</p>
        </div>

        <div className="w-full max-w-md">
          <div className="card p-6 sm:p-8 shadow-xl">
            {/* Security badge */}
            <div className="flex items-center gap-2 mb-5 text-blue-700">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-medium uppercase tracking-wider">Acceso seguro</span>
            </div>

            {!showRecovery ? (
              <>
                <div className="mb-5">
                  <h2 className="text-xl font-bold text-slate-900">Iniciar sesión</h2>
                  <p className="text-sm text-slate-500 mt-1">Sistema de uso interno — DINAC</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Correo institucional
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={lockoutTime > 0}
                        className="input-field pl-10"
                        placeholder="nombre@institucion.gob.sv"
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={lockoutTime > 0}
                        className="input-field pl-10 pr-10"
                        placeholder="••••••••••••"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                      <div className="flex gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-800">{error}</p>
                      </div>
                    </div>
                  )}

                  {lockoutTime > 0 && (
                    <div className="rounded-lg border border-red-300 bg-red-100 px-4 py-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-red-700" />
                      <p className="text-sm text-red-800 font-medium">
                        Bloqueo temporal: {formatLockdownTime(lockoutTime)}
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || lockoutTime > 0}
                    className="btn-primary w-full text-base py-3 group"
                  >
                    {loading ? 'Verificando...' : 'Ingresar'}
                    {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                  </button>
                </form>

                <div className="mt-5 text-center">
                  <button
                    onClick={() => {
                      setShowRecovery(true);
                      setError(null);
                    }}
                    className="text-sm text-blue-700 hover:text-blue-800 hover:underline transition-colors"
                  >
                    ¿Olvidó su contraseña?
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-900">Recuperar contraseña</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Se enviará un enlace seguro a su correo institucional.
                  </p>
                </div>

                {recoverySent ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-2" />
                    <p className="text-sm text-green-800">
                      Si el correo está registrado, recibirá un enlace para restablecer su contraseña.
                    </p>
                    <button
                      onClick={() => {
                        setShowRecovery(false);
                        setRecoverySent(false);
                        setRecoveryEmail('');
                      }}
                      className="mt-4 btn-secondary"
                    >
                      Volver al inicio de sesión
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRecovery} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Correo institucional
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          required
                          className="input-field pl-10"
                          placeholder="nombre@institucion.gob.sv"
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                        <p className="text-xs text-red-800">{error}</p>
                      </div>
                    )}

                    <button type="submit" disabled={loading} className="btn-primary w-full">
                      {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowRecovery(false);
                        setError(null);
                      }}
                      className="w-full text-sm text-slate-500 hover:text-slate-700"
                    >
                      Volver al inicio de sesión
                    </button>
                  </form>
                )}
              </>
            )}
          </div>

          {/* Demo credentials — friendly one-click fill */}
          <div className="mt-4 card p-4 bg-blue-50/80 border-blue-200">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <KeyRound className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-blue-900">Acceso de demostración</p>
                  <p className="text-[11px] text-blue-700 mt-0.5 truncate">admin@dinac-demo.gob.sv · SIA-DINAC-2024!</p>
                </div>
              </div>
              <button
                onClick={fillDemoCredentials}
                className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-2 whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0"
              >
                <ArrowRight className="w-3 h-3" />
                Autocompletar
              </button>
            </div>
          </div>

          <div className="mt-4 text-center">
            <p className="text-xs text-slate-400">
              Entorno de demostración — datos ficticios
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
