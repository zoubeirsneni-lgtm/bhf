import { Category, Ingredient, Product, Supplement, Supplier, Driver, Order, StockMovement, DashboardStats } from '../types';
import {
  initialCategories,
  initialSuppliers,
  initialIngredients,
  initialSupplements,
  initialProducts,
  initialDrivers,
  initialOrders,
  initialStockMovements
} from '../../server/seedData';

export {
  initialCategories,
  initialSuppliers,
  initialIngredients,
  initialSupplements,
  initialProducts,
  initialDrivers,
  initialOrders,
  initialStockMovements
};

export const initialStats: DashboardStats = {
  todayOrdersCount: 3,
  todayRevenue: 80.8,
  statusCounts: {
    received: 1,
    preparing: 1,
    ready: 0,
    waiting_for_driver: 0,
    delivering: 1,
    delivered: 0,
    cancelled: 0
  },
  totalCollectedCash: 0,
  pendingCashToCollect: 80.8,
  lowStockCount: 0,
  topSellingProducts: [
    { name: 'BEBBA Chicken Power Bowl', count: 1, totalDT: 24.8 },
    { name: 'Assiette Bœuf Grillé & Romarin', count: 1, totalDT: 30.5 },
    { name: 'Assiette Grillade Poulet Mariné', count: 1, totalDT: 17.5 },
    { name: 'Jus Vert Détox Vitalité (350ml)', count: 1, totalDT: 5.5 }
  ]
};
