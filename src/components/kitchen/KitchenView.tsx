import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, OrderStatus } from '../../types';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Flame,
  Utensils,
  PackageCheck,
  Filter,
  Check,
  RefreshCw,
  Sparkles,
  Info,
  Phone,
  MapPin,
  User
} from 'lucide-react';

export const KitchenView: React.FC = () => {
  const { orders, updateOrderStatus, refreshAllData, showToast } = useApp();
  const [kitchenFilter, setKitchenFilter] = useState<'active' | 'all' | 'ready'>('active');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Filter orders for kitchen
  const kitchenOrders = orders.filter(o => {
    if (kitchenFilter === 'active') {
      return o.status === 'received' || o.status === 'preparing';
    }
    if (kitchenFilter === 'ready') {
      return o.status === 'ready';
    }
    return o.status !== 'cancelled';
  });

  const handleStartPrep = async (orderId: string, orderNumber: string) => {
    try {
      setUpdatingOrderId(orderId);
      await updateOrderStatus(orderId, 'preparing', 'Prise en charge par le Chef de cuisine', 'Chef Cuisine BEBBA');
      showToast('Cuisine : En Préparation', `La commande #${orderNumber} est passée en cuisson minute.`, 'info');
    } catch (err: any) {
      showToast('Erreur', err.message || 'Impossible de mettre à jour le statut.', 'warning');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleMarkReady = async (orderId: string, orderNumber: string) => {
    try {
      setUpdatingOrderId(orderId);
      await updateOrderStatus(orderId, 'ready', 'Plats cuisinés et emballés en sac thermique', 'Chef Cuisine BEBBA');
      showToast('Cuisine : Commande Prête !', `La commande #${orderNumber} est prête pour la remise au livreur.`, 'success');
    } catch (err: any) {
      showToast('Erreur', err.message || 'Impossible de mettre à jour le statut.', 'warning');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Header with Title & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 text-white p-6 rounded-3xl shadow-md border border-stone-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
            <ChefHat className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold font-display">
                Écran Cuisine (KDS)
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/40">
                Préparation à la commande
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Fiches de pesées et cuissons minutes individuelles pour chaque client.
            </p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-2 bg-stone-950 p-1.5 rounded-2xl border border-stone-800">
          <button
            onClick={() => setKitchenFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              kitchenFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            En cours ({orders.filter(o => o.status === 'received' || o.status === 'preparing').length})
          </button>
          <button
            onClick={() => setKitchenFilter('ready')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              kitchenFilter === 'ready'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Prêtes ({orders.filter(o => o.status === 'ready').length})
          </button>
          <button
            onClick={() => setKitchenFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              kitchenFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Toutes ({orders.length})
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      {kitchenOrders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-stone-900">Aucune commande en attente</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Toutes les préparations en cuisine sont à jour. Les nouvelles commandes apparaîtront ici automatiquement dès validation client.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kitchenOrders.map(order => {
            const isReceived = order.status === 'received';
            const isPreparing = order.status === 'preparing';
            const isReady = order.status === 'ready';
            const isUpdating = updatingOrderId === order.id;

            const elapsedMinutes = Math.floor(
              (Date.now() - new Date(order.createdAt).getTime()) / (60 * 1000)
            );

            return (
              <div
                key={order.id}
                id={`kitchen-card-${order.id}`}
                className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col justify-between transition-all ${
                  isReceived
                    ? 'border-amber-400 ring-2 ring-amber-400/20'
                    : isPreparing
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-stone-200'
                }`}
              >
                {/* Ticket Top Header */}
                <div
                  className={`p-4 flex items-center justify-between text-white ${
                    isReceived
                      ? 'bg-amber-600'
                      : isPreparing
                      ? 'bg-emerald-700'
                      : isReady
                      ? 'bg-purple-700'
                      : 'bg-stone-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-black tracking-wide">
                        #{order.orderNumber}
                      </span>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-black/25">
                        {isReceived ? 'Nouveau' : isPreparing ? 'En Cuisson' : order.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-white/90 font-medium">
                      Client : <strong>{order.client.name}</strong> • <a href={`tel:${order.client.phone}`} className="underline font-mono text-emerald-200 hover:text-white">{order.client.phone}</a>
                    </div>
                  </div>

                  {/* Elapsed Timer Badge */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/30 text-white font-mono text-xs font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>+{elapsedMinutes} min</span>
                  </div>
                </div>

                {/* Packaging & Delivery Destination Bar */}
                <div className="bg-stone-100 px-4 py-2.5 border-b border-stone-200 text-xs text-stone-700 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-stone-900">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="line-clamp-1">{order.client.deliveryAddress}</span>
                    </div>
                    <a
                      href={`tel:${order.client.phone}`}
                      className="px-2 py-0.5 rounded-md bg-white border border-stone-300 font-mono text-[11px] font-bold text-emerald-800 hover:bg-stone-50 flex items-center gap-1 flex-shrink-0 shadow-2xs"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{order.client.phone}</span>
                    </a>
                  </div>
                </div>

                {/* Items & Preparation Sheets */}
                <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                  {order.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-stone-200/60 pb-2">
                        <div>
                          <h4 className="font-extrabold text-sm text-stone-900 leading-snug">
                            {item.productName}
                          </h4>
                          <span className="text-xs font-bold text-emerald-800">
                            Quantité : x{item.quantity}
                          </span>
                        </div>
                      </div>

                      {/* Exact Calculated Grams for Kitchen Scale */}
                      <div className="space-y-1 bg-white p-3 rounded-xl border border-stone-200">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500 block mb-1">
                          Pesée &amp; Ingrédients Cuisson :
                        </span>
                        {item.preparationSheet?.summaryLines ? (
                          item.preparationSheet.summaryLines.map((line, lIdx) => (
                            <div
                              key={lIdx}
                              className={`text-xs font-semibold ${
                                line.includes('NOTE CLIENT')
                                  ? 'text-rose-700 bg-rose-50 p-1.5 rounded font-bold'
                                  : 'text-stone-800'
                              }`}
                            >
                              {line}
                            </div>
                          ))
                        ) : (
                          <div className="text-xs text-stone-600">
                            Composition standard
                          </div>
                        )}
                      </div>

                      {/* Customization Details */}
                      {(item.proteinOption || item.veggiesOption || item.baseChoice || item.supplements.length > 0) && (
                        <div className="text-[11px] text-stone-600 space-y-0.5 pt-0.5">
                          {item.proteinOption && (
                            <p>• Protéine : <strong className="text-stone-900">{item.proteinOption.label}</strong></p>
                          )}
                          {item.baseChoice && (
                            <p>• Base : <strong className="text-stone-900">{item.baseChoice.label}</strong></p>
                          )}
                          {item.veggiesOption && (
                            <p>• Légumes : <strong className="text-stone-900">{item.veggiesOption.label}</strong></p>
                          )}
                          {item.supplements.length > 0 && (
                            <p className="text-emerald-800 font-bold">
                              • Suppléments : {item.supplements.map(s => `${s.name} (x${s.quantity})`).join(', ')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {order.client.notes && (
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-700 mt-0.5" />
                      <div>
                        <strong>Instructions de livraison client :</strong>
                        <p className="mt-0.5 italic text-stone-700">« {order.client.notes} »</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Kitchen Action Buttons */}
                <div className="p-4 bg-stone-50 border-t border-stone-200 flex gap-2">
                  {isReceived && (
                    <button
                      onClick={() => handleStartPrep(order.id, order.orderNumber)}
                      disabled={isUpdating}
                      className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Démarrer la Préparation</span>
                    </button>
                  )}

                  {isPreparing && (
                    <button
                      onClick={() => handleMarkReady(order.id, order.orderNumber)}
                      disabled={isUpdating}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                    >
                      <PackageCheck className="w-4 h-4" />
                      <span>Marquer comme Prête</span>
                    </button>
                  )}

                  {isReady && (
                    <div className="w-full py-2 px-3 rounded-xl bg-purple-100 text-purple-900 text-xs font-bold text-center flex items-center justify-center gap-2">
                      <Check className="w-4 h-4 text-purple-700" />
                      <span>Prête • En attente récupération livreur</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
