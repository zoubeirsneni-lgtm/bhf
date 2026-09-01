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
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchedOrder, setSearchedOrder] = useState<Order | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const currentOrder = activeTrackingOrder || searchedOrder;

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = tokenInput.trim();
    if (!query) return;
    setSearchError(null);

    // 1. Check in already loaded orders
    const localMatch = (orders || []).find(o => o.trackingToken === query || o.orderNumber.toLowerCase() === query.toLowerCase());
    if (localMatch) {
      setActiveTrackingToken(localMatch.trackingToken);
      setSearchedOrder(localMatch);
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
      setActiveTrackingToken(query);
      setSearchedOrder(data);
    } catch (err: any) {
      setSearchError(err.message || 'Commande introuvable.');
    }
  };

  const handleCopyLink = () => {
    if (!currentOrder) return;
    const url = `${window.location.origin}?token=${currentOrder.trackingToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    showToast('Lien copié !', 'Le lien de suivi a été copié dans le presse-papier.', 'info');
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
      id: 'delivering',
      title: 'En cours de livraison',
      description: 'Le livreur est en route vers votre adresse',
      icon: <Bike className="w-5 h-5" />
    },
    {
      id: 'delivered',
      title: 'Commande livrée',
      description: 'Paiement en espèces encaissé • Bon appétit !',
      icon: <Sparkles className="w-5 h-5" />
    }
  ];

  const getStageIndex = (status: OrderStatus) => {
    if (status === 'received') return 0;
    if (status === 'preparing') return 1;
    if (status === 'ready') return 2;
    if (status === 'delivering') return 3;
    if (status === 'delivered') return 4;
    return -1;
  };

  const currentStageIndex = currentOrder ? getStageIndex(currentOrder.status) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Top Banner & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-stone-200/80 shadow-xs">
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

        {/* Search input for token */}
        <form onSubmit={handleManualSearch} className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              id="tracking-token-input"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Code suivi (ex: tk_...)"
              className="w-48 sm:w-56 px-3 py-2 pl-8 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500 bg-stone-50"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-3" />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 rounded-xl bg-stone-900 text-white font-bold text-xs hover:bg-emerald-700 transition-colors"
          >
            Vérifier
          </button>
        </form>
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
              </div>

              {/* Action buttons (Copy link, Refresh, Push notifications) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={manualRefresh}
                  className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  title="Actualiser le statut"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
                  <span className="hidden sm:inline">Actualiser</span>
                </button>

                <button
                  onClick={handleCopyLink}
                  className="p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Lien copié' : 'Lien direct'}</span>
                </button>

                <button
                  onClick={handleToggleNotifications}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
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
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
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
            {currentOrder.assignedDriverName && (
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
                      {currentOrder.assignedDriverName}
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
                    {currentOrder.totalAmount.toFixed(1)} DT
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
                    <span>Client : <strong>{currentOrder.client.name}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-stone-900 font-semibold">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Numéro de téléphone : </span>
                    <a
                      href={`tel:${currentOrder.client.phone}`}
                      className="font-mono font-bold text-emerald-700 bg-emerald-100/70 hover:bg-emerald-200 px-2 py-0.5 rounded transition-colors"
                    >
                      {currentOrder.client.phone}
                    </a>
                  </div>
                  <div className="flex items-start gap-2 text-stone-800 pt-1">
                    <MapPin className="w-3.5 h-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-stone-500 font-normal">Adresse : </span>
                      <strong className="text-stone-900">{currentOrder.client.deliveryAddress}</strong>
                    </div>
                  </div>
                </div>

                {currentOrder.client.notes && (
                  <p className="text-[11px] text-stone-600 italic bg-amber-50/80 border border-amber-200/70 p-2 rounded-xl mt-1">
                    Note pour le livreur : « {currentOrder.client.notes} »
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
                {currentOrder.items.map((item, idx) => (
                  <div key={idx} className="p-3.5 sm:p-4 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-stone-900">
                          {item.productName} <span className="text-stone-500 font-medium">x{item.quantity}</span>
                        </h4>
                        <span className="text-xs font-bold text-emerald-700">
                          {item.itemTotalPrice.toFixed(1)} DT
                        </span>
                      </div>
                    </div>

                    {/* Customizations */}
                    <div className="text-xs text-stone-600 space-y-0.5 bg-stone-50 p-2.5 rounded-xl">
                      {item.proteinOption && (
                        <p>• Protéine : <strong className="text-stone-800">{cleanClientText(item.proteinOption.label)}</strong></p>
                      )}
                      {item.baseChoice && (
                        <p>• Base : <strong className="text-stone-800">{cleanClientText(item.baseChoice.label)}</strong></p>
                      )}
                      {item.veggiesOption && (
                        <p>• Légumes : <strong className="text-stone-800">{cleanClientText(item.veggiesOption.label)}</strong></p>
                      )}
                      {item.supplements && item.supplements.length > 0 && (
                        <p className="text-emerald-800 font-medium">
                          • Suppléments : {item.supplements.map(s => `${cleanClientText(s.name)} (x${s.quantity})`).join(', ')}
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
                {currentOrder.statusHistory.map((hist, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-stone-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 flex-shrink-0" />
                    <span className="font-mono text-[11px] text-stone-400">
                      {new Date(hist.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
              className="px-6 py-3 rounded-2xl bg-stone-900 text-white font-bold text-xs sm:text-sm hover:bg-emerald-700 transition-colors shadow-sm"
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
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              Entrez votre code de suivi (ex: <code className="text-emerald-700 font-mono">tk_bebba_1047_demo</code>) ou passez une nouvelle commande pour la suivre en direct.
            </p>
          </div>
          <button
            onClick={() => setActiveClientTab('menu')}
            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-colors"
          >
            Découvrir le Menu
          </button>
        </div>
      )}

    </div>
  );
};
