import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Category,
  Ingredient,
  Product,
  Supplement,
  Supplier,
  Driver,
  Order,
  StockMovement,
  DashboardStats,
  UserRole,
  OrderStatus
} from '../types';

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  proteinOption?: { label: string; extraPrice: number; extraGrams: number };
  veggiesOption?: { label: string; extraPrice: number; extraGrams: number };
  baseChoice?: { label: string; extraPrice: number };
  supplements: Array<{ id: string; quantity: number; supplement: Supplement }>;
  specialInstructions?: string;
  itemTotalPrice: number;
}

interface AppContextType {
  // Navigation & Role
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  activeClientTab: 'menu' | 'tracking';
  setActiveClientTab: (tab: 'menu' | 'tracking') => void;
  activeAdminTab: 'dashboard' | 'orders' | 'products' | 'supplements' | 'stock' | 'drivers' | 'suppliers';
  setActiveAdminTab: (tab: 'dashboard' | 'orders' | 'products' | 'supplements' | 'stock' | 'drivers' | 'suppliers') => void;

  // Data Collections
  categories: Category[];
  products: Product[];
  supplements: Supplement[];
  ingredients: Ingredient[];
  stockMovements: StockMovement[];
  drivers: Driver[];
  suppliers: Supplier[];
  orders: Order[];
  stats: DashboardStats | null;
  isLoading: boolean;

