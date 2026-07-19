import { useEffect, useState } from 'react';
import { StoreProvider, useStore, refreshMap, refreshStatuses } from './store';
import { AuthProvider, useAuth } from './auth';
import TopBar from './components/TopBar';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import FloorSelector from './components/FloorSelector';
import LoginPage from './components/LoginPage';
import ReportsPage from './components/ReportsPage';

function Workspace() {
  const { user } = useAuth();
  const { dispatch } = useStore();
  const isAdmin = user?.role === 'Admin';
  const [view, setView] = useState<'map' | 'reports'>('map');

  useEffect(() => {
    refreshMap(dispatch);
    refreshStatuses(dispatch);
    const interval = setInterval(() => refreshStatuses(dispatch), 60_000);
    return () => clearInterval(interval);
  }, [dispatch]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-100">
      <TopBar view={view} onViewChange={setView} />
      {view === 'map' ? (
        <div className="flex flex-1 overflow-hidden">
          {isAdmin && <Toolbar />}
          <div className="flex flex-col flex-1 overflow-hidden">
            <Canvas />
            <FloorSelector />
          </div>
          {isAdmin && <PropertiesPanel />}
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          <ReportsPage />
        </div>
      )}
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-sidebar flex items-center justify-center">
        <div className="text-white/40 text-sm">Загрузка…</div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
