import { useState, useEffect, useCallback } from 'react';
import {
  Shield, LogOut, ChevronDown, Bell, Clock, Menu, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROLE_LABELS } from '@/types';
import { AppNav } from '@/components/AppNav';
import { SessionTimeout } from '@/components/SessionTimeout';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export type ViewKey =
  | 'dashboard'
  | 'upload' | 'uploads' | 'validation'
  | 'alerts' | 'alert-detail' | 'process-detail'
  | 'reports' | 'config' | 'public-boards'
  | 'docs' | 'tutorials' | 'profile';

interface AppShellProps {
  currentView: ViewKey;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
  children: React.ReactNode;
}

export function AppShell({ currentView, onNavigate, children }: AppShellProps) {
  const { profile, signOut, securitySettings } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const timeoutMinutes = securitySettings?.inactivity_timeout_minutes || 30;
  const warningMinutes = 1;

  const handleInactivityTimeout = useCallback(() => {
    signOut();
  }, [signOut]);

  const handleInactivityWarning = useCallback(() => {
    setShowInactivityWarning(true);
  }, []);

  const handleActivity = useCallback(() => {
    setShowInactivityWarning(false);
  }, []);

  const handleSignOut = () => {
    setShowSignOutConfirm(true);
  };

  const roleName = profile?.role ? ROLE_LABELS[profile.role.code] || profile.role.name : 'Sin rol';

  return (
    <div className="min-h-screen bg-slate-50">
      <SessionTimeout
        timeoutMinutes={timeoutMinutes}
        warningMinutes={warningMinutes}
        onTimeout={handleInactivityTimeout}
        onWarning={handleInactivityWarning}
        onActivity={handleActivity}
      />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-blue-900 text-white border-b border-blue-950 shadow-sm">
        <div className="flex items-center justify-between h-14 px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-blue-800"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2.5">
              <img
                src="/dinac-logo.svg"
                alt="DINAC"
                className="h-8 w-auto object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="hidden sm:block">
                <span className="text-sm font-semibold">SIGA-DINAC</span>
                <span className="text-xs text-blue-300 ml-2">Sistema de Identificación y Gestión de Alertas</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs bg-blue-950/50 px-2.5 py-1 rounded-full border border-blue-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Uso interno
            </span>
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-blue-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-xs font-semibold">
                  {profile?.full_name?.charAt(0) || 'U'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-medium leading-tight">{profile?.full_name}</p>
                  <p className="text-[10px] text-blue-300 leading-tight">{roleName}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-blue-300" />
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 card py-2 z-50 shadow-lg">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-900">{profile?.full_name}</p>
                      <p className="text-xs text-slate-500">{profile?.email}</p>
                      <p className="text-xs text-slate-500 mt-1">{roleName}</p>
                      {profile?.organizational_unit && (
                        <p className="text-xs text-slate-500">{profile.organizational_unit}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate('profile');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Mi perfil
                    </button>
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onNavigate('docs');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Documentación metodológica
                    </button>
                    <div className="border-t border-slate-100 mt-1 pt-1">
                      <button
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <AppNav
          currentView={currentView}
          onNavigate={(v) => {
            onNavigate(v);
            setSidebarOpen(false);
          }}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {showInactivityWarning && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-600" />
              <p className="text-sm text-amber-800">
                Su sesión se cerrará pronto por inactividad. Realice una acción para mantenerla activa.
              </p>
            </div>
          )}
          {children}
        </main>
      </div>

      <ConfirmDialog
        open={showSignOutConfirm}
        title="Cerrar sesión"
        message="¿Seguro que desea cerrar sesión? Si tiene cambios sin guardar, se perderán."
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        variant="warning"
        onConfirm={() => { setShowSignOutConfirm(false); signOut(); }}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </div>
  );
}
