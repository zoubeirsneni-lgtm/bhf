import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShoppingBag, Salad, Navigation, User, LogOut } from 'lucide-react';
import { ClientAuthModal } from './ClientAuthModal';

export const ClientHeader: React.FC = () => {
  const {
    cartCount,
    setIsCartOpen,
    activeClientTab,
    setActiveClientTab,
    activeTrackingOrder,
    backToMenu,
    selectedProductId,
    isAuthenticated,
    currentUser,
    openClientAuth,
    logout
  } = useApp();

  const handleMenuClick = () => {
    backToMenu();
    setActiveClientTab('menu');
  };

  const isClientConnected = isAuthenticated && currentUser?.role === 'client';

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md relative sm:sticky sm:top-10 z-40 border-b border-stone-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
            {/* Logo & Brand Name */}
            <div
              className="flex items-center gap-2 sm:gap-3 cursor-pointer group flex-shrink-0"
              onClick={handleMenuClick}
            >
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform flex-shrink-0">
                <Salad className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-extrabold text-base sm:text-2xl text-stone-900 tracking-tight font-display">
                    BEBBA
                  </span>
                  <span className="hidden min-[480px]:inline-block text-[10px] sm:text-sm font-semibold text-emerald-700 uppercase tracking-widest px-1.5 py-0.5 bg-emerald-50 rounded border border-emerald-200/60">
                    Healthy Food
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-stone-500 font-medium hidden sm:block">
                  « Vos Plats santé en un clic »
                </p>
              </div>
            </div>

            {/* Nav links & Actions */}
            <div className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
              <button
                id="client-tab-menu-btn"
                onClick={handleMenuClick}
                className={`min-h-[44px] inline-flex items-center justify-center px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeClientTab === 'menu' && !selectedProductId
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <span className="hidden sm:inline">Notre Menu</span>
                <span className="sm:hidden">Menu</span>
              </button>

              <button
                id="client-tab-tracking-btn"
                onClick={() => setActiveClientTab('tracking')}
                className={`min-h-[44px] inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all relative cursor-pointer ${
                  activeClientTab === 'tracking'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
                }`}
              >
                <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                <span className="hidden sm:inline">Suivi Commande</span>
                <span className="sm:hidden">Suivi</span>
                {activeTrackingOrder && activeTrackingOrder.status !== 'delivered' && activeTrackingOrder.status !== 'cancelled' && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                )}
              </button>

              {/* Client Auth State: Connected Badge OR Login/Register CTA */}
              {isClientConnected && currentUser ? (
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    id="client-user-badge"
                    className="min-h-[44px] inline-flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-950"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left hidden min-[640px]:block">
                      <div className="text-xs font-bold leading-tight truncate max-w-[120px]">
                        {currentUser.name}
                      </div>
                      {currentUser.phone && (
                        <div className="text-[10px] text-emerald-700 leading-tight truncate">
                          {currentUser.phone}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    id="client-header-logout-btn"
                    onClick={logout}
                    title="Se déconnecter"
                    className="min-h-[44px] inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-rose-600 hover:bg-rose-50 border border-stone-200 hover:border-rose-200 transition-all cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline">Déconnexion</span>
                  </button>
                </div>
              ) : (
                <button
                  id="client-header-auth-btn"
                  onClick={() => openClientAuth('login')}
                  className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all bg-emerald-50 text-emerald-900 border border-emerald-200/80 hover:bg-emerald-100/80 hover:border-emerald-300 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700 flex-shrink-0" />
                  <span className="hidden sm:inline">Connexion / Inscription</span>
                  <span className="sm:hidden">Connexion</span>
                </button>
              )}

              {/* Cart trigger button */}
              <button
                id="open-cart-btn"
                onClick={() => setIsCartOpen(true)}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-stone-900 text-white hover:bg-emerald-700 transition-colors shadow-sm relative font-medium text-xs sm:text-sm cursor-pointer"
              >
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Mon Panier</span>
                {cartCount > 0 && (
                  <span
                    id="cart-count-badge"
                    className="bg-emerald-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full shadow"
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Client Authentication Modal */}
      <ClientAuthModal />
    </>
  );
};
