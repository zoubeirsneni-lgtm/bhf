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
  OrderStatus,
  SafeUser
} from '../types';
import {
  initialCategories,
  initialSuppliers,
  initialIngredients,
  initialSupplements,
  initialProducts,
  initialDrivers,
  initialOrders,
  initialStockMovements,
  initialStats
} from '../data/initialData';

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
  // Authentication & Session
  isAuthenticated: boolean;
  authLoading: boolean;
  currentUser: SafeUser | null;
  token: string | null;
  authError: string | null;
  clearAuthError: () => void;
  login: (username: string, password: string) => Promise<SafeUser>;
  logout: () => Promise<void>;

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

  // Detailed Product View Navigation
  selectedProductId: string | null;
  setSelectedProductId: (id: string | null) => void;
  openProductDetail: (id: string) => void;
  backToMenu: () => void;

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
  assignDriverToOrder: (orderId: string, driverId: string) => Promise<Order>;
  confirmOrderPayment: (orderId: string) => Promise<Order>;
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

// Safe fetch helper to prevent HTML parsing errors when server is reloading and enforce JWT auth
async function safeFetchJson<T>(
  url: string,
  fallback: T,
  authToken?: string | null,
  onAuthError?: () => void
): Promise<T> {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json'
    };

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(url, { headers });

    // Handle 401: unauthorized / token expired / missing token on protected route
    if (res.status === 401) {
      if (onAuthError) {
        onAuthError();
      }
      // IMPORTANT: Une erreur d'authentification ne doit plus être masquée par un fallback silencieux vers initialData pour les routes protégées.
      throw new Error(`Accès non autorisé (401) sur ${url}`);
    }

    // Handle 403: forbidden (e.g. kitchen or driver attempting admin route)
    if (res.status === 403) {
      throw new Error(`Accès interdit (403) sur ${url}`);
    }

    if (!res.ok) {
      return fallback;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return fallback;
    }

    const data = await res.json();
    return data !== undefined && data !== null ? data : fallback;
  } catch (err: any) {
    if (err.message && (err.message.includes('401') || err.message.includes('403'))) {
      throw err;
    }
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Authentication & Session State
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('bebba_auth_token');
    }
    return null;
  });
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return !!localStorage.getItem('bebba_auth_token');
    }
    return false;
  });
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const [currentRole, setCurrentRole] = useState<UserRole>('client');
  const [activeClientTab, setActiveClientTab] = useState<'menu' | 'tracking'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('token')) {
        return 'tracking';
      }
    }
    return 'menu';
  });
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'orders' | 'products' | 'supplements' | 'stock' | 'drivers' | 'suppliers'>('dashboard');

  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [supplements, setSupplements] = useState<Supplement[]>(initialSupplements);
  // Protected collections are initialized empty for security (no silent mock data leakage)
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<Product | null>(null);

  // Detailed Product View Navigation
  const [selectedProductId, setSelectedProductId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/menu/')) {
        const id = path.replace('/menu/', '').trim();
        return id || null;
      }
      if (window.location.hash.startsWith('#/menu/')) {
        return window.location.hash.replace('#/menu/', '').trim() || null;
      }
    }
    return null;
  });

  const openProductDetail = useCallback((id: string) => {
    setSelectedProductId(id);
    setActiveClientTab('menu');
    try {
      window.history.pushState({ productId: id }, '', `/menu/${id}`);
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const backToMenu = useCallback(() => {
    setSelectedProductId(null);
    try {
      window.history.pushState({}, '', '/');
    } catch (e) {}
  }, []);

  // Listen to browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/menu/')) {
        const id = path.replace('/menu/', '').trim();
        setSelectedProductId(id || null);
        setActiveClientTab('menu');
      } else {
        setSelectedProductId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Active tracking
  const [activeTrackingToken, setActiveTrackingToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken && urlToken.trim()) return urlToken.trim();
    }
    return localStorage.getItem('bebba_last_tracking_token') || 'tk_bebba_1047_demo';
  });

  // Sync token from URL if opened or changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken && urlToken.trim()) {
        setActiveTrackingToken(urlToken.trim());
        setActiveClientTab('tracking');
        setCurrentRole('client');
      }
    }
  }, []);

  // Notifications
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('bebba_notifications') === 'true';
  });
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string; type?: 'info' | 'success' | 'warning' } | null>(null);

  const showToast = useCallback((title: string, body: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToastMessage({ title, body, type });
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && notificationsEnabled) {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico'
        });
      } catch (e) {}
    }
  }, [notificationsEnabled]);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // Handle 401 Session Expiry
  const handleSessionExpired = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('bebba_auth_token');
    }
    setToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthError('Votre session a expiré ou est non autorisée. Veuillez vous reconnecter.');
    // Clear protected collections
    setOrders([]);
    setIngredients([]);
    setStockMovements([]);
    setDrivers([]);
    setSuppliers([]);
    setStats(null);
  }, []);

  // Restore session from token on mount / reload (F5)
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('bebba_auth_token') : null;
      if (!storedToken) {
        setAuthLoading(false);
        setIsAuthenticated(false);
        setCurrentUser(null);
        return;
      }

      setAuthLoading(true);
      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`,
            Accept: 'application/json'
          }
        });

        if (res.status === 401 || !res.ok) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('bebba_auth_token');
          }
          setToken(null);
          setCurrentUser(null);
          setIsAuthenticated(false);
          setAuthError('Votre session a expiré. Veuillez vous reconnecter.');
          return;
        }

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          setAuthLoading(false);
          return;
        }

        const data = await res.json();
        if (data?.user) {
          setToken(storedToken);
          setCurrentUser(data.user);
          setIsAuthenticated(true);
          setAuthError(null);

          // Si un token public de suivi est présent dans l'URL, l'affichage CLIENT/TRACKING a priorité absolue
          const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const hasUrlToken = Boolean(urlParams?.get('token')?.trim());

          if (hasUrlToken) {
            setCurrentRole('client');
            setActiveClientTab('tracking');
          } else {
            setCurrentRole(data.user.role);
          }
        } else {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('bebba_auth_token');
          }
          setToken(null);
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        // Network failure
        setAuthError('Serveur inaccessible lors de la vérification de session.');
      } finally {
        setAuthLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Authenticated fetch wrapper for data mutations
  const authFetch = useCallback(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(input, {
      ...init,
      headers
    });

    if (response.status === 401) {
      handleSessionExpired();
      throw new Error('Session expirée ou non autorisée (401).');
    }

    return response;
  }, [token, handleSessionExpired]);

  // Login handler
  const login = async (username: string, password: string): Promise<SafeUser> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ username: username.trim(), password })
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('Identifiants invalides. Veuillez vérifier votre nom d’utilisateur et mot de passe.');
        }
        let errorMsg = 'Erreur lors de la connexion.';
        try {
          const errData = await res.json();
          if (errData?.error) errorMsg = errData.error;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (!data?.token || !data?.user) {
        throw new Error('Réponse d’authentification serveur invalide.');
      }

      const receivedToken: string = data.token;
      const safeUser: SafeUser = data.user;

      if (typeof window !== 'undefined') {
        localStorage.setItem('bebba_auth_token', receivedToken);
      }

      setToken(receivedToken);
      setCurrentUser(safeUser);
      setIsAuthenticated(true);
      setAuthError(null);
      setCurrentRole(safeUser.role);

      showToast('Connexion réussie', `Bienvenue ${safeUser.name} (${safeUser.role})`, 'success');

      return safeUser;
    } catch (err: any) {
      const message = err.message || 'Serveur inaccessible. Veuillez vérifier votre connexion.';
      setAuthError(message);
      throw err;
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout handler
  const logout = async (): Promise<void> => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        }).catch(() => {});
      }
    } catch (e) {
      // Ignore server logout response
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('bebba_auth_token');
      }
      setToken(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      setAuthError(null);

      // Clear protected collections
      setOrders([]);
      setIngredients([]);
      setStockMovements([]);
      setDrivers([]);
      setSuppliers([]);
      setStats(null);

      // Revert view to client
      setCurrentRole('client');
      showToast('Déconnexion', 'Vous avez été déconnecté de l’espace personnel.', 'info');
    }
  };

  // Refresh all data based on authentication status and verified role
  const refreshAllData = useCallback(async () => {
    try {
      // 1. Always fetch public catalog for client
      const [catsRes, prodsRes, supsRes] = await Promise.all([
        safeFetchJson<Category[]>('/api/categories', categories, token, handleSessionExpired),
        safeFetchJson<Product[]>('/api/products', products, token, handleSessionExpired),
        safeFetchJson<Supplement[]>('/api/supplements', supplements, token, handleSessionExpired)
      ]);

      if (Array.isArray(catsRes) && catsRes.length > 0) setCategories(catsRes);
      if (Array.isArray(prodsRes) && prodsRes.length > 0) setProducts(prodsRes);
      if (Array.isArray(supsRes) && supsRes.length > 0) setSupplements(supsRes);

      // 2. Fetch protected data ONLY if authenticated
      if (token && currentUser) {
        const userRole = currentUser.role;

        // Fetch orders if admin, kitchen, or driver
        if (userRole === 'admin' || userRole === 'kitchen' || userRole === 'driver') {
          try {
            const ordsRes = await safeFetchJson<Order[]>('/api/orders', [], token, handleSessionExpired);
            if (Array.isArray(ordsRes)) setOrders(ordsRes);
          } catch (e) {}
        }

        // Fetch ingredients and drivers if admin or kitchen
        if (userRole === 'admin' || userRole === 'kitchen') {
          try {
            const [ingsRes, drvsRes] = await Promise.all([
              safeFetchJson<Ingredient[]>('/api/ingredients', [], token, handleSessionExpired),
              safeFetchJson<Driver[]>('/api/drivers', [], token, handleSessionExpired)
            ]);
            if (Array.isArray(ingsRes)) setIngredients(ingsRes);
            if (Array.isArray(drvsRes)) setDrivers(drvsRes);
          } catch (e) {}
        }

        // Fetch admin-only resources if admin
        if (userRole === 'admin') {
          try {
            const [movsRes, suppsRes, statsRes] = await Promise.all([
              safeFetchJson<StockMovement[]>('/api/stock-movements', [], token, handleSessionExpired),
              safeFetchJson<Supplier[]>('/api/suppliers', [], token, handleSessionExpired),
              safeFetchJson<DashboardStats | null>('/api/stats', null, token, handleSessionExpired)
            ]);
            if (Array.isArray(movsRes)) setStockMovements(movsRes);
            if (Array.isArray(suppsRes)) setSuppliers(suppsRes);
            if (statsRes) setStats(statsRes);
          } catch (e) {}
        }
      }
    } catch (err) {
      // Graceful background sync error handling
    } finally {
      setIsLoading(false);
    }
  }, [categories, products, supplements, token, currentUser, handleSessionExpired]);

  useEffect(() => {
    refreshAllData();
    // Live polling every 5s
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

  // Order actions (Public / Client)
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
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        client: payload.client,
        items: orderItemsPayload
      })
    });

    if (!response.ok) {
      let errorMsg = 'Erreur lors de la création de la commande';
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
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

  // Protected operations requiring JWT
  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
    note?: string,
    updatedBy?: string,
    assignedDriverId?: string
  ): Promise<Order> => {
    const response = await authFetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, note, updatedBy, assignedDriverId })
    });

    if (!response.ok) {
      let errorMsg = 'Erreur mise à jour statut';
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const updated: Order = await response.json();

    // Trigger user notification if tracking this order
    if (updated.trackingToken === activeTrackingToken) {
      const statusMsgs: Record<OrderStatus, string> = {
        received: 'Commande confirmée et enregistrée.',
        preparing: 'Votre commande est maintenant en préparation en cuisine.',
        ready: 'Votre commande est prête et sera bientôt remise au livreur.',
        waiting_for_driver: 'Votre commande est prête et en attente d’attribution d’un livreur.',
        delivering: 'Votre commande est en route avec le livreur.',
        delivered: 'Votre commande a été livrée. Bon appétit !',
        cancelled: 'Votre commande a été annulée.'
      };
      showToast(`Statut commande #${updated.orderNumber}`, statusMsgs[status] || status, 'info');
    }

    await refreshAllData();
    return updated;
  };

  const assignDriverToOrder = async (
    orderId: string,
    driverId: string
  ): Promise<Order> => {
    const response = await authFetch(`/api/orders/${orderId}/assign-driver`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId })
    });

    if (!response.ok) {
      let errorMsg = 'Erreur affectation livreur';
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const updated: Order = await response.json();
    await refreshAllData();
    return updated;
  };

  const confirmOrderPayment = async (orderId: string): Promise<Order> => {
    const response = await authFetch(`/api/orders/${orderId}/payment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentStatus: 'paid' })
    });

    if (!response.ok) {
      let errorMsg = 'Erreur enregistrement encaissement';
      try {
        const err = await response.json();
        errorMsg = err.error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const updated: Order = await response.json();
    await refreshAllData();
    return updated;
  };

  const adjustStock = async (
    ingredientId: string,
    type: StockMovement['type'],
    quantity: number,
    notes: string
  ) => {
    const res = await authFetch(`/api/ingredients/${ingredientId}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        quantity,
        notes,
        performedBy: currentUser ? currentUser.name : (currentRole === 'admin' ? 'Administrateur' : 'Gestionnaire')
      })
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

    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    if (!res.ok) throw new Error('Erreur enregistrement produit');
    await refreshAllData();
  };

  const deleteProduct = async (id: string) => {
    const res = await authFetch(`/api/products/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression produit');
    await refreshAllData();
  };

  const saveCategory = async (category: Category) => {
    const url = category.id && categories.some(c => c.id === category.id)
      ? `/api/categories/${category.id}`
      : '/api/categories';
    const method = category.id && categories.some(c => c.id === category.id) ? 'PUT' : 'POST';

    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category)
    });
    if (!res.ok) throw new Error('Erreur enregistrement catégorie');
    await refreshAllData();
  };

  const deleteCategory = async (id: string) => {
    const res = await authFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression catégorie');
    await refreshAllData();
  };

  const saveSupplement = async (sup: Supplement) => {
    const url = sup.id && supplements.some(s => s.id === sup.id)
      ? `/api/supplements/${sup.id}`
      : '/api/supplements';
    const method = sup.id && supplements.some(s => s.id === sup.id) ? 'PUT' : 'POST';

    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sup)
    });
    if (!res.ok) throw new Error('Erreur enregistrement supplément');
    await refreshAllData();
  };

  const deleteSupplement = async (id: string) => {
    const res = await authFetch(`/api/supplements/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression supplément');
    await refreshAllData();
  };

  const saveIngredient = async (ing: Ingredient) => {
    const url = ing.id && ingredients.some(i => i.id === ing.id)
      ? `/api/ingredients/${ing.id}`
      : '/api/ingredients';
    const method = ing.id && ingredients.some(i => i.id === ing.id) ? 'PUT' : 'POST';

    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ing)
    });
    if (!res.ok) throw new Error('Erreur enregistrement matière première');
    await refreshAllData();
  };

  const deleteIngredient = async (id: string) => {
    const res = await authFetch(`/api/ingredients/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression matière première');
    await refreshAllData();
  };

  const saveDriver = async (driver: Driver) => {
    const url = driver.id && drivers.some(d => d.id === driver.id)
      ? `/api/drivers/${driver.id}`
      : '/api/drivers';
    const method = driver.id && drivers.some(d => d.id === driver.id) ? 'PUT' : 'POST';

    const res = await authFetch(url, {
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

    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sup)
    });
    if (!res.ok) throw new Error('Erreur enregistrement fournisseur');
    await refreshAllData();
  };

  const deleteSupplier = async (id: string) => {
    const res = await authFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Erreur suppression fournisseur');
    await refreshAllData();
  };

  const resetDemoData = async () => {
    const res = await authFetch('/api/reset-demo-data', { method: 'POST' });
    if (!res.ok) throw new Error('Erreur réinitialisation données');
    await refreshAllData();
    showToast('Données réinitialisées', 'Toutes les données de démo ont été restaurées.', 'info');
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        authLoading,
        currentUser,
        token,
        authError,
        clearAuthError,
        login,
        logout,
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
        selectedProductId,
        setSelectedProductId,
        openProductDetail,
        backToMenu,
        activeTrackingToken,
        setActiveTrackingToken,
        activeTrackingOrder,
        refreshAllData,
        createOrder,
        updateOrderStatus,
        assignDriverToOrder,
        confirmOrderPayment,
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
