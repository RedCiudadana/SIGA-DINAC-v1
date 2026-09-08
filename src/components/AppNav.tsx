import {
  LayoutDashboard, Upload, History,
  AlertTriangle, FileText, Settings, BookOpen, GraduationCap, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { ViewKey } from '@/components/AppShell';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
  roles?: string[];
}

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'General',
    items: [
      { key: 'dashboard', label: 'Tablero principal', icon: LayoutDashboard, permission: 'view_dashboard' },
    ],
  },
  {
    title: 'Datos y alertas',
    items: [
      { key: 'upload', label: 'Carga de datos', icon: Upload, permission: 'upload_data' },
      { key: 'uploads', label: 'Historial de cargas', icon: History, permission: 'view_uploads' },
      { key: 'alerts', label: 'Alertas de riesgo', icon: AlertTriangle, permission: 'view_alerts' },
      { key: 'reports', label: 'Reportes', icon: FileText, permission: 'view_reports' },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { key: 'config', label: 'Panel de configuración', icon: Settings, permission: 'configure_indicators' },
    ],
  },
  {
    title: 'Ayuda',
    items: [
      { key: 'docs', label: 'Documentación', icon: BookOpen, permission: 'view_documentation' },
      { key: 'tutorials', label: 'Tutoriales', icon: GraduationCap, permission: 'view_documentation' },
    ],
  },
];

// Menú simplificado para Fiscalización: solo lo que necesita
const NAV_FISCALIZATION: { title: string; items: NavItem[] }[] = [
  {
    title: 'General',
    items: [
      { key: 'dashboard', label: 'Panel principal', icon: LayoutDashboard },
      { key: 'alerts', label: 'Alertas de riesgo', icon: AlertTriangle },
    ],
  },
  {
    title: 'Reportes',
    items: [
      { key: 'reports', label: 'Reportes', icon: FileText },
    ],
  },
  {
    title: 'Ayuda',
    items: [
      { key: 'docs', label: 'Documentación', icon: BookOpen },
      { key: 'tutorials', label: 'Tutoriales', icon: GraduationCap },
    ],
  },
];

interface AppNavProps {
  currentView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  sidebarOpen: boolean;
  onClose: () => void;
}

export function AppNav({ currentView, onNavigate, sidebarOpen, onClose }: AppNavProps) {
  const { hasPermission, profile } = useAuth();
  const isFiscalization = profile?.role?.code === 'fiscalization';
  const sections = isFiscalization ? NAV_FISCALIZATION : NAV_SECTIONS;

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:sticky top-14 left-0 z-20
          w-64 h-[calc(100vh-3.5rem)]
          bg-white border-r border-slate-200
          overflow-y-auto scrollbar-thin
          transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="lg:hidden flex justify-end p-2">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <nav className="px-3 py-4 space-y-6">
          {sections.map((section) => {
            const visibleItems = section.items.filter(
              (item) => !item.permission || hasPermission(item.permission)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={section.title}>
                <h3 className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {section.title}
                </h3>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.key || (item.key === 'alerts' && currentView === 'alert-detail');
                    return (
                      <button
                        key={item.key}
                        onClick={() => onNavigate(item.key)}
                        className={`nav-item w-full text-left ${isActive ? 'nav-item-active' : ''}`}
                      >
                        <Icon className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
