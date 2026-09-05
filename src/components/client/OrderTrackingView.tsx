import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, OrderStatus } from '../../types';
import { cleanClientText } from '../../utils/clientFormatters';
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Bike,
  PackageCheck,
  ShoppingBag,
  Bell,
  BellOff,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Phone,
  Banknote,
  Search,
  RefreshCw,
  Sparkles,
  AlertCircle,
  User
} from 'lucide-react';

export const OrderTrackingView: React.FC = () => {
  const {
    orders,
    activeTrackingToken,
    setActiveTrackingToken,
    activeTrackingOrder,
    refreshAllData,
    notificationsEnabled,
    setNotificationsEnabled,
    showToast,
    setActiveClientTab
  } = useApp();

  const [tokenInput, setTokenInput] = useState('');
  const [orderNumberInput, setOrderNumberInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [isSearchingLookup, setIsSearchingLookup] = useState(false);
  const [isSearchingToken, setIsSearchingToken] = useState(false);
  const [showTokenSearch, setShowTokenSearch] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const currentOrder = activeTrackingOrder || searchedOrder;

  // Auto-fetch order if token is present (e.g. from direct URL link or recent order)
  useEffect(() => {
    const tokenToFetch = activeTrackingToken?.trim();
    if (!tokenToFetch) return;

    if (currentOrder && (currentOrder.trackingToken === tokenToFetch || currentOrder.orderNumber.toLowerCase() === tokenToFetch.toLowerCase())) {
      return;
    }

    let isMounted = true;
    fetch(`/api/orders/track/${encodeURIComponent(tokenToFetch)}`, {
      headers: { Accept: 'application/json' }
    })
      .then(res => {
        if (!res.ok) throw new Error('Commande introuvable.');
        return res.json();
      })
      .then(data => {
        if (isMounted && data && !data.error) {
          setSearchedOrder(data);
          setSearchError(null);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [activeTrackingToken, currentOrder]);

  const handleOrderLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const orderNum = orderNumberInput.trim();
    const phone = phoneInput.trim();
    if (!orderNum || !phone) {
      setSearchError('Veuillez renseigner votre numéro de commande et votre numéro de téléphone.');
      return;
    }
    setSearchError(null);
    setIsSearchingLookup(true);

    try {
      const res = await fetch('/api/orders/track-lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ orderNumber: orderNum, phone })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Impossible de retrouver cette commande. Vérifiez votre numéro de commande et votre numéro de téléphone.');
      }

      if (data.trackingToken) {
        setActiveTrackingToken(data.trackingToken);
      }
      setSearchedOrder(data);
      setSearchError(null);
      showToast('Commande retrouvée !', `Suivi en direct activé pour la commande #${data.orderNumber}.`, 'success');
    } catch (err: any) {
      setSearchError(err.message || 'Impossible de retrouver cette commande. Vérifiez votre numéro de commande et votre numéro de téléphone.');
    } finally {
      setIsSearchingLookup(false);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = tokenInput.trim();
    if (!query) return;
    setSearchError(null);
    setIsSearchingToken(true);

    // 1. Check in already loaded orders
    const localMatch = (orders || []).find(o => o.trackingToken === query);
    if (localMatch) {
      setActiveTrackingToken(localMatch.trackingToken);
      setSearchedOrder(localMatch);
      setIsSearchingToken(false);
      return;
    }

    try {
      const res = await fetch(`/api/orders/track/${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) {
        throw new Error('Aucune commande trouvée avec ce code de suivi.');
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Erreur de communication avec le serveur.');
      }
      const data = await res.json();
      setActiveTrackingToken(data.trackingToken || query);
      setSearchedOrder(data);
    } catch (err: any) {
      setSearchError(err.message || 'Commande introuvable.');
    } finally {
      setIsSearchingToken(false);
    }
  };

  const handleCopyCode = () => {
    if (!currentOrder?.trackingToken) return;
    navigator.clipboard.writeText(currentOrder.trackingToken);
    setCopied(true);
    showToast('Code copié !', 'Le code de suivi a été copié dans le presse-papier.', 'info');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleToggleNotifications = () => {
    if (!notificationsEnabled) {
      if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setNotificationsEnabled(true);
            showToast('Notifications activées', 'Vous recevrez les alertes de changement d’état de votre commande.', 'success');
          } else {
            setNotificationsEnabled(true); // Still enable in-app toast simulation
            showToast('Notifications activées (In-App)', 'Alertes visuelles activées dans l’application.', 'info');
          }
        });
      } else {
        setNotificationsEnabled(true);
        showToast('Notifications activées', 'Alertes en direct activées.', 'info');
      }
    } else {
      setNotificationsEnabled(false);
      showToast('Notifications désactivées', 'Vous pouvez toujours suivre votre commande sur cette page.', 'info');
    }
  };

  const manualRefresh = async () => {
    setIsRefreshing(true);
    if (currentOrder?.trackingToken) {
      try {
        const res = await fetch(`/api/orders/track/${encodeURIComponent(currentOrder.trackingToken)}`, {
          headers: { Accept: 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error) {
            setSearchedOrder(data);
          }
        }
      } catch (e) {}
    }
    await refreshAllData();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // 5 standard progression stages
  const stages: Array<{
    id: OrderStatus;
    title: string;
    description: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'received',
      title: 'Commande reçue',
      description: 'Enregistrée et transmise à la cuisine',
      icon: <CheckCircle2 className="w-5 h-5" />
    },
    {
      id: 'preparing',
      title: 'En préparation en cuisine',
      description: 'Cuisson minute & grillades selon vos personnalisations',
      icon: <ChefHat className="w-5 h-5" />
    },
    {
      id: 'ready',
      title: 'Commande prête',
      description: 'Emballée avec soin en sac thermique',
      icon: <PackageCheck className="w-5 h-5" />
    },
    {
      id: 'waiting_for_driver',
      title: 'En attente de livreur',
      description: 'Prête en cuisine, en cours d’attribution au livreur',
      icon: <Clock className="w-5 h-5" />
    },
    {
      id: 'delivering',
      title: 'En cours de livraison',
      description: 'Le livreur est en route vers votre adresse',
      icon: <Bike className="w-5 h-5" />
    },
    {
      id: 'delivered',
      title: 'Commande livrée',
      description: currentOrder?.paymentStatus === 'paid'
        ? 'Remise au client • Paiement en espèces encaissé • Bon appétit !'
        : 'Remise au client • En attente de règlement en espèces',
      icon: <Sparkles className="w-5 h-5" />
    }
  ];

  const getStageIndex = (status: OrderStatus) => {
    if (status === 'received') return 0;
    if (status === 'preparing') return 1;
    if (status === 'ready') return 2;
    if (status === 'waiting_for_driver') return 3;
    if (status === 'delivering') return 4;
    if (status === 'delivered') return 5;
    return -1;
  };

  const currentStageIndex = currentOrder ? getStageIndex(currentOrder.status) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner & Search */}
      <div className="bg-white p-5 sm:p-7 rounded-3xl border border-stone-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Portail Client Sans Compte
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-display">
              Suivi de Commande en Direct
            </h1>
            <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
              Mise à jour en temps réel par notre équipe cuisine &amp; livreurs.
            </p>
          </div>
        </div>

        {/* Section principale : Retrouver ma commande (N° commande + Téléphone) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-stone-800">
              Retrouver ma commande
            </h2>
          </div>

          <form onSubmit={handleOrderLookup} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5">
              <label htmlFor="lookup-ordernumber-input" className="block text-[11px] font-bold text-stone-600 mb-1">
                Numéro de commande
              </label>
              <input
                type="text"
                id="lookup-ordernumber-input"
                value={orderNumberInput}
                onChange={e => setOrderNumberInput(e.target.value)}
                placeholder="Ex : BEBBA-1047"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 bg-stone-50 font-mono font-bold text-stone-900"
              />
            </div>

            <div className="sm:col-span-4">
              <label htmlFor="lookup-phone-input" className="block text-[11px] font-bold text-stone-600 mb-1">
                Numéro de téléphone
              </label>
              <input
                type="text"
                id="lookup-phone-input"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                placeholder="Ex : 98 440 210"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 bg-stone-50 font-mono text-stone-900"
              />
            </div>

            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                id="lookup-order-btn"
                disabled={isSearchingLookup}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-bold text-xs transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {isSearchingLookup ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Retrouver ma commande</span>
              </button>
            </div>
          </form>

          {/* Option secondaire : Vous avez déjà votre code de suivi ? */}
          <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <button
              type="button"
              id="toggle-token-search-btn"
              onClick={() => setShowTokenSearch(!showTokenSearch)}
              className="text-stone-500 hover:text-emerald-700 font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer text-left"
            >
              <span>{showTokenSearch ? '▾ Masquer la recherche par code de suivi' : '▸ Vous avez déjà votre code de suivi (ex : tk_...) ?'}</span>
            </button>

            {showTokenSearch && (
              <form onSubmit={handleManualSearch} className="flex items-center gap-2 w-full sm:w-auto animate-in fade-in duration-200">
                <input
                  type="text"
                  id="tracking-token-input"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  placeholder="Code suivi (ex: tk_...)"
                  className="w-full sm:w-56 min-h-[40px] px-3 py-1.5 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 bg-stone-50 font-mono"
                />
                <button
                  type="submit"
                  id="search-by-token-btn"
                  disabled={isSearchingToken}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-stone-900 text-white font-bold text-xs hover:bg-emerald-700 transition-colors inline-flex items-center justify-center cursor-pointer flex-shrink-0 disabled:opacity-50"
                >
                  {isSearchingToken ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Vérifier'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {searchError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{searchError}</span>
        </div>
      )}

      {/* Main Order Card */}
      {currentOrder ? (
        <div className="space-y-6">
          
          {/* Order Header Card */}
          <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 font-mono">
                    #{currentOrder.orderNumber}
                  </h2>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    currentOrder.status === 'delivered'
                      ? 'bg-emerald-100 text-emerald-800'
                      : currentOrder.status === 'delivering'
                      ? 'bg-blue-100 text-blue-800 animate-pulse'
                      : currentOrder.status === 'ready'
                      ? 'bg-purple-100 text-purple-800'
                      : currentOrder.status === 'waiting_for_driver'
                      ? 'bg-amber-100 text-amber-800'
                      : currentOrder.status === 'preparing'
                      ? 'bg-amber-100 text-amber-800 animate-pulse'
                      : 'bg-stone-100 text-stone-800'
                  }`}>
                    {stages.find(s => s.id === currentOrder.status)?.title || currentOrder.status}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">
                  Passée le {new Date(currentOrder.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-600">Code de suivi :</span>
                  <code className="text-xs font-mono font-bold bg-stone-100 text-stone-900 px-2.5 py-1 rounded-lg border border-stone-200 select-all">
                    {currentOrder.trackingToken}
                  </code>
                </div>
              </div>

              {/* Action buttons (Copy code, Refresh, Push notifications) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={manualRefresh}
                  className="min-h-[44px] p-2.5 px-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Actualiser le statut"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
                  <span className="hidden sm:inline">Actualiser</span>
                </button>

                <button
                  onClick={handleCopyCode}
                  className="min-h-[44px] p-2.5 px-3 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Copier le code de suivi"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Code copié' : 'Copier le code'}</span>
                </button>

                <button
                  onClick={handleToggleNotifications}
                  className={`min-h-[44px] p-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    notificationsEnabled
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'border border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {notificationsEnabled ? (
                    <>
                      <Bell className="w-4 h-4 text-emerald-600" />
                      <span className="hidden sm:inline">Alertes On</span>
                    </>
                  ) : (
                    <>
                      <BellOff className="w-4 h-4 text-stone-400" />
                      <span className="hidden sm:inline">Activer Alertes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Visual Step-by-Step Progress Timeline */}
            <div className="py-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 relative">
                {stages.map((stage, idx) => {
                  const isCompleted = idx <= currentStageIndex;
                  const isCurrent = idx === currentStageIndex;

                  return (
                    <div
                      key={stage.id}
                      className={`relative p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                        isCurrent
                          ? 'bg-emerald-50 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                          : isCompleted
                          ? 'bg-stone-50 border-emerald-200 text-stone-800'
                          : 'bg-white border-stone-200 text-stone-400 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isCurrent
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-stone-100 text-stone-400'
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4" /> : idx + 1}
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                          Étape {idx + 1}
                        </span>
                      </div>

                      <div>
                        <h4 className={`text-xs font-bold leading-snug ${isCurrent ? 'text-emerald-950 font-extrabold' : 'text-stone-800'}`}>
                          {stage.title}
                        </h4>
                        <p className="text-[11px] text-stone-500 mt-1 leading-normal">
                          {stage.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Driver Banner (if assigned) */}
            {(currentOrder.assignedDriverName || (currentOrder as any).assignedDriver?.name) && (
              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <Bike className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-blue-700 tracking-wider">
                      Livreur BEBBA Attribué
                    </span>
                    <h4 className="text-sm font-bold text-stone-900">
                      {currentOrder.assignedDriverName || (currentOrder as any).assignedDriver?.name}
                    </h4>
                    <p className="text-xs text-stone-600">
                      En route pour la livraison à votre adresse
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-blue-800">
                    {currentOrder.status === 'delivering' ? 'Livraison en cours' : 'Prêt pour départ'}
                  </span>
                </div>
              </div>
            )}

            {/* Financial Summary & Cash on Delivery Reminder */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200/90 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Banknote className="w-4 h-4 text-amber-700" />
                  <span>Paiement à la livraison :</span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-xs text-stone-600">Montant à régler au livreur :</span>
                  <span className="text-xl font-extrabold text-stone-900">
                    {(currentOrder.totalAmount ?? 0).toFixed(1)} DT
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-amber-200/60">
                  <span>Statut encaissement :</span>
                  <span className={`font-bold ${currentOrder.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-800'}`}>
                    {currentOrder.paymentStatus === 'paid' ? '✓ Payé & Encaissé' : '💵 À encaisser à la livraison'}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5 text-xs text-stone-600">
                <div className="flex items-center justify-between border-b border-stone-200/80 pb-2">
                  <div className="flex items-center gap-2 text-stone-900 font-bold">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>Adresse &amp; Contact de Livraison</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    Livraison Express
                  </span>
                </div>

                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center gap-2 text-stone-900 font-semibold">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>Client : <strong>{currentOrder.client?.name || (currentOrder as any).clientName || 'Client'}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-stone-900 font-semibold">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Numéro de téléphone : </span>
                    {(currentOrder.client?.phone || (currentOrder as any).phone) ? (
                      <a
                        href={`tel:${currentOrder.client?.phone || (currentOrder as any).phone}`}
                        className="font-mono font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200 px-2 py-0.5 rounded transition-colors"
                      >
                        {currentOrder.client?.phone || (currentOrder as any).phone}
                      </a>
                    ) : (
                      <span className="text-stone-400 font-normal text-xs">Non renseigné</span>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-stone-800 pt-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-stone-500 font-normal">Adresse : </span>
                      <strong className="text-stone-900">
                        {currentOrder.client?.deliveryAddress || (currentOrder as any).deliveryAddress || 'Adresse non renseignée'}
                      </strong>
                    </div>
                  </div>
                </div>

                {(currentOrder.client?.notes || (currentOrder as any).notes) && (
                  <p className="text-[11px] text-stone-600 italic bg-amber-50/80 border border-amber-200/70 p-2 rounded-xl mt-1">
                    Note pour le livreur : « {currentOrder.client?.notes || (currentOrder as any).notes} »
                  </p>
                )}
              </div>
            </div>

            {/* Order Items Breakdown */}
            <div className="space-y-3 pt-2">
              <h3 className="font-bold text-sm text-stone-900 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>Détail de votre commande préparée à la minute :</span>
              </h3>

              <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-stone-50/50">
                {(currentOrder.items || []).map((item: any, idx) => (
                  <div key={idx} className="p-3.5 sm:p-4 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-stone-900">
                          {item.productName || item.product?.name || 'Article'}{' '}
                          <span className="text-stone-500 font-medium">x{item.quantity || 1}</span>
                        </h4>
                        <span className="text-xs font-bold text-emerald-700">
                          {(item.itemTotalPrice ?? ((item.unitPrice || 0) * (item.quantity || 1))).toFixed(1)} DT
                        </span>
                      </div>
                    </div>

                    {/* Customizations */}
                    <div className="text-xs text-stone-600 space-y-0.5 bg-stone-50 p-2.5 rounded-xl">
                      {item.proteinOption && (
                        <p>• Protéine : <strong className="text-stone-800">
                          {cleanClientText(typeof item.proteinOption === 'object' ? (item.proteinOption.label || item.proteinOption.name || '') : String(item.proteinOption))}
                        </strong></p>
                      )}
                      {item.baseChoice && (
                        <p>• Base : <strong className="text-stone-800">
                          {cleanClientText(typeof item.baseChoice === 'object' ? (item.baseChoice.label || item.baseChoice.name || '') : String(item.baseChoice))}
                        </strong></p>
                      )}
                      {item.veggiesOption && (
                        <p>• Légumes : <strong className="text-stone-800">
                          {cleanClientText(typeof item.veggiesOption === 'object' ? (item.veggiesOption.label || item.veggiesOption.name || '') : String(item.veggiesOption))}
                        </strong></p>
                      )}
                      {item.supplements && item.supplements.length > 0 && (
                        <p className="text-emerald-800 font-medium">
                          • Suppléments : {item.supplements.map((s: any) => {
                            if (typeof s === 'string') {
                              return cleanClientText(s);
                            }
                            const name = s.name || s.supplement?.name || 'Supplément';
                            const qty = s.quantity && s.quantity > 1 ? ` (x${s.quantity})` : '';
                            return `${cleanClientText(name)}${qty}`;
                          }).join(', ')}
                        </p>
                      )}
                      {item.specialInstructions && (
                        <p className="text-amber-800 italic mt-1 bg-amber-50 px-2 py-0.5 rounded">
                          Instructions : « {item.specialInstructions} »
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Status History Timeline */}
            <div className="space-y-3 pt-4 border-t border-stone-100">
              <h3 className="font-bold text-xs uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Journal d'activité &amp; Horodatage</span>
              </h3>

              <div className="space-y-2">
                {(currentOrder.statusHistory || []).map((hist: any, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-stone-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                    <span className="font-mono text-[11px] text-stone-400">
                      {hist.timestamp ? new Date(hist.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    <span className="font-semibold text-stone-800">{hist.label}</span>
                    {hist.note && <span className="text-stone-500 italic">— {hist.note}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Assistance & Hotline */}
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 text-emerald-950">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold">Assistance Livraison &amp; Restaurant BEBBA</h5>
                  <p className="text-emerald-800 text-[11px]">
                    Besoin de préciser votre adresse ou de contacter la cuisine ?
                  </p>
                </div>
              </div>
              <a
                href="tel:+21671888999"
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold font-mono text-xs flex items-center gap-1.5 shadow-xs transition-colors whitespace-nowrap"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>+216 71 888 999</span>
              </a>
            </div>

          </div>

          {/* Button back to menu */}
          <div className="text-center pt-2">
            <button
              onClick={() => setActiveClientTab('menu')}
              className="min-h-[44px] px-6 py-3 rounded-2xl bg-stone-900 text-white font-bold text-xs sm:text-sm hover:bg-emerald-700 transition-colors shadow-sm inline-flex items-center justify-center cursor-pointer"
            >
              Commander un autre plat
            </button>
          </div>
        </div>
      ) : (
        /* Empty / No Order Selected */
        <div className="bg-white rounded-3xl p-10 border border-stone-200 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mx-auto">
            <Search className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-stone-800">Aucune commande active sélectionnée</h3>
            <p className="text-xs text-stone-500 max-w-md mx-auto mt-1">
              Renseignez votre <strong>Numéro de commande</strong> (ex: <code className="text-emerald-700 font-mono font-bold">BEBBA-1047</code>) et votre <strong>Téléphone</strong> ci-dessus pour retrouver et suivre votre commande en direct.
            </p>
          </div>
          <button
            onClick={() => setActiveClientTab('menu')}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors inline-flex items-center justify-center cursor-pointer"
          >
            Découvrir le Menu
          </button>
        </div>
      )}

    </div>
  );
};
