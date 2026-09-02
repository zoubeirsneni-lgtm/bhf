import React from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import {
  ShoppingBag,
  ChefHat,
  Bike,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Flame
} from 'lucide-react';

export const RoleSwitcher: React.FC = () => {
  const { currentRole, setCurrentRole, orders, resetDemoData, isLoading } = useApp();

  const activeOrdersCount = (orders || []).filter(o => o.status === 'received' || o.status === 'preparing').length;
  const readyOrdersCount = (orders || []).filter(o => o.status === 'ready' || o.status === 'delivering').length;

  const roles: Array<{ role: UserRole; label: string; mobileLabel: string; icon: React.ReactNode; badge?: number }> = [
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
      badge: activeOrdersCount > 0 ? activeOrdersCount : undefined
    },
    {
      role: 'driver',
      label: 'Espace Livreur',
      mobileLabel: 'Livreur',
      icon: <Bike className="w-4 h-4 flex-shrink-0" />,
      badge: readyOrdersCount > 0 ? readyOrdersCount : undefined
    },
    {
      role: 'admin',
      label: 'Administration',
      mobileLabel: 'Admin',
      icon: <ShieldCheck className="w-4 h-4 flex-shrink-0" />
    }
  ];

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
            <span className="hidden md:inline text-stone-400">
              « Vos Plats santé en un clic »
            </span>

            {/* Mobile Reset Demo Button */}
            <button
              id="reset-demo-data-btn-mobile"
              onClick={resetDemoData}
              title="Réinitialiser les données de démonstration"
              className="sm:hidden min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5 text-xs text-stone-400 hover:text-emerald-400 active:text-emerald-300 transition-colors px-2.5 py-1 rounded-xl bg-stone-950 border border-stone-800 cursor-pointer"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="text-[11px] font-medium">Reset Démo</span>
            </button>
          </div>

          {/* Role tabs: 2x2 grid on mobile (<sm), horizontal flex row on desktop (>=sm) */}
          <nav
            aria-label="Sélection de l'espace"
            className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-1 bg-stone-950 p-1 rounded-xl sm:rounded-lg border border-stone-800 w-full sm:w-auto"
          >
            {roles.map(({ role, label, mobileLabel, icon, badge }) => {
              const isActive = currentRole === role;
              return (
                <button
                  key={role}
                  id={`role-btn-${role}`}
                  onClick={() => setCurrentRole(role)}
                  className={`min-h-[44px] sm:min-h-0 flex items-center justify-center sm:justify-start gap-1.5 px-2.5 py-2 sm:py-1 rounded-lg font-medium transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                      : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                  }`}
                >
                  {icon}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden text-xs font-semibold">{mobileLabel}</span>
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

          {/* Desktop right tools */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              id="reset-demo-data-btn"
              onClick={resetDemoData}
              title="Réinitialiser les données de démonstration"
              className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-emerald-400 transition-colors px-2 py-1 rounded hover:bg-stone-800 border border-transparent hover:border-stone-700 cursor-pointer"
            >
              <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline">Reset Démo</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
