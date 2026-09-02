import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import {
  ShieldCheck,
  ChefHat,
  Bike,
  Lock,
  User,
  KeyRound,
  ArrowLeft,
  AlertCircle,
  Loader2,
  Flame
} from 'lucide-react';

interface StaffLoginViewProps {
  targetRole?: UserRole;
  message?: string;
}

export const StaffLoginView: React.FC<StaffLoginViewProps> = ({ targetRole, message }) => {
  const { login, setCurrentRole, authError, clearAuthError, authLoading } = useApp();

  const [username, setUsername] = useState(() => {
    if (targetRole === 'kitchen') return 'cuisine';
    if (targetRole === 'driver') return 'livreur1';
    if (targetRole === 'admin') return 'admin';
    return '';
  });
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleRolePreset = (role: 'admin' | 'kitchen' | 'driver', defaultUsername: string) => {
    setUsername(defaultUsername);
    setPassword('');
    setLocalError(null);
    clearAuthError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setLocalError('Veuillez saisir votre identifiant et votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedUser, password);
    } catch (err: any) {
      setLocalError(err.message || 'Identifiants invalides.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || authError || message;

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col items-center justify-center px-4 py-8 bg-stone-100">
      <div className="w-full max-w-md">
        {/* Top Back Link */}
        <div className="mb-4">
          <button
            type="button"
            id="staff-back-to-client-btn"
            onClick={() => {
              clearAuthError();
              setCurrentRole('client');
            }}
            className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 hover:text-emerald-700 min-h-[44px] px-3 py-2 rounded-xl hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour au Menu public (Espace Client)</span>
          </button>
        </div>

        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 mb-3 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wide mb-1">
              <Flame className="w-3.5 h-3.5 text-emerald-600" />
              <span>BEBBA HEALTHY FOOD</span>
            </div>
            <h1 className="text-xl font-extrabold text-stone-900 tracking-tight">
              Connexion Espace Personnel
            </h1>
            <p className="text-xs text-stone-500 mt-1 max-w-xs mx-auto">
              Identifiez-vous pour accéder à votre espace de gestion (Administration, Cuisine ou Livraison).
            </p>
          </div>

          {/* Role selector helpers */}
          <div className="mb-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
              Choisir votre espace
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                id="role-preset-admin"
                onClick={() => handleRolePreset('admin', 'admin')}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  username.toLowerCase().includes('admin')
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="text-[11px] leading-none">Admin</span>
              </button>

              <button
                type="button"
                id="role-preset-kitchen"
                onClick={() => handleRolePreset('kitchen', 'cuisine')}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  username.toLowerCase().includes('cuisine')
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <ChefHat className="w-4 h-4 text-emerald-700" />
                <span className="text-[11px] leading-none">Cuisine</span>
              </button>

              <button
                type="button"
                id="role-preset-driver"
                onClick={() => handleRolePreset('driver', 'livreur1')}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  username.toLowerCase().includes('livreur')
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm'
                    : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                }`}
              >
                <Bike className="w-4 h-4 text-emerald-700" />
                <span className="text-[11px] leading-none">Livreur</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {displayError && (
            <div
              id="staff-login-error"
              className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{displayError}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="staff-username-input"
                className="block text-xs font-semibold text-stone-700 mb-1.5"
              >
                Identifiant
              </label>
              <div className="relative">
                <input
                  id="staff-username-input"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  placeholder="ex: admin, cuisine, livreur1"
                  className="w-full min-h-[44px] px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                />
                <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label
                htmlFor="staff-password-input"
                className="block text-xs font-semibold text-stone-700 mb-1.5"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  id="staff-password-input"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    if (localError) setLocalError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                />
                <KeyRound className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              id="staff-login-btn"
              disabled={isSubmitting || authLoading}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting || authLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </form>

          {/* Security Note */}
          <div className="mt-6 pt-4 border-t border-stone-100 text-center">
            <p className="text-[11px] text-stone-400 leading-normal">
              Session sécurisée par jeton chiffré (JWT). Aucune donnée sensible n&apos;est stockée en clair.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
