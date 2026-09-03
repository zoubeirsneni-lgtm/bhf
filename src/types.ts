/**
 * BEBBA Healthy Food — Unified TypeScript Definitions
 * « Vos Plats santé en un clic »
 */

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'cancelled';
export type PaymentStatus = 'to_collect' | 'paid';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  image?: string;
  imageUrl?: string;
  description: string;
  active: boolean;
  order: number;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: 'g' | 'ml' | 'piece' | 'portion';
  currentStock: number;
  minThreshold: number;
  purchaseCost: number; // in DT
  supplierId?: string;
  supplierName?: string;
  category?: string;
  createdAt?: string;
  updatedAt: string;
}

export type StockMovementType = 'order_consumption' | 'manual_in' | 'manual_out' | 'waste' | 'inventory_correction';

export interface StockMovement {
  id: string;
  ingredientId: string;
  ingredientName: string;
  type: StockMovementType;
  quantity: number; // positive or negative
  unit: string;
  orderId?: string;
  orderNumber?: string;
  notes: string;
  timestamp: string;
  performedBy: string;
}

export interface Supplement {
  id: string;
  name: string;
  description: string;
  price: number; // DT
  ingredientId: string;
  ingredientName: string;
  quantityConsumed: number;
  quantity?: number;
  unit: string;
  available: boolean;
  isAvailable?: boolean;
  active: boolean;
  order?: number;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface BaseIngredient {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
}

export interface CustomOption {
  label: string;
  extraPrice: number;
  extraGrams: number;
}

export interface ProductCustomizationConfig {
  allowsProteinChoice?: boolean;
  proteinOptions?: CustomOption[];
  allowsVeggiesChoice?: boolean;
  veggiesOptions?: CustomOption[];
  allowsBaseChoice?: boolean;
  baseChoices?: Array<{ label: string; extraPrice: number }>;
  allowedSupplementIds: string[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  basePrice: number; // in DT
  imageUrl: string;
  image?: string;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  active: boolean;
  isAvailable: boolean;
  available?: boolean;
  isPopular?: boolean;
  order?: number;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  baseIngredients: BaseIngredient[];
  customization: ProductCustomizationConfig;
}

export interface OrderItemSupplement {
  supplementId: string;
  name: string;
  price: number;
  quantity: number;
  ingredientId: string;
  ingredientName: string;
  quantityConsumed: number;
  unit: string;
}

export interface PreparationIngredient {
  ingredientId: string;
  ingredientName: string;
  totalQuantity: number;
  unit: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  proteinOption?: CustomOption;
  veggiesOption?: CustomOption;
  baseChoice?: { label: string; extraPrice: number };
  supplements: OrderItemSupplement[];
  specialInstructions?: string;
  itemTotalPrice: number;
  preparationSheet: {
    totalIngredients: PreparationIngredient[];
    summaryLines: string[];
  };
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  label: string;
  timestamp: string;
  note?: string;
  updatedBy?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  trackingToken: string;
  createdAt: string;
  client: {
    name: string;
    phone: string;
    deliveryAddress: string;
    notes?: string;
  };
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  status: OrderStatus;
  paymentMethod: 'cash_on_delivery';
  paymentStatus: PaymentStatus;
  assignedDriverId?: string;
  assignedDriverName?: string;
  stockConsumed?: boolean;
  statusHistory: StatusHistoryEntry[];
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  suppliedIngredients: string[];
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  active: boolean;
  totalDeliveries: number;
  rating?: number;
}

export type InternalRole = 'admin' | 'kitchen' | 'driver';
export type UserRole = 'client' | 'kitchen' | 'driver' | 'admin';

export interface User {
  id: string;
  username: string;
  name: string;
  phone?: string;
  passwordHash: string;
  role: InternalRole;
  driverId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export type SafeUser = Omit<User, 'passwordHash'>;

export interface AuthResponse {
  token: string;
  user: SafeUser;
}

export interface DashboardStats {
  todayOrdersCount: number;
  todayRevenue: number;
  statusCounts: Record<OrderStatus, number>;
  totalCollectedCash: number;
  pendingCashToCollect: number;
  lowStockCount: number;
  topSellingProducts: Array<{ name: string; count: number; totalDT: number }>;
}
