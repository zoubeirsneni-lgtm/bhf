import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { RoleSwitcher } from './components/common/RoleSwitcher';
import { ToastNotification } from './components/common/ToastNotification';
import { ClientView } from './components/client/ClientView';
import { KitchenView } from './components/kitchen/KitchenView';
import { DriverView } from './components/driver/DriverView';
import { AdminView } from './components/admin/AdminView';

const MainContent: React.FC = () => {
  const { currentRole } = useApp();

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Multi-View Role Switcher */}
      <RoleSwitcher />

      {/* Global Toast / Push Simulation */}
      <ToastNotification />

      {/* Active Role View */}
      <div className="flex-1">
        {currentRole === 'client' && <ClientView />}
        {currentRole === 'kitchen' && <KitchenView />}
        {currentRole === 'driver' && <DriverView />}
        {currentRole === 'admin' && <AdminView />}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
