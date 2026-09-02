import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, Ingredient, Order, OrderStatus } from '../../types';
import { CatalogManager } from './CatalogManager';
import {
  ShieldCheck,
  TrendingUp,
  Package,
  AlertTriangle,
  Banknote,
  Clock,
  Layers,
  Search,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  Eye,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
  Filter,
  DollarSign,
  Phone,
  MapPin
} from 'lucide-react';

export const AdminView: React.FC = () => {
  const {
    products,
    ingredients,
    orders,
    drivers,
    supplements,
    adjustStock,
    saveProduct,
    updateOrderStatus,
    showToast,
    resetDemoData
  } = useApp();

  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'orders' | 'stock' | 'catalog'>('dashboard');
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [restockAmount, setRestockAmount] = useState<Record<string, number>>({});
  const [isRestocking, setIsRestocking] = useState<string | null>(null);

  // Compute key metrics
  const totalRevenue = useMemo(() => {
    return (orders || [])
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  const collectedCash = useMemo(() => {
    return (orders || [])
      .filter(o => o.paymentStatus === 'paid')
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  const pendingCash = useMemo(() => {
    return (orders || [])
      .filter(o => o.paymentStatus === 'pending' && o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);
  }, [orders]);

  const lowStockIngredients = useMemo(() => {
    return (ingredients || []).filter(i => i.currentStock <= i.minimumAlertStock);
  }, [ingredients]);

  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string; count: number; revenue: number }> = {};
    (orders || []).forEach(o => {
      if (o.status === 'cancelled') return;
      (o.items || []).forEach(item => {
        if (!counts[item.productId]) {
          counts[item.productId] = { name: item.productName, count: 0, revenue: 0 };
        }
        counts[item.productId].count += item.quantity;
        counts[item.productId].revenue += item.itemTotalPrice;
      });
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [orders]);

  // Handle restock
  const handleRestock = async (ing: Ingredient) => {
    const qty = restockAmount[ing.id];
    if (!qty || qty <= 0) return;
    try {
      setIsRestocking(ing.id);
      await adjustStock(ing.id, 'restock', Number(qty), 'Réapprovisionnement manuel cuisine');
      setRestockAmount(prev => ({ ...prev, [ing.id]: 0 }));
      showToast('Stock réapprovisionné', `+${qty} ${ing.unit} ajoutés à "${ing.name}".`, 'success');
    } catch (err: any) {
      showToast('Erreur', err.message || 'Erreur lors du réapprovisionnement.', 'warning');
    } finally {
      setIsRestocking(null);
    }
  };

  const toggleProductActive = async (product: Product) => {
    try {
      await saveProduct({ ...product, active: !product.active });
      showToast(
        product.active ? 'Produit masqué' : 'Produit activé',
        `Le plat "${product.name}" a été mis à jour sur le menu client.`,
        'info'
      );
    } catch (err: any) {
      showToast('Erreur', err.message, 'warning');
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchesSearch =
        orderSearch.trim() === '' ||
        o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.client.name.toLowerCase().includes(orderSearch.toLowerCase()) ||
        o.client.phone.includes(orderSearch);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, orderSearch]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* Admin Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-stone-900 text-white p-4 sm:p-6 rounded-3xl shadow-md border border-stone-800">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-700 flex items-center justify-center text-white shadow-md">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold font-display">
                Direction &amp; Administration
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/40">
                Backoffice
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Pilotage des ventes, gestion des stocks en direct et suivi des encaissements.
            </p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex flex-wrap items-center gap-1 bg-stone-950 p-1.5 rounded-2xl border border-stone-800 w-full md:w-auto">
          <button
            onClick={() => setActiveAdminTab('dashboard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeAdminTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveAdminTab('orders')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeAdminTab === 'orders'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Commandes ({orders.length})
          </button>
          <button
            onClick={() => setActiveAdminTab('stock')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeAdminTab === 'stock'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <span>Stock Ingrédients</span>
            {lowStockIngredients.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-stone-950 text-[10px] font-extrabold">
                {lowStockIngredients.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveAdminTab('catalog')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeAdminTab === 'catalog'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            Catalogue ({products.length})
          </button>
        </div>
      </div>

      {/* 1. DASHBOARD TAB */}
      {activeAdminTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Chiffre d'Affaires</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-display">
                {totalRevenue.toFixed(1)} <span className="text-sm font-semibold text-stone-500">DT</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                <span>Total des commandes actives</span>
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Espèces Encaissées</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-display">
                {collectedCash.toFixed(1)} <span className="text-sm font-semibold text-emerald-900">DT</span>
              </div>
              <p className="text-[11px] text-stone-500">
                Livrées et collectées par les livreurs
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">En Cours de Livraison</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-display">
                {pendingCash.toFixed(1)} <span className="text-sm font-semibold text-amber-900">DT</span>
              </div>
              <p className="text-[11px] text-stone-500">
                Paiements en attente de collecte
              </p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-stone-200 shadow-xs space-y-1">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500">Alertes Ruptures Stock</span>
              <div className={`text-2xl sm:text-3xl font-extrabold font-display ${lowStockIngredients.length > 0 ? 'text-rose-600' : 'text-stone-900'}`}>
                {lowStockIngredients.length}
              </div>
              <p className="text-[11px] text-stone-500">
                {lowStockIngredients.length > 0 ? 'Ingrédients sous le seuil d’alerte' : 'Tous les stocks sont optimaux'}
              </p>
            </div>
          </div>

          {/* Low Stock Warning Banner if any */}
          {lowStockIngredients.length > 0 && (
            <div className="p-5 rounded-3xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-700" />
                <span>Alertes de Réapprovisionnement Cuisine Immédiat ({lowStockIngredients.length}) :</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {lowStockIngredients.map(ing => (
                  <div key={ing.id} className="p-3 bg-white rounded-2xl border border-amber-200 shadow-2xs flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-stone-900">{ing.name}</h4>
                      <p className="text-[11px] text-rose-600 font-bold">
                        Reste : {ing.currentStock} {ing.unit} (Seuil : {ing.minimumAlertStock})
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveAdminTab('stock')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700"
                    >
                      Réapprovisionner
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Selling Products & Active Status Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Products */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <h3 className="font-bold text-base text-stone-900 font-display flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>Plats les Plus Vendus</span>
              </h3>

              <div className="divide-y divide-stone-100">
                {topProducts.map((p, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-700 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900">{p.name}</h4>
                        <span className="text-xs text-stone-500">{p.count} portions cuisinées</span>
                      </div>
                    </div>
                    <span className="font-extrabold text-sm text-emerald-700">
                      {p.revenue.toFixed(1)} DT
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Drivers & Status summary */}
            <div className="bg-white p-6 rounded-3xl border border-stone-200 shadow-xs space-y-4">
              <h3 className="font-bold text-base text-stone-900 font-display flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span>Flotte de Livraison BEBBA</span>
              </h3>

              <div className="space-y-3">
                {drivers.map(drv => {
                  const driverDeliveredCount = orders.filter(o => o.assignedDriverId === drv.id && o.status === 'delivered').length;
                  const driverActiveCount = orders.filter(o => o.assignedDriverId === drv.id && o.status === 'delivering').length;

                  return (
                    <div key={drv.id} className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm text-stone-900">{drv.name}</h4>
                        <p className="text-xs text-stone-500">{drv.phone} • {drv.vehicleType}</p>
                      </div>
                      <div className="text-right text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-bold">
                          {driverActiveCount} en cours
                        </span>
                        <div className="text-[11px] text-stone-500 mt-1">
                          {driverDeliveredCount} livraisons complétées
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* 2. ORDERS MANAGEMENT TAB */}
      {activeAdminTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-stone-900 font-display">Toutes les Commandes ({filteredOrders.length})</h2>
              <p className="text-xs text-stone-500">Supervision en direct et changement de statut d'urgence.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder="Recherche n° ou client..."
                  className="w-48 px-3 py-2 pl-8 rounded-xl border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-3" />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Tous statuts</option>
                <option value="received">Reçue</option>
                <option value="preparing">En préparation</option>
                <option value="ready">Prête</option>
                <option value="delivering">En livraison</option>
                <option value="delivered">Livrée</option>
                <option value="cancelled">Annulée</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3.5 rounded-l-xl">N° Commande</th>
                  <th className="p-3.5">Client &amp; Contact</th>
                  <th className="p-3.5">Articles &amp; Cuisson</th>
                  <th className="p-3.5">Montant</th>
                  <th className="p-3.5">Statut Actuel</th>
                  <th className="p-3.5 rounded-r-xl">Action Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-stone-900">
                      #{order.orderNumber}
                      <span className="block text-[10px] font-sans font-normal text-stone-400">
                        {new Date(order.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-stone-900">{order.client.name}</div>
                      <a
                        href={`tel:${order.client.phone}`}
                        className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 hover:text-emerald-900 text-[11px] my-0.5"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{order.client.phone}</span>
                      </a>
                      <div className="text-[11px] text-stone-600 flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-stone-400 flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{order.client.deliveryAddress}</span>
                      </div>
                      {order.client.notes && (
                        <div className="text-[10px] text-amber-700 italic mt-0.5">
                          Note: « {order.client.notes} »
                        </div>
                      )}
                    </td>
                    <td className="p-3.5">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="line-clamp-1">
                          • {it.productName} (x{it.quantity})
                        </div>
                      ))}
                    </td>
                    <td className="p-3.5">
                      <span className="font-extrabold text-emerald-700">{order.totalAmount.toFixed(1)} DT</span>
                      <span className={`block text-[10px] font-bold ${order.paymentStatus === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {order.paymentStatus === 'paid' ? 'Encaissé' : 'À encaisser'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-block ${
                        order.status === 'delivered'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'delivering'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'ready'
                          ? 'bg-purple-100 text-purple-800'
                          : order.status === 'preparing'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-stone-100 text-stone-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <select
                        value={order.status}
                        onChange={e => updateOrderStatus(order.id, e.target.value as OrderStatus, 'Modification manuelle administrateur', 'Admin BEBBA')}
                        className="px-2.5 py-1.5 rounded-lg border border-stone-300 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 bg-white"
                      >
                        <option value="received">Reçue</option>
                        <option value="preparing">En préparation</option>
                        <option value="ready">Prête</option>
                        <option value="delivering">En livraison</option>
                        <option value="delivered">Livrée (Payée)</option>
                        <option value="cancelled">Annulée</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. STOCK & INGREDIENTS TAB */}
      {activeAdminTab === 'stock' && (
        <div className="bg-white rounded-3xl border border-stone-200 p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-stone-900 font-display">
                Gestion des Ingrédients &amp; Stock Cuisine
              </h2>
              <p className="text-xs text-stone-500">
                Déduction automatique à chaque commande passée selon les recettes et suppléments.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-100 text-stone-700 uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Ingrédient</th>
                  <th className="p-3.5">Catégorie</th>
                  <th className="p-3.5">Stock Actuel</th>
                  <th className="p-3.5">Seuil Alerte</th>
                  <th className="p-3.5">Coût unitaire</th>
                  <th className="p-3.5 rounded-r-xl">Réapprovisionner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {ingredients.map(ing => {
                  const isLow = ing.currentStock <= ing.minimumAlertStock;
                  const isCritical = ing.currentStock <= 0;

                  return (
                    <tr key={ing.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-stone-900">
                        {ing.name}
                        {isCritical ? (
                          <span className="ml-2 px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold">
                            RUPTURE
                          </span>
                        ) : isLow ? (
                          <span className="ml-2 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                            STOCK BAS
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3.5 text-stone-600 capitalize">{ing.category}</td>
                      <td className="p-3.5 font-mono font-bold text-sm">
                        <span className={isCritical ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-emerald-700'}>
                          {ing.currentStock} {ing.unit}
                        </span>
                      </td>
                      <td className="p-3.5 text-stone-500 font-mono">
                        {ing.minimumAlertStock} {ing.unit}
                      </td>
                      <td className="p-3.5 text-stone-600">
                        {ing.costPerUnit.toFixed(3)} DT / {ing.unit}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            placeholder={`Qté (${ing.unit})`}
                            value={restockAmount[ing.id] || ''}
                            onChange={e => setRestockAmount({ ...restockAmount, [ing.id]: Number(e.target.value) })}
                            className="w-24 px-2.5 py-1 rounded-lg border border-stone-300 text-xs focus:ring-2 focus:ring-emerald-500"
                          />
                          <button
                            onClick={() => handleRestock(ing)}
                            disabled={isRestocking === ing.id || !restockAmount[ing.id]}
                            className="px-3 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs disabled:opacity-40 transition-colors"
                          >
                            + Ajouter
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CATALOG MANAGEMENT TAB */}
      {activeAdminTab === 'catalog' && (
        <CatalogManager />
      )}

    </div>
  );
};
