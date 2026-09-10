import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Phone,
  Lock,
  User,
  MapPin,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  LogOut,
  Salad
} from 'lucide-react';

export const ClientAuthModal: React.FC = () => {
  const {
    isClientAuthModalOpen,
    closeClientAuth,
    clientAuthModalMode,
    setClientAuthModalMode,
    loginClient,
    registerClient,
    authLoading,
    isAuthenticated,
    currentUser,
    logout
  } = useApp();

  // Mode: 'login' | 'register'
  const mode = clientAuthModalMode;
  const setMode = setClientAuthModalMode;

  // Login form state
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state (Strictly Name, Phone, Password, Confirm Password, Address - NO username, NO role)
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerAddress, setRegisterAddress] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] = useState(false);

  // Feedback states
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form errors on mode switch or open
  useEffect(() => {
    setLocalError(null);
  }, [mode, isClientAuthModalOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isClientAuthModalOpen) {
        closeClientAuth();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClientAuthModalOpen, closeClientAuth]);

  if (!isClientAuthModalOpen) return null;

  // Handle Client Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedPhone = loginPhone.trim();
    if (!trimmedPhone) {
      setLocalError('Veuillez saisir votre numéro de téléphone.');
      return;
    }
    if (!loginPassword) {
      setLocalError('Veuillez saisir votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Strictly phone + password, NO username
      await loginClient(trimmedPhone, loginPassword);
      // Clears inputs
      setLoginPhone('');
      setLoginPassword('');
    } catch (err: any) {
      setLocalError(err.message || 'Numéro de téléphone ou mot de passe incorrect.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Client Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedName = registerName.trim();
    const trimmedPhone = registerPhone.trim();
    const trimmedAddress = registerAddress.trim();

    // 1. Validations avant envoi
    if (!trimmedName) {
      setLocalError('Le nom et prénom sont obligatoires.');
      return;
    }
    if (!trimmedPhone) {
      setLocalError('Le numéro de téléphone est obligatoire.');
      return;
    }
    if (!registerPassword) {
      setLocalError('Le mot de passe est obligatoire.');
      return;
    }
    if (!registerConfirmPassword) {
      setLocalError('La confirmation du mot de passe est obligatoire.');
      return;
    }
    // 2. Vérification correspondance des mots de passe
    if (registerPassword !== registerConfirmPassword) {
      setLocalError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    // 3. Longueur minimale mot de passe
    if (registerPassword.length < 4) {
      setLocalError('Le mot de passe doit comporter au moins 4 caractères.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Strictly sends name, phone, password, address.
      // NO username, NO role, NO clientId, NO passwordHash
      await registerClient({
        name: trimmedName,
        phone: trimmedPhone,
        password: registerPassword,
        address: trimmedAddress || undefined
      });
      // Clears inputs
      setRegisterName('');
      setRegisterPhone('');
      setRegisterPassword('');
      setRegisterConfirmPassword('');
      setRegisterAddress('');
    } catch (err: any) {
      const errMsg = err.message || 'Erreur lors de la création du compte.';
      if (errMsg.toLowerCase().includes('existe déjà') || errMsg.toLowerCase().includes('already exists')) {
        setLocalError('Un compte existe déjà avec ce numéro de téléphone.');
      } else {
        setLocalError(errMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="client-auth-modal"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
    >
      {/* Click outside backdrop */}
      <div
        className="fixed inset-0 cursor-pointer"
        onClick={closeClientAuth}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden z-10 transition-all">
        {/* Top Close Button */}
        <button
          id="client-auth-modal-close-btn"
          type="button"
          onClick={closeClientAuth}
          className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors z-20 cursor-pointer"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="p-6 pb-4 bg-stone-900 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full bg-emerald-600/20 blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-emerald-950/40 mb-3">
              <Salad className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold font-display tracking-tight text-white">
              Espace Client BEBBA
            </h2>
            <p className="text-xs text-stone-300 mt-1 max-w-xs mx-auto">
              Commandez vos bowls et plats santé en toute simplicité
            </p>
          </div>
        </div>

        {/* If user is already logged in as client */}
        {isAuthenticated && currentUser?.role === 'client' ? (
          <div className="p-6 sm:p-8 space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                Vous êtes connecté
              </h3>
              <p className="text-sm font-semibold text-emerald-800 mt-1">
                {currentUser.name}
              </p>
              {currentUser.phone && (
                <p className="text-xs text-stone-500 mt-0.5">
                  Téléphone : {currentUser.phone}
                </p>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <button
                id="client-modal-logout-btn"
                type="button"
                onClick={async () => {
                  await logout();
                  closeClientAuth();
                }}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-sm border border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Se déconnecter</span>
              </button>

              <button
                type="button"
                onClick={closeClientAuth}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 hover:bg-stone-200 font-bold text-sm transition-colors cursor-pointer"
              >
                Continuer mes achats
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8">
            {/* Tab switchers: Connexion / Inscription */}
            <div className="flex rounded-2xl bg-stone-100 p-1 mb-6 border border-stone-200/80">
              <button
                type="button"
                id="client-auth-tab-login"
                onClick={() => {
                  setMode('login');
                  setLocalError(null);
                }}
                className={`flex-1 min-h-[40px] py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Connexion
              </button>
              <button
                type="button"
                id="client-auth-tab-register"
                onClick={() => {
                  setMode('register');
                  setLocalError(null);
                }}
                className={`flex-1 min-h-[40px] py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Créer un compte
              </button>
            </div>

            {/* Error message display */}
            {localError && (
              <div
                id="client-auth-error-banner"
                className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{localError}</span>
              </div>
            )}

            {/* 1. LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="client-login-phone-input"
                    className="block text-xs font-semibold text-stone-700 mb-1.5"
                  >
                    Numéro de téléphone <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="client-login-phone-input"
                      type="tel"
                      autoComplete="tel"
                      required
                      value={loginPhone}
                      onChange={e => {
                        setLoginPhone(e.target.value);
                        if (localError) setLocalError(null);
                      }}
                      placeholder="ex: +216 20 123 456 ou 20123456"
                      className="w-full min-h-[44px] px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                    />
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="client-login-password-input"
                    className="block text-xs font-semibold text-stone-700 mb-1.5"
                  >
                    Mot de passe <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="client-login-password-input"
                      type={showLoginPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      value={loginPassword}
                      onChange={e => {
                        setLoginPassword(e.target.value);
                        if (localError) setLocalError(null);
                      }}
                      placeholder="••••••••"
                      className="w-full min-h-[44px] px-3.5 py-2.5 pl-10 pr-10 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                    />
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 cursor-pointer p-0.5"
                      aria-label="Afficher le mot de passe"
                    >
                      {showLoginPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  id="client-login-submit-btn"
                  disabled={isSubmitting || authLoading}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
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

                <div className="pt-2 text-center">
                  <p className="text-xs text-stone-500">
                    Pas encore de compte client ?{' '}
                    <button
                      type="button"
                      id="client-switch-to-register-btn"
                      onClick={() => {
                        setMode('register');
                        setLocalError(null);
                      }}
                      className="text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Créer un compte
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* 2. REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Nom / Prénom */}
                <div>
                  <label
                    htmlFor="client-register-name-input"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Nom et prénom <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="client-register-name-input"
                      type="text"
                      autoComplete="name"
                      required
                      value={registerName}
                      onChange={e => {
                        setRegisterName(e.target.value);
                        if (localError) setLocalError(null);
                      }}
                      placeholder="ex: Mohamed Trabelsi"
                      className="w-full min-h-[44px] px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                    />
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* Numéro de téléphone */}
                <div>
                  <label
                    htmlFor="client-register-phone-input"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Numéro de téléphone <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="client-register-phone-input"
                      type="tel"
                      autoComplete="tel"
                      required
                      value={registerPhone}
                      onChange={e => {
                        setRegisterPhone(e.target.value);
                        if (localError) setLocalError(null);
                      }}
                      placeholder="ex: +216 20 123 456 ou 20123456"
                      className="w-full min-h-[44px] px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                    />
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                {/* Mot de passe */}
                <div>
                  <label
                    htmlFor="client-register-password-input"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Mot de passe <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="client-register-password-input"
                      type={showRegisterPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={registerPassword}
                      onChange={e => {
                        setRegisterPassword(e.target.value);
                        if (localError) setLocalError(null);
                      }}
                      placeholder="Au moins 4 caractères"
                      className="w-full min-h-[44px] px-3.5 py-2.5 pl-10 pr-10 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                    />
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 cursor-pointer p-0.5"
                      aria-label="Afficher le mot de passe"
                    >
                      {showRegisterPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirmation mot de passe */}
                <div>
                  <label
                    htmlFor="client-register-confirm-password-input"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Confirmer le mot de passe <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="client-register-confirm-password-input"
                      type={showRegisterConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={registerConfirmPassword}
                      onChange={e => {
                        setRegisterConfirmPassword(e.target.value);
                        if (localError) setLocalError(null);
                      }}
                      placeholder="Confirmez votre mot de passe"
                      className="w-full min-h-[44px] px-3.5 py-2.5 pl-10 pr-10 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                    />
                    <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowRegisterConfirmPassword(!showRegisterConfirmPassword)}
                      className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 cursor-pointer p-0.5"
                      aria-label="Afficher la confirmation du mot de passe"
                    >
                      {showRegisterConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Adresse (optionnelle) */}
                <div>
                  <label
                    htmlFor="client-register-address-input"
                    className="block text-xs font-semibold text-stone-700 mb-1"
                  >
                    Adresse de livraison <span className="text-stone-400 font-normal">(optionnel)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="client-register-address-input"
                      type="text"
                      autoComplete="street-address"
                      value={registerAddress}
                      onChange={e => setRegisterAddress(e.target.value)}
                      placeholder="ex: Résidence Ennasr, Tunis"
                      className="w-full min-h-[44px] px-3.5 py-2.5 pl-10 rounded-xl border border-stone-300 text-sm text-stone-900 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all"
                    />
                    <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  </div>
                </div>

                <button
                  type="submit"
                  id="client-register-submit-btn"
                  disabled={isSubmitting || authLoading}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
                >
                  {isSubmitting || authLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Création de votre compte...</span>
                    </>
                  ) : (
                    <span>Créer mon compte client</span>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <p className="text-xs text-stone-500">
                    Vous avez déjà un compte ?{' '}
                    <button
                      type="button"
                      id="client-switch-to-login-btn"
                      onClick={() => {
                        setMode('login');
                        setLocalError(null);
                      }}
                      className="text-emerald-700 font-bold hover:underline cursor-pointer"
                    >
                      Se connecter
                    </button>
                  </p>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Footer note */}
        <div className="px-6 py-3 bg-stone-50 border-t border-stone-100 text-center">
          <p className="text-[11px] text-stone-400">
            Paiement sécurisé en espèces à la livraison. Vos données restent strictement confidentielles.
          </p>
        </div>
      </div>
    </div>
  );
};
