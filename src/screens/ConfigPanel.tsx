import { useState, useEffect } from 'react';
import {
  Settings, Users, Shield, Lock, ScrollText, RefreshCw,
  Sliders, Database, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { ViewKey } from '@/components/AppShell';
import { UsersView } from '@/screens/UsersView';
import { RolesView } from '@/screens/RolesView';
import { SecurityView } from '@/screens/SecurityView';
import { AuditView } from '@/screens/AuditView';
import { SystemResetView } from '@/screens/SystemResetView';
import { IndicatorsView } from '@/screens/IndicatorsView';
import { CatalogsView } from '@/screens/CatalogsView';
import { HelpTooltip } from '@/components/HelpUI';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export type ConfigTab = 'indicators' | 'catalogs' | 'users' | 'roles' | 'security' | 'audit' | 'system-reset';

interface TabDef {
  key: ConfigTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
  description: string;
}

const TABS: TabDef[] = [
  { key: 'indicators', label: 'Indicadores', icon: Sliders, permission: 'configure_indicators', description: 'Banderas rojas y umbrales' },
  { key: 'catalogs', label: 'Catálogos', icon: Database, permission: 'manage_catalogs', description: 'Instituciones, proveedores, métodos' },
  { key: 'users', label: 'Usuarios', icon: Users, permission: 'manage_users', description: 'Cuentas y accesos' },
  { key: 'roles', label: 'Roles y permisos', icon: Shield, permission: 'manage_roles', description: 'Matriz de permisos' },
  { key: 'security', label: 'Seguridad', icon: Lock, permission: 'configure_security', description: 'Políticas y sesiones' },
  { key: 'audit', label: 'Bitácora', icon: ScrollText, permission: 'view_audit_log', description: 'Auditoría del sistema' },
  { key: 'system-reset', label: 'Reseteo de datos', icon: RefreshCw, permission: 'reset_database', description: 'Reiniciar base de datos' },
];

interface ConfigPanelProps {
  initialTab?: ConfigTab;
  onNavigate: (view: ViewKey, params?: Record<string, string>) => void;
}

export function ConfigPanel({ initialTab, onNavigate }: ConfigPanelProps) {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<ConfigTab>(initialTab || 'indicators');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  const visibleTabs = TABS.filter((t) => hasPermission(t.permission));

  // If the active tab is not visible (permission issue), switch to first visible
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  if (visibleTabs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate('dashboard')} className="btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
        </div>
        <div className="card p-8 text-center">
          <Settings className="w-8 h-8 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-400">No tiene permisos para acceder a la configuración del sistema.</p>
        </div>
      </div>
    );
  }

  const currentTab = visibleTabs.find((t) => t.key === activeTab) || visibleTabs[0];

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: 'Configuración' }]} onNavigate={onNavigate} />
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings className="w-6 h-6 text-slate-700" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Administración del sistema: {currentTab.description}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="card p-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-blue-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'indicators' && <IndicatorsView />}
        {activeTab === 'catalogs' && <CatalogsView />}
        {activeTab === 'users' && <UsersView />}
        {activeTab === 'roles' && <RolesView />}
        {activeTab === 'security' && <SecurityView />}
        {activeTab === 'audit' && <AuditView />}
        {activeTab === 'system-reset' && <SystemResetView />}
      </div>
    </div>
  );
}
