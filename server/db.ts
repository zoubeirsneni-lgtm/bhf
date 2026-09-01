import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  Category,
  Ingredient,
  Product,
  Supplement,
  Supplier,
  Driver,
  Order,
  StockMovement,
  OrderStatus,
  PaymentStatus,
  DashboardStats,
  OrderItem,
  PreparationIngredient,
  User
} from '../src/types';
import {
  initialCategories,
  initialSuppliers,
  initialIngredients,
  initialSupplements,
  initialProducts,
  initialDrivers,
  initialOrders,
  initialStockMovements
} from './seedData';

interface DatabaseSchema {
  categories: Category[];
  suppliers: Supplier[];
  ingredients: Ingredient[];
  supplements: Supplement[];
  products: Product[];
  drivers: Driver[];
  orders: Order[];
  stockMovements: StockMovement[];
  users: User[];
  nextOrderSeq: number;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

class DatabaseManager {
  private data: DatabaseSchema;
  private isLoaded = false;

  constructor() {
    this.data = this.getDefaultData();
    this.init();
  }

  private getDefaultUsers(): User[] {
    const adminUsername = (process.env.INITIAL_ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'Bebba@Admin2026!';
    const kitchenPassword = process.env.INITIAL_KITCHEN_PASSWORD || 'Bebba@Kitchen2026!';
    const driverPassword = process.env.INITIAL_DRIVER_PASSWORD || 'Bebba@Driver2026!';

    const now = new Date().toISOString();

    return [
      {
        id: 'usr-admin-1',
        username: adminUsername,
        name: 'Administrateur BEBBA',
        phone: '+216 71 000 001',
        passwordHash: bcrypt.hashSync(adminPassword, 10),
        role: 'admin',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'usr-kitchen-1',
        username: 'cuisine',
        name: 'Chef de Cuisine BEBBA',
        phone: '+216 71 000 002',
        passwordHash: bcrypt.hashSync(kitchenPassword, 10),
        role: 'kitchen',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'usr-driver-1',
        username: 'livreur1',
        name: 'Yassine Ben Amor',
        phone: '+216 98 123 456',
        passwordHash: bcrypt.hashSync(driverPassword, 10),
        role: 'driver',
        driverId: 'drv-1',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'usr-driver-2',
        username: 'livreur2',
        name: 'Amine Trabelsi',
        phone: '+216 55 987 654',
        passwordHash: bcrypt.hashSync(driverPassword, 10),
        role: 'driver',
        driverId: 'drv-2',
        active: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'usr-driver-3',
        username: 'livreur3',
        name: 'Karim Bouazizi',
        phone: '+216 22 456 789',
        passwordHash: bcrypt.hashSync(driverPassword, 10),
        role: 'driver',
        driverId: 'drv-3',
        active: true,
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  private getDefaultData(): DatabaseSchema {
    return {
      categories: JSON.parse(JSON.stringify(initialCategories)),
      suppliers: JSON.parse(JSON.stringify(initialSuppliers)),
      ingredients: JSON.parse(JSON.stringify(initialIngredients)),
      supplements: JSON.parse(JSON.stringify(initialSupplements)),
      products: JSON.parse(JSON.stringify(initialProducts)),
      drivers: JSON.parse(JSON.stringify(initialDrivers)),
      orders: JSON.parse(JSON.stringify(initialOrders)),
      stockMovements: JSON.parse(JSON.stringify(initialStockMovements)),
      users: this.getDefaultUsers(),
      nextOrderSeq: 1050
    };
  }

  private init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const fileContent = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(fileContent);
        this.data = {
          ...this.getDefaultData(),
          ...parsed
        };

        // Ensure users collection exists and default users are synchronized
        if (!this.data.users || this.data.users.length === 0) {
          this.data.users = this.getDefaultUsers();
          this.persist();
        } else {
          let changed = false;
          const defaultUsers = this.getDefaultUsers();
          defaultUsers.forEach(defUser => {
            const existingIdx = this.data.users.findIndex(u => u.username === defUser.username);
            if (existingIdx === -1) {
              this.data.users.push(defUser);
              changed = true;
            } else {
              // Sync driverId and update hash if needed
              if (defUser.driverId && this.data.users[existingIdx].driverId !== defUser.driverId) {
                this.data.users[existingIdx].driverId = defUser.driverId;
                changed = true;
              }
              // Sync default password hashes
              this.data.users[existingIdx].passwordHash = defUser.passwordHash;
              changed = true;
            }
          });
          if (changed) this.persist();
        }
      } else {
        this.persist();
      }
      this.isLoaded = true;
    } catch (err) {
      console.warn('Could not load database file, using in-memory default store:', err);
      this.data = this.getDefaultData();
      this.isLoaded = true;
    }
  }

  private persist() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error persisting database to disk:', err);
    }
  }

