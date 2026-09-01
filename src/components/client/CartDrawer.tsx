import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { cleanClientText } from '../../utils/clientFormatters';
import {
  X,
  Trash2,
  Plus,
  Minus,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  Banknote,
  Utensils
} from 'lucide-react';
import { CheckoutModal } from './CheckoutModal';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartTotal,
    cartCount
  } = useApp();

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);

  if (!isCartOpen) return null;

  const deliveryFee = cart.length > 0 ? 2.5 : 0;
  const grandTotal = Math.round((cartTotal + deliveryFee) * 10) / 10;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsCartOpen(false)}
        />

        <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
          <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
            
            {/* Drawer Header */}
            <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-600/30 text-emerald-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-display">Mon Panier</h2>
                  <p className="text-xs text-stone-400">
                    {cartCount} article{cartCount > 1 ? 's' : ''} • Préparé à la commande
                  </p>
                </div>
              </div>
              <button
                id="close-cart-drawer-btn"
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-stone-500 py-12 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-800 text-base">Votre panier est vide</h3>
                    <p className="text-xs text-stone-500 max-w-xs mt-1">
                      Découvrez nos bowls healthy et grillades préparés individuellement à la commande.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-sm hover:bg-emerald-700 transition-colors"
                  >
                    Parcourir le Menu
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-stone-500 pb-2 border-b border-stone-100">
                    <span>Articles personnalisés</span>
                    <button
                      onClick={clearCart}
                      className="text-stone-400 hover:text-rose-600 transition-colors font-medium flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Vider le panier</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {cart.map(item => (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl border border-stone-200 bg-stone-50/50 space-y-2.5 relative group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-sm text-stone-900 leading-snug">
                              {item.product.name}
                            </h4>
                            <span className="text-xs font-bold text-emerald-700">
                              {item.itemTotalPrice.toFixed(1)} DT
                            </span>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-stone-400 hover:text-rose-600 p-1 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Selected Options Breakdown */}
                        <div className="text-xs text-stone-600 space-y-1 bg-white p-2.5 rounded-xl border border-stone-100">
                          {item.proteinOption && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-stone-400">•</span>
                              <span className="font-medium text-stone-700">Protéine :</span>
                              <span>{cleanClientText(item.proteinOption.label)}</span>
                            </div>
                          )}
                          {item.baseChoice && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-stone-400">•</span>
                              <span className="font-medium text-stone-700">Base :</span>
                              <span>{cleanClientText(item.baseChoice.label)}</span>
                            </div>
                          )}
                          {item.veggiesOption && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-stone-400">•</span>
                              <span className="font-medium text-stone-700">Légumes :</span>
                              <span>{cleanClientText(item.veggiesOption.label)}</span>
                            </div>
                          )}
                          {(item.supplements || []).length > 0 && (
                            <div className="flex items-start gap-1 text-[11px] text-emerald-800">
                              <span className="text-stone-400">•</span>
                              <span className="font-medium">Suppléments :</span>
                              <span>
                                {(item.supplements || [])
                                  .map(s => `${cleanClientText(s.supplement.name)} (x${s.quantity})`)
                                  .join(', ')}
                              </span>
                            </div>
                          )}
                          {item.specialInstructions && (
                            <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded italic mt-1">
                              Note cuisine : « {item.specialInstructions} »
                            </div>
                          )}
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-stone-500">Quantité</span>
                          <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-stone-200 shadow-2xs">
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                              className="w-6 h-6 rounded-lg text-stone-700 hover:bg-stone-100 flex items-center justify-center font-bold text-xs"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-5 text-center font-bold text-xs text-stone-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                              className="w-6 h-6 rounded-lg text-stone-700 hover:bg-stone-100 flex items-center justify-center font-bold text-xs"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Footer Calculation & Checkout Button */}
            {cart.length > 0 && (
              <div className="p-5 bg-stone-50 border-t border-stone-200 space-y-3">
                <div className="space-y-1.5 text-xs text-stone-600">
                  <div className="flex justify-between">
                    <span>Sous-total plats :</span>
                    <span className="font-semibold text-stone-900">{cartTotal.toFixed(1)} DT</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Frais de livraison :</span>
                    <span className="font-semibold text-stone-900">{deliveryFee.toFixed(1)} DT</span>
                  </div>
                  <div className="border-t border-stone-200 pt-2 flex justify-between text-sm font-extrabold text-stone-900">
                    <span>Total à la livraison :</span>
                    <span className="text-emerald-700 font-extrabold text-base">
                      {grandTotal.toFixed(1)} DT
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-900 text-[11px]">
                  <Banknote className="w-4 h-4 text-amber-700 flex-shrink-0" />
                  <span>Paiement en espèces à la réception de votre commande.</span>
                </div>

                <button
                  id="checkout-open-modal-btn"
                  onClick={() => setIsCheckoutModalOpen(true)}
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-900/30 flex items-center justify-between transition-all active:scale-[0.98]"
                >
                  <span>Passer la Commande</span>
                  <span className="flex items-center gap-1.5">
                    <span>{grandTotal.toFixed(1)} DT</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={() => setIsCheckoutModalOpen(false)}
      />
    </>
  );
};
