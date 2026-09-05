import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order } from '../../types';
import {
  X,
  Phone,
  User,
  MapPin,
  FileText,
  Banknote,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose }) => {
  const { cart, cartTotal, createOrder, setActiveTrackingToken, setActiveClientTab } = useApp();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+216 ');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    phone?: string;
    address?: string;
  }>({});
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setConfirmedOrder(null);
    setCopiedCode(false);
    setName('');
    setPhone('+216 ');
    setAddress('');
    setNotes('');
    setFieldErrors({});
    setErrorMsg(null);
    onClose();
  };

  const handleGoToTracking = () => {
    if (confirmedOrder?.trackingToken) {
      setActiveTrackingToken(confirmedOrder.trackingToken);
    }
    setActiveClientTab('tracking');
    handleClose();
  };

  const handleCopyCode = async (token: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = token;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch (e) {
      // fallback
    }
  };

  const deliveryFee = 2.5;
  const grandTotal = Math.round((cartTotal + deliveryFee) * 10) / 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const errors: { phone?: string; address?: string } = {};

    // Règle métier : Le nom/prénom est FACULTATIF.
    // Seuls le téléphone et l'adresse de livraison sont obligatoires.

    // 1. Contrôle du téléphone (minimum 8 chiffres utiles hors indicatif ou format standard)
    const rawDigits = phone.replace(/\D/g, '');
    const isPhoneEmptyOrShort = !phone.trim() || rawDigits.length < 8 || phone.trim() === '+216';
    if (isPhoneEmptyOrShort) {
      errors.phone = 'Numéro de téléphone obligatoire';
    }

    // 2. Contrôle de l'adresse de livraison
    if (!address.trim()) {
      errors.address = 'Adresse de livraison obligatoire';
    }

    // Si un des champs obligatoires est manquant, bloquer l'envoi et afficher les erreurs
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMsg('Veuillez renseigner les champs obligatoires (téléphone et adresse de livraison).');
      return;
    }

    setFieldErrors({});

    try {
      setIsSubmitting(true);
      const newOrder = await createOrder({
        client: {
          name: name.trim() || 'Client',
          phone: phone.trim(),
          deliveryAddress: address.trim(),
          notes: notes.trim() || undefined
        }
      });

      // Celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // ignore
      }

      setConfirmedOrder(newOrder);
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue lors de la commande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Écran de confirmation de commande
  if (confirmedOrder) {
    const displayOrderNumber = confirmedOrder.orderNumber.startsWith('#')
      ? confirmedOrder.orderNumber
      : `#${confirmedOrder.orderNumber}`;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
        <div
          id="checkout-confirmation-modal"
          className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-5 bg-stone-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold font-display">
                Commande confirmée
              </h2>
            </div>
            <button
              id="close-confirmation-modal-btn"
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-extrabold text-stone-900">
                Commande confirmée
              </h3>
              <p className="text-sm text-stone-600">
                Votre commande a bien été enregistrée.
              </p>
            </div>

            {/* Order Details Card */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-left space-y-3.5">
              <div>
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                  Numéro de commande
                </span>
                <span className="text-lg font-extrabold text-stone-900 font-mono">
                  {displayOrderNumber}
                </span>
              </div>

              <div className="border-t border-stone-200/80 pt-3">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block mb-1">
                  Code de suivi
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white border border-stone-300 rounded-xl px-3 py-2 font-mono text-xs sm:text-sm font-bold text-stone-800 break-all select-all">
                    {confirmedOrder.trackingToken}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(confirmedOrder.trackingToken)}
                    className="px-3 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-800 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer flex-shrink-0"
                    title="Copier le code de suivi"
                  >
                    {copiedCode ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Action button */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                id="track-order-direct-btn"
                onClick={handleGoToTracking}
                className="w-full min-h-[48px] py-3.5 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-extrabold text-sm shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Suivre ma commande en direct</span>
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full py-2.5 text-xs font-semibold text-stone-500 hover:text-stone-700 transition-colors cursor-pointer"
              >
                Fermer et retourner à la boutique
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        id="checkout-modal"
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Header */}
        <div className="p-5 bg-stone-900 text-white flex items-center justify-between flex-shrink-0">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Étape finale
            </span>
            <h2 className="text-xl font-bold font-display">
              Validation de la Commande
            </h2>
          </div>
          <button
            id="close-checkout-modal-btn"
            onClick={handleClose}
            className="w-11 h-11 flex items-center justify-center rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Notice: No Account Needed */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-900 text-xs flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-700 flex-shrink-0" />
            <span>
              <strong>Commande Express :</strong> Aucun compte requis. Votre code de suivi sécurisé vous sera délivré immédiatement.
            </span>
          </div>

          {/* Contact & Delivery Details Group */}
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-200/80 pb-2">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-stone-900 uppercase tracking-wide">
                Coordonnées &amp; Adresse de Livraison
              </span>
            </div>

            {/* Full Name (Facultatif) */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-stone-500" />
                  <span>Nom et Prénom <span className="text-stone-400 font-normal text-[11px]">(Facultatif)</span></span>
                </span>
              </label>
              <input
                type="text"
                id="checkout-name-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Mohamed Ben Salem"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Numéro de Téléphone Mobile *</span>
                </span>
                {fieldErrors.phone && (
                  <span className="text-rose-600 text-[11px] font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.phone}
                  </span>
                )}
              </label>
              <input
                type="tel"
                id="checkout-phone-input"
                value={phone}
                onChange={e => {
                  setPhone(e.target.value);
                  if (fieldErrors.phone) {
                    setFieldErrors(prev => ({ ...prev, phone: undefined }));
                  }
                }}
                placeholder="+216 98 123 456 ou 22 345 678"
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none font-mono transition-colors ${
                  fieldErrors.phone
                    ? 'border-2 border-rose-500 bg-rose-50/20 text-stone-900 focus:ring-2 focus:ring-rose-400'
                    : 'border border-stone-300 bg-white focus:ring-2 focus:ring-emerald-500'
                }`}
              />
              {fieldErrors.phone ? (
                <p className="text-[11px] font-semibold text-rose-600">
                  {fieldErrors.phone}
                </p>
              ) : (
                <p className="text-[11px] text-stone-500">
                  Indispensable : le livreur vous appellera sur ce numéro dès son arrivée.
                </p>
              )}
            </div>

            {/* Delivery Address */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Adresse de Livraison Complète *</span>
                </span>
                {fieldErrors.address && (
                  <span className="text-rose-600 text-[11px] font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.address}
                  </span>
                )}
              </label>
              <textarea
                id="checkout-address-input"
                rows={2}
                value={address}
                onChange={e => {
                  setAddress(e.target.value);
                  if (fieldErrors.address) {
                    setFieldErrors(prev => ({ ...prev, address: undefined }));
                  }
                }}
                placeholder="Ex: Rue du Lac Biwa, Résidence Émeraude, Bloc B, Apt 12, Les Berges du Lac"
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm focus:outline-none transition-colors ${
                  fieldErrors.address
                    ? 'border-2 border-rose-500 bg-rose-50/20 text-stone-900 focus:ring-2 focus:ring-rose-400'
                    : 'border border-stone-300 bg-white focus:ring-2 focus:ring-emerald-500'
                }`}
              />
              {fieldErrors.address && (
                <p className="text-[11px] font-semibold text-rose-600">
                  {fieldErrors.address}
                </p>
              )}
            </div>

            {/* Notes for Driver */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-stone-500" />
                <span>Instructions supplémentaires pour le livreur (Optionnel)</span>
              </label>
              <input
                type="text"
                id="checkout-notes-input"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Code porte 3840, interphone B12, sonner à gauche..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>

            {/* Live address and phone recap badge */}
            {(phone.trim() || address.trim()) && (
              <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-xs text-emerald-950 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-emerald-800 text-[11px] uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Rappel de livraison associé :
                </span>
                {phone.trim() && (
                  <p className="font-mono text-xs">
                    📞 Téléphone de contact : <strong>{phone}</strong>
                  </p>
                )}
                {address.trim() && (
                  <p className="text-xs">
                    📍 Destination : <strong>{address}</strong>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Payment Method Notice (Cash on Delivery exclusively) */}
          <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 space-y-2">
            <div className="flex items-center gap-2 text-amber-950 font-bold text-xs sm:text-sm">
              <Banknote className="w-5 h-5 text-amber-700" />
              <span>Mode de paiement exclusif :</span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-amber-200/80 shadow-xs flex items-center justify-between">
              <div>
                <span className="font-extrabold text-stone-900 text-sm">
                  PAIEMENT À LA LIVRAISON
                </span>
                <p className="text-[11px] text-stone-500">
                  Règlement en espèces directement auprès du livreur.
                </p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            </div>
            <div className="pt-1 flex items-center justify-between text-xs font-bold text-stone-900">
              <span>Montant exact à préparer :</span>
              <span className="text-emerald-700 font-extrabold text-base">
                {grandTotal.toFixed(1)} DT
              </span>
            </div>
          </div>

          {/* Order Summary Recap */}
          <div className="p-3.5 rounded-2xl bg-stone-100 text-xs space-y-1.5 text-stone-600">
            <div className="flex justify-between font-medium">
              <span>Sous-total plats ({cart.length} articles) :</span>
              <span>{cartTotal.toFixed(1)} DT</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Frais de livraison à domicile :</span>
              <span>{deliveryFee.toFixed(1)} DT</span>
            </div>
            <div className="border-t border-stone-200 pt-1.5 flex justify-between font-extrabold text-sm text-stone-900">
              <span>Total TTC à la livraison :</span>
              <span className="text-emerald-700">{grandTotal.toFixed(1)} DT</span>
            </div>
          </div>

          {/* Final submit button */}
          <button
            type="submit"
            id="confirm-order-submit-btn"
            disabled={isSubmitting}
            className="w-full min-h-[48px] py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span>Transmission de la commande...</span>
            ) : (
              <span>CONFIRMER LA COMMANDE ({grandTotal.toFixed(1)} DT)</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