  public resetToDefaults() {
    this.data = this.getDefaultData();
    this.persist();
    return this.data;
  }

  // --- Categories ---
  public getCategories(): Category[] {
    return this.data.categories.sort((a, b) => a.order - b.order);
  }

  public saveCategory(category: Category): Category {
    const idx = this.data.categories.findIndex(c => c.id === category.id);
    if (idx >= 0) {
      this.data.categories[idx] = category;
    } else {
      if (!category.id) category.id = 'cat-' + Date.now();
      this.data.categories.push(category);
    }
    this.persist();
    return category;
  }

  public deleteCategory(id: string): boolean {
    const initialLen = this.data.categories.length;
    this.data.categories = this.data.categories.filter(c => c.id !== id);
    if (this.data.categories.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // --- Suppliers ---
  public getSuppliers(): Supplier[] {
    return this.data.suppliers;
  }

  public saveSupplier(supplier: Supplier): Supplier {
    const idx = this.data.suppliers.findIndex(s => s.id === supplier.id);
    if (idx >= 0) {
      this.data.suppliers[idx] = supplier;
    } else {
      if (!supplier.id) supplier.id = 'sup-' + Date.now();
      this.data.suppliers.push(supplier);
    }
    this.persist();
    return supplier;
  }

  public deleteSupplier(id: string): boolean {
    this.data.suppliers = this.data.suppliers.filter(s => s.id !== id);
    this.persist();
    return true;
  }

  // --- Ingredients (Matières Premières) ---
  public getIngredients(): Ingredient[] {
    return this.data.ingredients;
  }

  public getIngredientById(id: string): Ingredient | undefined {
    return this.data.ingredients.find(i => i.id === id);
  }

  public saveIngredient(ingredient: Ingredient): Ingredient {
    ingredient.updatedAt = new Date().toISOString();
    const idx = this.data.ingredients.findIndex(i => i.id === ingredient.id);
    if (idx >= 0) {
      this.data.ingredients[idx] = ingredient;
    } else {
      if (!ingredient.id) ingredient.id = 'ing-' + Date.now();
      this.data.ingredients.push(ingredient);
    }
    this.persist();
    return ingredient;
  }

  public deleteIngredient(id: string): boolean {
    this.data.ingredients = this.data.ingredients.filter(i => i.id !== id);
    this.persist();
    return true;
  }

  public addStockMovement(params: {
    ingredientId: string;
    type: StockMovement['type'];
    quantity: number;
    notes: string;
    performedBy?: string;
    orderId?: string;
    orderNumber?: string;
  }): { ingredient: Ingredient; movement: StockMovement } {
    const ing = this.getIngredientById(params.ingredientId);
    if (!ing) {
      throw new Error(`Ingrédient #${params.ingredientId} introuvable.`);
    }

    ing.currentStock += params.quantity;
    if (ing.currentStock < 0) ing.currentStock = 0;
    ing.updatedAt = new Date().toISOString();

    const movement: StockMovement = {
      id: 'mov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      ingredientId: ing.id,
      ingredientName: ing.name,
      type: params.type,
      quantity: params.quantity,
      unit: ing.unit,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      notes: params.notes,
      timestamp: new Date().toISOString(),
      performedBy: params.performedBy || 'Gestionnaire BEBBA'
    };

    this.data.stockMovements.unshift(movement);
    this.persist();
    return { ingredient: ing, movement };
  }

  public getStockMovements(): StockMovement[] {
    return this.data.stockMovements;
  }

  // --- Supplements ---
  public getSupplements(): Supplement[] {
    return this.data.supplements;
  }

  public saveSupplement(sup: Supplement): Supplement {
    const ing = this.getIngredientById(sup.ingredientId);
    if (ing) {
      sup.ingredientName = ing.name;
      sup.unit = ing.unit;
    }
    const idx = this.data.supplements.findIndex(s => s.id === sup.id);
    if (idx >= 0) {
      this.data.supplements[idx] = sup;
    } else {
      if (!sup.id) sup.id = 'sup-' + Date.now();
      this.data.supplements.push(sup);
    }
    this.persist();
    return sup;
  }

  public deleteSupplement(id: string): boolean {
    this.data.supplements = this.data.supplements.filter(s => s.id !== id);
    this.persist();
    return true;
  }

  // --- Products ---
  public getProducts(): Product[] {
    return this.data.products;
  }

  public getProductById(id: string): Product | undefined {
    return this.data.products.find(p => p.id === id);
  }

  public saveProduct(prod: Product): Product {
    const idx = this.data.products.findIndex(p => p.id === prod.id);
    if (idx >= 0) {
      this.data.products[idx] = prod;
    } else {
      if (!prod.id) prod.id = 'prod-' + Date.now();
      this.data.products.push(prod);
    }
    this.persist();
    return prod;
  }

  public deleteProduct(id: string): boolean {
    this.data.products = this.data.products.filter(p => p.id !== id);
    this.persist();
    return true;
  }

  // --- Drivers ---
  public getDrivers(): Driver[] {
    return this.data.drivers;
  }

  public saveDriver(driver: Driver): Driver {
    const idx = this.data.drivers.findIndex(d => d.id === driver.id);
    if (idx >= 0) {
      this.data.drivers[idx] = driver;
    } else {
      if (!driver.id) driver.id = 'drv-' + Date.now();
      this.data.drivers.push(driver);
    }
    this.persist();
    return driver;
  }

  // --- Order Computation & Creation ---
  public computePreparationSheet(
    product: Product,
    proteinOption?: { label: string; extraPrice: number; extraGrams: number },
    veggiesOption?: { label: string; extraPrice: number; extraGrams: number },
    baseChoice?: { label: string; extraPrice: number },
    supplements: Array<{ id: string; quantity: number }> = [],
    specialInstructions?: string
  ): {
    totalIngredients: PreparationIngredient[];
    summaryLines: string[];
    enrichedSupplements: any[];
    itemPrice: number;
  } {
    const ingredientMap = new Map<string, { name: string; quantity: number; unit: string }>();

    // 1. Base recipe ingredients
    for (const base of product.baseIngredients) {
      ingredientMap.set(base.ingredientId, {
        name: base.ingredientName,
        quantity: base.quantity,
        unit: base.unit
      });
    }

    // 2. Extra protein option grams
    if (proteinOption && proteinOption.extraGrams > 0) {
      // Find main protein ingredient (e.g. poulet or boeuf)
      const proteinBase = product.baseIngredients.find(b => b.ingredientId.includes('poulet') || b.ingredientId.includes('boeuf') || b.ingredientId.includes('halloumi'));
      if (proteinBase) {
        const existing = ingredientMap.get(proteinBase.ingredientId);
        if (existing) {
          existing.quantity += proteinOption.extraGrams;
        }
      }
    }

    // 3. Extra veggies option grams
    if (veggiesOption && veggiesOption.extraGrams > 0) {
      const veggiesBase = product.baseIngredients.find(b => b.ingredientId.includes('legumes'));
      if (veggiesBase) {
        const existing = ingredientMap.get(veggiesBase.ingredientId);
        if (existing) {
          existing.quantity += veggiesOption.extraGrams;
        }
      }
    }

    // 4. Base choice replacements if applicable
    if (baseChoice && baseChoice.label.includes('Quinoa')) {
      // replace rice with quinoa
      const riceBase = product.baseIngredients.find(b => b.ingredientId === 'ing-riz');
      if (riceBase) {
        const qty = riceBase.quantity;
        ingredientMap.delete('ing-riz');
        ingredientMap.set('ing-quinoa', {
          name: 'Quinoa royal aux graines',
          quantity: qty,
          unit: 'g'
        });
      }
    } else if (baseChoice && baseChoice.label.includes('Patates douces')) {
      const riceBase = product.baseIngredients.find(b => b.ingredientId === 'ing-riz');
      if (riceBase) {
        const qty = riceBase.quantity;
        ingredientMap.delete('ing-riz');
        ingredientMap.set('ing-patate-douce', {
          name: 'Patates douces rôties au romarin',
          quantity: qty,
          unit: 'g'
        });
      }
    } else if (baseChoice && baseChoice.label.includes('100% Légumes')) {
      const riceBase = product.baseIngredients.find(b => b.ingredientId === 'ing-riz' || b.ingredientId === 'ing-patate-douce');
      if (riceBase) {
        const qty = riceBase.quantity;
        ingredientMap.delete(riceBase.ingredientId);
        const leg = ingredientMap.get('ing-legumes');
        if (leg) {
          leg.quantity += qty;
        }
      }
    }

    // 5. Supplements
    const enrichedSupplements: any[] = [];
    let supplementsPrice = 0;

    for (const itemSup of supplements) {
      const supDef = this.getSupplements().find(s => s.id === itemSup.id);
      if (supDef && itemSup.quantity > 0) {
        const totalSupQty = supDef.quantityConsumed * itemSup.quantity;
        supplementsPrice += supDef.price * itemSup.quantity;

        const existing = ingredientMap.get(supDef.ingredientId);
        if (existing) {
          existing.quantity += totalSupQty;
        } else {
          ingredientMap.set(supDef.ingredientId, {
            name: supDef.ingredientName,
            quantity: totalSupQty,
            unit: supDef.unit
          });
        }

        enrichedSupplements.push({
          supplementId: supDef.id,
          name: supDef.name,
          price: supDef.price,
          quantity: itemSup.quantity,
          ingredientId: supDef.ingredientId,
          ingredientName: supDef.ingredientName,
          quantityConsumed: totalSupQty,
          unit: supDef.unit
        });
      }
    }

    // Calculate total price
    const proteinExtraPrice = proteinOption ? proteinOption.extraPrice : 0;
    const veggiesExtraPrice = veggiesOption ? veggiesOption.extraPrice : 0;
    const baseExtraPrice = baseChoice ? baseChoice.extraPrice : 0;
    const itemPrice = product.basePrice + proteinExtraPrice + veggiesExtraPrice + baseExtraPrice + supplementsPrice;

    // Formatted list for kitchen
    const totalIngredients: PreparationIngredient[] = [];
    const summaryLines: string[] = [];

    ingredientMap.forEach((val, key) => {
      totalIngredients.push({
        ingredientId: key,
        ingredientName: val.name,
        totalQuantity: Math.round(val.quantity * 10) / 10,
        unit: val.unit
      });

      const icon = val.name.includes('Poulet')
        ? '🍗'
        : val.name.includes('Bœuf')
        ? '🥩'
        : val.name.includes('Riz') || val.name.includes('Quinoa')
        ? '🍚'
        : val.name.includes('Légumes')
        ? '🥦'
        : val.name.includes('Avocat')
        ? '🥑'
        : val.name.includes('Œuf')
        ? '🥚'
        : val.name.includes('Halloumi')
        ? '🧀'
        : val.name.includes('Sauce')
        ? '🥣'
        : '🌿';

      summaryLines.push(`${icon} ${val.name}: ${Math.round(val.quantity)} ${val.unit}`);
    });

    if (specialInstructions && specialInstructions.trim()) {
      summaryLines.push(`⚠️ NOTE CLIENT: « ${specialInstructions.trim()} »`);
    }

    return {
      totalIngredients,
      summaryLines,
      enrichedSupplements,
      itemPrice
    };
  }

  // --- Create Order ---
  public createOrder(payload: {
    client: { name: string; phone: string; deliveryAddress: string; notes?: string };
    items: Array<{
      productId: string;
      quantity: number;
      proteinOption?: { label: string; extraPrice: number; extraGrams: number };
      veggiesOption?: { label: string; extraPrice: number; extraGrams: number };
      baseChoice?: { label: string; extraPrice: number };
      supplements: Array<{ id: string; quantity: number }>;
      specialInstructions?: string;
    }>;
  }): Order {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Le panier est vide.');
    }
    if (!payload.client || !payload.client.name || !payload.client.phone || !payload.client.deliveryAddress) {
      throw new Error('Veuillez renseigner le nom, téléphone et adresse de livraison.');
    }

    const orderSeq = this.data.nextOrderSeq++;
    const orderNumber = `BEBBA-${orderSeq}`;
    const trackingToken = 'tk_' + crypto.randomBytes(6).toString('hex');
    const orderId = 'ord-' + Date.now();

    let subtotal = 0;
    const computedItems: OrderItem[] = [];

    for (const rawItem of payload.items) {
      const product = this.getProductById(rawItem.productId);
      if (!product) {
        throw new Error(`Produit #${rawItem.productId} non trouvé.`);
      }

      const prep = this.computePreparationSheet(
        product,
        rawItem.proteinOption,
        rawItem.veggiesOption,
        rawItem.baseChoice,
        rawItem.supplements,
        rawItem.specialInstructions
      );

      const qty = Math.max(1, rawItem.quantity || 1);
      const itemTotalPrice = prep.itemPrice * qty;
      subtotal += itemTotalPrice;

      computedItems.push({
        id: 'item-' + Math.random().toString(36).substring(2, 9),
        productId: product.id,
        productName: product.name,
        unitPrice: prep.itemPrice,
        quantity: qty,
        proteinOption: rawItem.proteinOption,
        veggiesOption: rawItem.veggiesOption,
        baseChoice: rawItem.baseChoice,
        supplements: prep.enrichedSupplements,
        specialInstructions: rawItem.specialInstructions,
        itemTotalPrice: itemTotalPrice,
        preparationSheet: {
          totalIngredients: prep.totalIngredients,
          summaryLines: prep.summaryLines
        }
      });

      // Deduct raw ingredients from inventory immediately upon order receipt
      for (const ingredientUsage of prep.totalIngredients) {
        const totalUsed = ingredientUsage.totalQuantity * qty;
        this.addStockMovement({
          ingredientId: ingredientUsage.ingredientId,
          type: 'order_consumption',
          quantity: -totalUsed,
          notes: `Préparation commande #${orderNumber} (${product.name} x${qty})`,
          performedBy: 'BEBBA KDS Moteur Automatique',
          orderId: orderId,
          orderNumber: orderNumber
        });
      }
    }

    const deliveryFee = 2.5; // Flat delivery fee in DT
    const totalAmount = Math.round((subtotal + deliveryFee) * 10) / 10;

    const newOrder: Order = {
      id: orderId,
      orderNumber: orderNumber,
      trackingToken: trackingToken,
      createdAt: new Date().toISOString(),
      client: {
        name: payload.client.name.trim(),
        phone: payload.client.phone.trim(),
        deliveryAddress: payload.client.deliveryAddress.trim(),
        notes: payload.client.notes?.trim() || ''
      },
      items: computedItems,
      subtotal: Math.round(subtotal * 10) / 10,
      deliveryFee: deliveryFee,
      totalAmount: totalAmount,
      status: 'received',
      paymentMethod: 'cash_on_delivery',
      paymentStatus: 'to_collect',
      statusHistory: [
        {
          status: 'received',
          label: 'Commande reçue & transmise à la cuisine',
          timestamp: new Date().toISOString(),
          note: 'Paiement à la livraison sélectionné',
          updatedBy: 'Système Client'
        }
      ]
    };

    this.data.orders.unshift(newOrder);
    this.persist();
    return newOrder;
  }

  // --- Orders Management ---
  public getOrders(): Order[] {
    return this.data.orders;
  }

  public getOrderById(id: string): Order | undefined {
    return this.data.orders.find(o => o.id === id);
  }

  public getOrderByTrackingToken(token: string): Order | undefined {
    return this.data.orders.find(o => o.trackingToken === token);
  }

  public updateOrderStatus(params: {
    orderId: string;
    status: OrderStatus;
    updatedBy?: string;
    note?: string;
    assignedDriverId?: string;
  }): Order {
    const order = this.getOrderById(params.orderId);
    if (!order) {
      throw new Error(`Commande #${params.orderId} introuvable.`);
    }

    order.status = params.status;

    if (params.assignedDriverId) {
      const driver = this.data.drivers.find(d => d.id === params.assignedDriverId);
      if (driver) {
        order.assignedDriverId = driver.id;
        order.assignedDriverName = driver.name;
      }
    }

    // Auto update payment if marked as delivered
    if (params.status === 'delivered') {
      order.paymentStatus = 'paid';
      if (order.assignedDriverId) {
        const driver = this.data.drivers.find(d => d.id === order.assignedDriverId);
        if (driver) {
          driver.totalDeliveries = (driver.totalDeliveries || 0) + 1;
        }
      }
    }

    const statusLabels: Record<OrderStatus, string> = {
      received: 'Commande reçue',
      preparing: 'En préparation en cuisine',
      ready: 'Commande prête & emballée',
      delivering: 'En cours de livraison',
      delivered: 'Commande livrée & Paiement encaissé',
      cancelled: 'Commande annulée'
    };

    order.statusHistory.push({
      status: params.status,
      label: statusLabels[params.status] || params.status,
      timestamp: new Date().toISOString(),
      note: params.note || '',
      updatedBy: params.updatedBy || 'Équipe BEBBA'
    });

    this.persist();
    return order;
  }

  public updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Order {
    const order = this.getOrderById(orderId);
    if (!order) {
      throw new Error(`Commande #${orderId} introuvable.`);
    }
    order.paymentStatus = paymentStatus;
    this.persist();
    return order;
  }

  // --- Dashboard Stats ---
  public getDashboardStats(): DashboardStats {
    const orders = this.data.orders;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const todayOrders = orders.filter(o => o.createdAt.startsWith(todayStr));
    const todayRevenue = todayOrders.reduce((sum, o) => (o.status !== 'cancelled' ? sum + o.totalAmount : sum), 0);

    const statusCounts: Record<OrderStatus, number> = {
      received: 0,
      preparing: 0,
      ready: 0,
      delivering: 0,
      delivered: 0,
      cancelled: 0
    };

    let totalCollectedCash = 0;
    let pendingCashToCollect = 0;

    orders.forEach(o => {
      if (statusCounts[o.status] !== undefined) {
        statusCounts[o.status]++;
      }
      if (o.paymentStatus === 'paid') {
        totalCollectedCash += o.totalAmount;
      } else if (o.status !== 'cancelled') {
        pendingCashToCollect += o.totalAmount;
      }
    });

    const lowStockCount = this.data.ingredients.filter(i => i.currentStock <= i.minThreshold).length;

    // Top selling products
    const productCountMap = new Map<string, { name: string; count: number; totalDT: number }>();
    orders.forEach(o => {
      if (o.status !== 'cancelled') {
        o.items.forEach(item => {
          const current = productCountMap.get(item.productId) || { name: item.productName, count: 0, totalDT: 0 };
          current.count += item.quantity;
          current.totalDT += item.itemTotalPrice;
          productCountMap.set(item.productId, current);
        });
      }
    });

    const topSellingProducts = Array.from(productCountMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      todayOrdersCount: todayOrders.length,
      todayRevenue: Math.round(todayRevenue * 10) / 10,
      statusCounts,
      totalCollectedCash: Math.round(totalCollectedCash * 10) / 10,
      pendingCashToCollect: Math.round(pendingCashToCollect * 10) / 10,
      lowStockCount,
      topSellingProducts
    };
  }

  // --- Users & Authentication ---
  public getUsers(): User[] {
    return this.data.users;
  }

  public getUserById(id: string): User | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public getUserByUsername(username: string): User | undefined {
    const cleanUsername = username.trim().toLowerCase();
    return this.data.users.find(u => u.username.toLowerCase() === cleanUsername);
  }

  public saveUser(user: User): User {
    user.updatedAt = new Date().toISOString();
    const idx = this.data.users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      this.data.users[idx] = user;
    } else {
      if (!user.id) user.id = 'usr-' + Date.now();
      if (!user.createdAt) user.createdAt = new Date().toISOString();
      this.data.users.push(user);
    }
    this.persist();
    return user;
  }

  public updateUserLastLogin(id: string): void {
    const user = this.getUserById(id);
    if (user) {
      user.lastLoginAt = new Date().toISOString();
      this.persist();
    }
  }

  public deleteUser(id: string): boolean {
    const initialLen = this.data.users.length;
    this.data.users = this.data.users.filter(u => u.id !== id);
    if (this.data.users.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }
}

export const db = new DatabaseManager();
