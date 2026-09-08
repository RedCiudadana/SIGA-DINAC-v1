import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { LoginScreen } from '@/screens/LoginScreen';
import { AppShell, type ViewKey } from '@/components/AppShell';
import { DashboardView } from '@/screens/DashboardView';
import { AlertsView } from '@/screens/AlertsView';
import { AlertDetailView } from '@/screens/AlertDetailView';
import { ProcessDetailView } from '@/screens/ProcessDetailView';
import { UploadView } from '@/screens/UploadView';
import { UploadsView } from '@/screens/UploadsView';
import { ReportsView } from '@/screens/ReportsView';
import { DocsView } from '@/screens/DocsView';
import { TutorialsView } from '@/screens/TutorialsView';
import { ProfileView } from '@/screens/ProfileView';
import { ConfigPanel, type ConfigTab } from '@/screens/ConfigPanel';

function AppContent() {
  const { session, profile, loading, hasPermission } = useAuth();
  const [view, setView] = useState<ViewKey>('dashboard');
  const [params, setParams] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile && !hasPermission('view_dashboard')) {
      if (hasPermission('view_alerts')) setView('alerts');
    }
  }, [profile]);

  const handleNavigate = (newView: ViewKey, newParams?: Record<string, string>) => {
    setView(newView);
    setParams(newParams || {});
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!session || !profile) {
    return <LoginScreen />;
  }

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <DashboardView onNavigate={handleNavigate} />;
      case 'alerts':
        return <AlertsView onNavigate={handleNavigate} />;
      case 'alert-detail':
        return <AlertDetailView alertId={params.id || ''} onNavigate={handleNavigate} />;
      case 'process-detail':
        return <ProcessDetailView processId={params.id || ''} onNavigate={handleNavigate} />;
      case 'upload':
        return <UploadView onNavigate={handleNavigate} />;
      case 'uploads':
        return <UploadsView onNavigate={handleNavigate} />;
      case 'config':
        return <ConfigPanel initialTab={params.tab as ConfigTab | undefined} onNavigate={handleNavigate} />;
      case 'reports':
        return <ReportsView />;
      case 'docs':
        return <DocsView />;
      case 'tutorials':
        return <TutorialsView />;
      case 'profile':
        return <ProfileView />;
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppShell currentView={view} onNavigate={handleNavigate}>
      {renderView()}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
