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
  icon: string;
  description: string;
  active: boolean;
  order: number;
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
  unit: string;
  available: boolean;
  active: boolean;
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
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  active: boolean;
  isAvailable: boolean;
  isPopular?: boolean;
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

export type UserRole = 'client' | 'kitchen' | 'driver' | 'admin';

export interface DashboardStats {
  todayOrdersCount: number;
  todayRevenue: number;
  statusCounts: Record<OrderStatus, number>;
  totalCollectedCash: number;
  pendingCashToCollect: number;
  lowStockCount: number;
  topSellingProducts: Array<{ name: string; count: number; totalDT: number }>;
}
