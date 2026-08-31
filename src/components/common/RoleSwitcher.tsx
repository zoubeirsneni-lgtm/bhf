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

  const roles: Array<{ role: UserRole; label: string; icon: React.ReactNode; badge?: number }> = [
    {
      role: 'client',
      label: 'Espace Client',
      icon: <ShoppingBag className="w-4 h-4" />
    },
    {
      role: 'kitchen',
      label: 'Cuisine (KDS)',
      icon: <ChefHat className="w-4 h-4" />,
      badge: activeOrdersCount > 0 ? activeOrdersCount : undefined
    },
    {
      role: 'driver',
      label: 'Espace Livreur',
      icon: <Bike className="w-4 h-4" />,
      badge: readyOrdersCount > 0 ? readyOrdersCount : undefined
    },
    {
      role: 'admin',
      label: 'Administration',
      icon: <ShieldCheck className="w-4 h-4" />
    }
  ];

  return (
    <header className="bg-stone-900 text-stone-100 text-xs border-b border-stone-800 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 font-semibold tracking-wide uppercase text-[10px]">
            <Flame className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>BEBBA Core Multi-Vues</span>
          </div>
          <span className="hidden md:inline text-stone-400">
            « Vos Plats santé en un clic »
          </span>
        </div>

        {/* Role tabs */}
        <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-lg border border-stone-800">
          {roles.map(({ role, label, icon, badge }) => {
            const isActive = currentRole === role;
            return (
              <button
                key={role}
                id={`role-btn-${role}`}
                onClick={() => setCurrentRole(role)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/60'
                }`}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
                {badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-white text-emerald-800' : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right tools */}
        <div className="flex items-center gap-2">
          <button
            id="reset-demo-data-btn"
            onClick={resetDemoData}
            title="Réinitialiser les données de démonstration"
            className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-emerald-400 transition-colors px-2 py-1 rounded hover:bg-stone-800 border border-transparent hover:border-stone-700"
          >
            <RotateCcw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">Reset Démo</span>
          </button>
        </div>
      </div>
    </header>
  );
};
