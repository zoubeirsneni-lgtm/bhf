import React from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import {
  ShoppingBag,
  ChefHat,
  Bike,
  ShieldCheck,
  RotateCcw,
  Flame,
  LogOut,
  Lock,
  User as UserIcon
} from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const {
    currentRole,
    setCurrentRole,
    orders,
    resetDemoData,
    isLoading,
    isAuthenticated,
    currentUser,
    logout
  } = useApp();

  const activeOrdersCount = (orders || []).filter(o => o.status === 'received' || o.status === 'preparing').length;
  const readyOrdersCount = (orders || []).filter(o => o.status === 'ready' || o.status === 'delivering').length;

  const isRoleAllowed = (role: UserRole): boolean => {
    if (role === 'client') return true;
    if (!isAuthenticated || !currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'kitchen' && role === 'kitchen') return true;
    if (currentUser.role === 'driver' && role === 'driver') return true;
    return false;
  };

  const roles: Array<{
    role: UserRole;
    label: string;
    mobileLabel: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    {
      role: 'client',
      label: 'Espace Client',
      mobileLabel: 'Client',
      icon: <ShoppingBag className="w-4 h-4 flex-shrink-0" />
    },
    {
      role: 'kitchen',
      label: 'Cuisine (KDS)',
      mobileLabel: 'Cuisine',
      icon: <ChefHat className="w-4 h-4 flex-shrink-0" />,
      badge: isAuthenticated && (currentUser?.role === 'admin' || currentUser?.role === 'kitchen') && activeOrdersCount > 0
        ? activeOrdersCount
        : undefined
    },
    {
      role: 'driver',
      label: 'Espace Livreur',
      mobileLabel: 'Livreur',
      icon: <Bike className="w-4 h-4 flex-shrink-0" />,
      badge: isAuthenticated && (currentUser?.role === 'admin' || currentUser?.role === 'driver') && readyOrdersCount > 0
        ? readyOrdersCount
        : undefined
    },
    {
      role: 'admin',
      label: 'Administration',
      mobileLabel: 'Admin',
      icon: <ShieldCheck className="w-4 h-4 flex-shrink-0" />
    }
  ];

  const handleRoleClick = (role: UserRole) => {
    setCurrentRole(role);
  };

  return (
    <header className="bg-stone-900 text-stone-100 text-xs border-b border-stone-800 relative sm:sticky sm:top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 py-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Top row on mobile / Left section on desktop */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 font-semibold tracking-wide uppercase text-[10px]">
              <Flame className="w-3.5 h-3.5 text-emerald-400 animate-pulse flex-shrink-0" />
              <span>BEBBA Core Multi-Vues</span>
            </div>

            {/* Authenticated user badge or public indicator */}
            {isAuthenticated && currentUser ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone-800/90 border border-stone-700 text-stone-300 text-[11px]">
                <UserIcon className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="font-semibold text-white truncate max-w-[100px] sm:max-w-[140px]">
                  {currentUser.name}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-600/40 text-emerald-300 text-[9px] font-bold uppercase">
                  {currentUser.role}
                </span>
              </div>
            ) : (
              <span className="hidden md:inline text-stone-400">
                « Vos Plats santé en un clic »
              </span>
            )}

            {/* Mobile Auth and Reset actions */}
            <div className="sm:hidden flex items-center gap-1.5">
              {isAuthenticated ? (
                <button
                  id="staff-logout-btn-mobile"
                  onClick={logout}
                  title="Se déconnecter"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 text-xs text-stone-300 hover:text-rose-400 active:text-rose-300 px-2.5 py-1 rounded-xl bg-stone-950 border border-stone-800 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-[11px] font-medium">Déconnexion</span>
                </button>
              ) : null}

              {/* Mobile Reset Demo Button (Admin only) */}
              {isAuthenticated && currentUser?.role === 'admin' && (
                <button
                  id="reset-demo-data-btn-mobile"
                  onClick={resetDemoData}
                  title="Réinitialiser les données de démonstration"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 text-xs text-stone-400 hover:text-emerald-400 active:text-emerald-300 px-2.5 py-1 rounded-xl bg-stone-950 border border-stone-800 cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span className="text-[11px] font-medium">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Role tabs: 2x2 grid on mobile (<sm), horizontal flex row on desktop (>=sm) */}
          <nav
            aria-label="Sélection de l'espace"
            className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-1 bg-stone-950 p-1 rounded-xl sm:rounded-lg border border-stone-800 w-full sm:w-auto"
          >
            {roles.map(({ role, label, mobileLabel, icon, badge }) => {
              const isActive = currentRole === role;
              const allowed = isRoleAllowed(role);
              const isStaffRole = role !== 'client';
              const needsLogin = isStaffRole && !isAuthenticated;
              const isForbiddenForUser = isStaffRole && isAuthenticated && !allowed;

              return (
                <button
                  key={role}
                  id={`role-btn-${role}`}
                  disabled={isForbiddenForUser}
                  onClick={() => handleRoleClick(role)}
                  title={
                    isForbiddenForUser
                      ? 'Accès non autorisé pour votre rôle'
                      : needsLogin
                      ? 'Connexion requise pour cet espace'
                      : label
                  }
                  className={`min-h-[44px] sm:min-h-0 flex items-center justify-center sm:justify-start gap-1.5 px-2.5 py-2 sm:py-1 rounded-lg font-medium transition-all select-none ${
                    isForbiddenForUser
                      ? 'opacity-40 cursor-not-allowed text-stone-500'
                      : 'cursor-pointer'
                  } ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                  }`}
                >
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden text-xs font-semibold">{mobileLabel}</span>

                  {/* Lock icon for unauthenticated staff views */}
                  {needsLogin && (
                    <Lock className="w-3 h-3 text-stone-500 flex-shrink-0" />
                  )}

                  {/* Orders counter badge */}
                  {badge !== undefined && (
                    <span
                      className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white text-emerald-800' : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Desktop right tools: Logout and Admin Reset */}
          <div className="hidden sm:flex items-center gap-2">
            {isAuthenticated ? (
              <button
                id="staff-logout-btn"
                onClick={logout}
                title="Se déconnecter de l'espace personnel"
                className="flex items-center gap-1.5 text-xs text-stone-300 hover:text-rose-400 transition-colors px-2.5 py-1.5 rounded-lg bg-stone-950 border border-stone-800 hover:border-rose-900/60 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Déconnexion</span>
              </button>
            ) : null}

            {/* Desktop Reset Demo Button (Admin only) */}
            {isAuthenticated && currentUser?.role === 'admin' && (
              <button
                id="reset-demo-data-btn"
                onClick={resetDemoData}
                title="Réinitialiser les données de démonstration"
                className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-emerald-400 transition-colors px-2 py-1 rounded hover:bg-stone-800 border border-transparent hover:border-stone-700 cursor-pointer"
              >
                <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Reset Démo</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