  // Cart
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  removeFromCart: (id: string) => void;
  updateCartQuantity: (id: string, qty: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;

  // Active Selected Product for customization modal
  selectedProductForCustomization: Product | null;
  setSelectedProductForCustomization: (p: Product | null) => void;

  // Tracking
  activeTrackingToken: string | null;
  setActiveTrackingToken: (token: string | null) => void;
  activeTrackingOrder: Order | null;

  // Actions
  refreshAllData: () => Promise<void>;
  createOrder: (payload: {
    client: { name: string; phone: string; deliveryAddress: string; notes?: string };
  }) => Promise<Order>;
  updateOrderStatus: (orderId: string, status: OrderStatus, note?: string, updatedBy?: string, assignedDriverId?: string) => Promise<Order>;
  adjustStock: (ingredientId: string, type: StockMovement['type'], quantity: number, notes: string) => Promise<void>;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  saveSupplement: (sup: Supplement) => Promise<void>;
  deleteSupplement: (id: string) => Promise<void>;
  saveIngredient: (ing: Ingredient) => Promise<void>;
  deleteIngredient: (id: string) => Promise<void>;
  saveDriver: (driver: Driver) => Promise<void>;
  saveSupplier: (sup: Supplier) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  resetDemoData: () => Promise<void>;

  // Push Notifications Simulation
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  toastMessage: { title: string; body: string; type?: 'info' | 'success' | 'warning' } | null;
  clearToast: () => void;
  showToast: (title: string, body: string, type?: 'info' | 'success' | 'warning') => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>('client');
  const [activeClientTab, setActiveClientTab] = useState<'menu' | 'tracking'>('menu');
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'orders' | 'products' | 'supplements' | 'stock' | 'drivers' | 'suppliers'>('dashboard');

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<Product | null>(null);

  // Active tracking
  const [activeTrackingToken, setActiveTrackingToken] = useState<string | null>(() => {
    return localStorage.getItem('bebba_last_tracking_token') || 'tk_bebba_1047_demo';
  });

  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('bebba_notifications') === 'true';
  });
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string; type?: 'info' | 'success' | 'warning' } | null>(null);

  const showToast = useCallback((title: string, body: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage({ title, body, type });
    // If native Notification API is supported and granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && notificationsEnabled) {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico'
        });
      } catch (e) {
        // ignore notification constructor failure in some iframe sandbox
      }
    }
  }, [notificationsEnabled]);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const refreshAllData = useCallback(async () => {
    try {
      const [
        catsRes,
        prodsRes,
        supsRes,
        ingsRes,
        movsRes,
        drvsRes,
        suppsRes,
        ordsRes,
        statsRes
      ] = await Promise.all([
        fetch('/api/categories').then(r => r.json()),
        fetch('/api/products').then(r => r.json()),
        fetch('/api/supplements').then(r => r.json()),
        fetch('/api/ingredients').then(r => r.json()),
        fetch('/api/stock-movements').then(r => r.json()),
        fetch('/api/drivers').then(r => r.json()),
        fetch('/api/suppliers').then(r => r.json()),
        fetch('/api/orders').then(r => r.json()),
        fetch('/api/stats').then(r => r.json())
      ]);

      setCategories(catsRes || []);
      setProducts(prodsRes || []);
      setSupplements(supsRes || []);
      setIngredients(ingsRes || []);
      setStockMovements(movsRes || []);
      setDrivers(drvsRes || []);
      setSuppliers(suppsRes || []);
      setOrders(ordsRes || []);
      setStats(statsRes || null);
    } catch (err) {
      console.error('Failed to fetch data from API:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
    // Live polling every 5s so Kitchen, Driver, and Client stay synced in real time
    const interval = setInterval(refreshAllData, 5000);
    return () => clearInterval(interval);
  }, [refreshAllData]);

  // Persist tracking token
  useEffect(() => {
    if (activeTrackingToken) {
      localStorage.setItem('bebba_last_tracking_token', activeTrackingToken);
    }
  }, [activeTrackingToken]);

  // Persist notifications setting
  useEffect(() => {
    localStorage.setItem('bebba_notifications', notificationsEnabled ? 'true' : 'false');
  }, [notificationsEnabled]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // Cart operations
  const addToCart = useCallback((item: Omit<CartItem, 'id'>) => {
    const id = 'cart-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    setCart(prev => [...prev, { ...item, id }]);
    setIsCartOpen(true);
    showToast('Ajouté au panier !', `${item.product.name} (x${item.quantity})`, 'success');
  }, [showToast]);

  const removeFromCart = useCallback((id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateCartQuantity = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart(prev =>
      prev.map(item => {
        if (item.id === id) {
          const singleItemPrice = item.itemTotalPrice / item.quantity;
          return {
            ...item,
            quantity: qty,
            itemTotalPrice: Math.round(singleItemPrice * qty * 10) / 10
          };
        }
        return item;
      })
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartTotal = cart.reduce((sum, item) => sum + item.itemTotalPrice, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Active tracking order derived from orders list or token
  const activeTrackingOrder = orders.find(o => o.trackingToken === activeTrackingToken) || null;

  // Order actions
  const createOrder = async (payload: {
    client: { name: string; phone: string; deliveryAddress: string; notes?: string };
  }): Promise<Order> => {
    const orderItemsPayload = cart.map(item => ({
      productId: item.product.id,
      quantity: item.quantity,
      proteinOption: item.proteinOption,
      veggiesOption: item.veggiesOption,
      baseChoice: item.baseChoice,
      supplements: item.supplements.map(s => ({ id: s.id, quantity: s.quantity })),
      specialInstructions: item.specialInstructions
    }));

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client: payload.client,
        items: orderItemsPayload
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Erreur lors de la création de la commande');
    }

    const createdOrder: Order = await response.json();
    clearCart();
    setIsCartOpen(false);
    setActiveTrackingToken(createdOrder.trackingToken);
    setActiveClientTab('tracking');

    showToast(
      'Commande enregistrée !',
      `Votre commande #${createdOrder.orderNumber} est transmise à la cuisine. Montant à la livraison: ${createdOrder.totalAmount} DT`,
      'success'
    );

    await refreshAllData();
    return createdOrder;
  };

  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    note?: string,
    updatedBy?: string,
    assignedDriverId?: string
  ): Promise<Order> => {
    const response = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note, updatedBy, assignedDriverId })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Erreur mise à jour statut');
    }

    const updated: Order = await response.json();

    // Trigger user notification if tracking this order
    if (updated.trackingToken === activeTrackingToken) {
      const statusMsgs: Record<OrderStatus, string> = {
        received: 'Commande confirmée et enregistrée.',
        preparing: 'Votre commande est maintenant en préparation en cuisine.',
        ready: 'Votre commande est prête et sera bientôt remise au livreur.',
        delivering: 'Votre commande est en route avec le livreur.',
        delivered: 'Votre commande a été livrée. Bon appétit !',
        cancelled: 'Votre commande a été annulée.'
      };
      showToast(`Statut commande #${updated.orderNumber}`, statusMsgs[status] || status, 'info');
    }

    await refreshAllData();
    return updated;
  };

  const adjustStock = async (
    ingredientId: string,
    type: StockMovement['type'],
    quantity: number,
    notes: string
  ) => {
    const res = await fetch(`/api/ingredients/${ingredientId}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, quantity, notes, performedBy: currentRole === 'admin' ? 'Administrateur' : 'Gestionnaire' })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur ajustement de stock');
    }
    await refreshAllData();
  };

  const saveProduct = async (product: Product) => {
    const url = product.id && products.some(p => p.id === product.id)
      ? `/api/products/${product.id}`
      : '/api/products';
    const method = product.id && products.some(p => p.id === product.id) ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) throw new Error('Erreur enregistrement produit');
    await refreshAllData();
  };

  const deleteProduct = async (id: string) => {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression produit');
    await refreshAllData();
  };

  const saveCategory = async (category: Category) => {
    const url = category.id && categories.some(c => c.id === category.id)
      ? `/api/categories/${category.id}`
      : '/api/categories';
    const method = category.id && categories.some(c => c.id === category.id) ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category)
    });
    if (!res.ok) throw new Error('Erreur enregistrement catégorie');
    await refreshAllData();
  };

  const deleteCategory = async (id: string) => {
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression catégorie');
    await refreshAllData();
  };

  const saveSupplement = async (sup: Supplement) => {
    const url = sup.id && supplements.some(s => s.id === sup.id)
      ? `/api/supplements/${sup.id}`
      : '/api/supplements';
    const method = sup.id && supplements.some(s => s.id === sup.id) ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sup)
    });
    if (!res.ok) throw new Error('Erreur enregistrement supplément');
    await refreshAllData();
  };

  const deleteSupplement = async (id: string) => {
    const res = await fetch(`/api/supplements/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression supplément');
    await refreshAllData();
  };

  const saveIngredient = async (ing: Ingredient) => {
    const url = ing.id && ingredients.some(i => i.id === ing.id)
      ? `/api/ingredients/${ing.id}`
      : '/api/ingredients';
    const method = ing.id && ingredients.some(i => i.id === ing.id) ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ing)
    });
    if (!res.ok) throw new Error('Erreur enregistrement matière première');
    await refreshAllData();
  };

  const deleteIngredient = async (id: string) => {
    const res = await fetch(`/api/ingredients/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression matière première');
    await refreshAllData();
  };

  const saveDriver = async (driver: Driver) => {
    const url = driver.id && drivers.some(d => d.id === driver.id)
      ? `/api/drivers/${driver.id}`
      : '/api/drivers';
    const method = driver.id && drivers.some(d => d.id === driver.id) ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(driver)
    });
    if (!res.ok) throw new Error('Erreur enregistrement livreur');
    await refreshAllData();
  };

  const saveSupplier = async (sup: Supplier) => {
    const url = sup.id && suppliers.some(s => s.id === sup.id)
      ? `/api/suppliers/${sup.id}`
      : '/api/suppliers';
    const method = sup.id && suppliers.some(s => s.id === sup.id) ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sup)
    });
    if (!res.ok) throw new Error('Erreur enregistrement fournisseur');
    await refreshAllData();
  };

  const deleteSupplier = async (id: string) => {
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression fournisseur');
    await refreshAllData();
  };

  const resetDemoData = async () => {
    const res = await fetch('/api/reset-demo-data', { method: 'POST' });
    if (!res.ok) throw new Error('Erreur réinitialisation données');
    await refreshAllData();
    showToast('Données réinitialisées', 'Toutes les données de démo ont été restaurées.', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        activeClientTab,
        setActiveClientTab,
        activeAdminTab,
        setActiveAdminTab,
        categories,
        products,
        supplements,
        ingredients,
        stockMovements,
        drivers,
        suppliers,
        orders,
        stats,
        isLoading,
        cart,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartTotal,
        cartCount,
        isCartOpen,
        setIsCartOpen,
        selectedProductForCustomization,
        setSelectedProductForCustomization,
        activeTrackingToken,
        setActiveTrackingToken,
        activeTrackingOrder,
        refreshAllData,
        createOrder,
        updateOrderStatus,
        adjustStock,
        saveProduct,
        deleteProduct,
        saveCategory,
        deleteCategory,
        saveSupplement,
        deleteSupplement,
        saveIngredient,
        deleteIngredient,
        saveDriver,
        saveSupplier,
        deleteSupplier,
        resetDemoData,
        notificationsEnabled,
        setNotificationsEnabled,
        toastMessage,
        clearToast,
        showToast
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
