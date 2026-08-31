import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Order, Driver } from '../../types';
import {
  Bike,
  Phone,
  MapPin,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  Navigation,
  Check,
  UserCheck,
  AlertCircle
} from 'lucide-react';

export const DriverView: React.FC = () => {
  const { orders, drivers, updateOrderStatus, showToast } = useApp();
  const [selectedDriverId, setSelectedDriverId] = useState<string>(drivers[0]?.id || 'drv_1');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const currentDriver = drivers.find(d => d.id === selectedDriverId) || drivers[0];

  // Orders relevant to drivers (Ready for pickup or currently being delivered)
  const availableOrders = orders.filter(o => o.status === 'ready');
  const ongoingDeliveries = orders.filter(o => o.status === 'delivering');
  const deliveredToday = orders.filter(o => o.status === 'delivered');

  const handleStartDelivery = async (order: Order) => {
    try {
      setUpdatingOrderId(order.id);
      const driverName = currentDriver ? currentDriver.name : 'Livreur BEBBA';
      await updateOrderStatus(
        order.id,
        'delivering',
        `Prise en charge par le livreur ${driverName}`,
        driverName,
        currentDriver?.id,
        driverName
      );
      showToast('Course acceptée', `La commande #${order.orderNumber} est en cours d'acheminement.`, 'info');
    } catch (err: any) {
      showToast('Erreur', err.message || 'Impossible de démarrer la livraison.', 'warning');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleCompleteDelivery = async (order: Order) => {
    try {
      setUpdatingOrderId(order.id);
      const driverName = currentDriver ? currentDriver.name : 'Livreur BEBBA';
      await updateOrderStatus(
        order.id,
        'delivered',
        `Livré au client avec encaissement en espèces de ${order.totalAmount.toFixed(1)} DT`,
        driverName,
        currentDriver?.id,
        driverName,
        'paid'
      );
      showToast('Livraison Confirmée !', `Commande #${order.orderNumber} livrée et ${order.totalAmount.toFixed(1)} DT encaissés.`, 'success');
    } catch (err: any) {
      showToast('Erreur', err.message || 'Impossible de valider la livraison.', 'warning');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 animate-in fade-in duration-300">
      
      {/* Driver Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 text-white p-6 rounded-3xl shadow-md border border-stone-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-md">
            <Bike className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold font-display">
                Espace Livreur
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-mono text-xs font-bold border border-blue-500/40">
                Paiement à la livraison
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Missions de livraison, itinéraires et encaissements en espèces.
            </p>
          </div>
        </div>

        {/* Driver Selector */}
        <div className="flex items-center gap-2 bg-stone-950 p-2 rounded-2xl border border-stone-800">
          <UserCheck className="w-4 h-4 text-blue-400 ml-2" />
          <span className="text-xs text-stone-400 font-medium">Livreur actif :</span>
          <select
            value={selectedDriverId}
            onChange={e => setSelectedDriverId(e.target.value)}
            className="bg-stone-900 text-white text-xs font-bold rounded-xl px-3 py-1.5 border border-stone-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {drivers.map(drv => (
              <option key={drv.id} value={drv.id}>
                {drv.name} ({drv.phone})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Driver Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Prêtes en cuisine</span>
            <div className="text-2xl font-extrabold text-stone-900 mt-1">{availableOrders.length}</div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">En cours de livraison</span>
            <div className="text-2xl font-extrabold text-blue-700 mt-1">{ongoingDeliveries.length}</div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
            <Bike className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Livrées aujourd'hui</span>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">{deliveredToday.length}</div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 1. Active Deliveries in Progress */}
      {ongoingDeliveries.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-ping" />
            <h2 className="text-lg font-extrabold text-stone-900">
              Livraisons en Cours ({ongoingDeliveries.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {ongoingDeliveries.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-3xl border-2 border-blue-500 shadow-lg p-6 space-y-5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider">
                      En route
                    </span>
                    <h3 className="text-xl font-extrabold text-stone-900 font-mono">
                      #{order.orderNumber}
                    </h3>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-right">
                    <span className="text-[10px] text-stone-500 block">À ENCAISSER EN ESPÈCES</span>
                    <span className="text-xl font-extrabold text-stone-900">
                      {order.totalAmount.toFixed(1)} DT
                    </span>
                  </div>
                </div>

                {/* Client Contact and Destination */}
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-stone-400">Client :</span>
                      <h4 className="font-bold text-sm text-stone-900">{order.client.name}</h4>
                    </div>
                    <a
                      href={`tel:${order.client.phone}`}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{order.client.phone}</span>
                    </a>
                  </div>

                  <div className="pt-1 flex items-start gap-2 text-xs text-stone-700">
                    <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span>{order.client.deliveryAddress}</span>
                  </div>

                  {order.client.notes && (
                    <div className="text-xs text-amber-800 bg-amber-50/80 p-2 rounded-xl border border-amber-200/60 italic">
                      Note client : « {order.client.notes} »
                    </div>
                  )}
                </div>

                {/* Items preview */}
                <div className="text-xs text-stone-600 space-y-1">
                  <span className="font-bold text-stone-800">Contenu sac isotherme :</span>
                  <p className="text-stone-600">
                    {order.items.map(i => `${i.productName} (x${i.quantity})`).join(' • ')}
                  </p>
                </div>

                {/* Complete Button */}
                <button
                  onClick={() => handleCompleteDelivery(order)}
                  disabled={updatingOrderId === order.id}
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Banknote className="w-5 h-5" />
                  <span>Commande Livrée &amp; {order.totalAmount.toFixed(1)} DT Encaissés</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Available Orders Ready for Pickup */}
      <div className="space-y-4">
        <h2 className="text-lg font-extrabold text-stone-900">
          Commandes Prêtes à Récupérer en Cuisine ({availableOrders.length})
        </h2>

        {availableOrders.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-stone-200 text-center text-stone-500 text-xs">
            Aucune nouvelle commande prête en cuisine pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableOrders.map(order => (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-stone-200 p-5 space-y-4 flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between pb-2 border-b border-stone-100">
                    <div>
                      <span className="font-mono text-base font-extrabold text-stone-900">
                        #{order.orderNumber}
                      </span>
                      <h4 className="text-xs font-bold text-stone-700 mt-0.5">{order.client.name}</h4>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-700">
                      {order.totalAmount.toFixed(1)} DT
                    </span>
                  </div>

                  <div className="pt-3 space-y-2 text-xs text-stone-600">
                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{order.client.deliveryAddress}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-stone-500">
                      <Phone className="w-3.5 h-3.5 text-stone-400" />
                      <span>{order.client.phone}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleStartDelivery(order)}
                  disabled={updatingOrderId === order.id}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <Bike className="w-4 h-4" />
                  <span>Prendre en charge la livraison</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
