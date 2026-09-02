import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { RoleSwitcher } from './components/common/RoleSwitcher';
import { ToastNotification } from './components/common/ToastNotification';
import { ClientView } from './components/client/ClientView';
import { KitchenView } from './components/kitchen/KitchenView';
import { DriverView } from './components/driver/DriverView';
import { AdminView } from './components/admin/AdminView';
import { StaffLoginView } from './components/auth/StaffLoginView';

const MainContent: React.FC = () => {
  const { currentRole, isAuthenticated, currentUser, authLoading } = useApp();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-sm border border-stone-200 text-stone-600">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Vérification de la session...</span>
        </div>
      </div>
    );
  }

  const renderView = () => {
    // 1. Client View is fully open to the public without authentication
    if (currentRole === 'client') {
      return <ClientView />;
    }

    // 2. Staff views require verified authentication
    if (!isAuthenticated || !currentUser) {
      return <StaffLoginView targetRole={currentRole} />;
    }

    // 3. User is authenticated, enforce strict role access
    if (currentRole === 'kitchen') {
      if (currentUser.role === 'kitchen' || currentUser.role === 'admin') {
        return <KitchenView />;
      }
      return <StaffLoginView targetRole="kitchen" message="Votre compte ne possède pas l'accès Cuisine." />;
    }

    if (currentRole === 'driver') {
      if (currentUser.role === 'driver' || currentUser.role === 'admin') {
        return <DriverView />;
      }
      return <StaffLoginView targetRole="driver" message="Votre compte ne possède pas l'accès Livreur." />;
    }

    if (currentRole === 'admin') {
      if (currentUser.role === 'admin') {
        return <AdminView />;
      }
      return <StaffLoginView targetRole="admin" message="Accès réservé exclusivement aux administrateurs." />;
    }

    return <ClientView />;
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Multi-View Role Switcher */}
      <RoleSwitcher />

      {/* Global Toast / Push Simulation */}
      <ToastNotification />

      {/* Active Role View */}
      <div className="flex-1">
        {renderView()}
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
