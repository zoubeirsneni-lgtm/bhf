import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
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

export interface InsufficientStockDetail {
  ingredientId: string;
  ingredientName: string;
  required: number;
  available: number;
  missing: number;
  unit: string;
}

export class InsufficientStockError extends Error {
  public statusCode = 409;
  public status = 409;
  public details: InsufficientStockDetail[];

  constructor(details: InsufficientStockDetail[]) {
    const summaryMsg = details
      .map(d => `${d.ingredientName} (requis : ${d.required} ${d.unit}, disponible : ${d.available} ${d.unit}, manquant : ${d.missing} ${d.unit})`)
      .join(', ');
    super(`Stock insuffisant : ${summaryMsg}`);
    this.name = 'InsufficientStockError';
    this.details = details;
  }
}

export class IdempotencyConflictError extends Error {
  public statusCode = 422;
  constructor(message = 'Conflit d’idempotence : La clé fournie est associée à un contenu de commande différent.') {
    super(message);
    this.name = 'IdempotencyConflictError';
  }
}

export class IdempotencyForbiddenError extends Error {
  public statusCode = 403;
  constructor(message = 'Accès refusé : La clé d’idempotence appartient à un autre émetteur.') {
    super(message);
    this.name = 'IdempotencyForbiddenError';
  }
}

export class IdempotencyInconsistencyError extends Error {
  public statusCode = 500;
  constructor(message = 'Incohérence technique d’idempotence : enregistrement d’idempotence référençant une commande inexistante.') {
    super(message);
    this.name = 'IdempotencyInconsistencyError';
  }
}

export class SystemNotReadyError extends Error {
  public statusCode = 503;
  constructor(message = 'Système temporairement indisponible (migration en cours ou maintenance).') {
    super(message);
    this.name = 'SystemNotReadyError';
  }
}

/**
 * Normalisation standard du numéro de téléphone pour BEBBA.
 * Conserve les 8 derniers chiffres utiles pour les comparaisons fiables.
 */
export function normalizePhoneNumber(phoneRaw: string): string | null {
  if (!phoneRaw || typeof phoneRaw !== 'string') return null;
  const digits = phoneRaw.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return digits.slice(-8);
}

/**
 * Normalisation standard de l'adresse de livraison pour BEBBA.
 * Élimine les espaces superflus et standardise la casse.
 */
export function normalizeAddress(addr: string | null | undefined): string {
  if (!addr || typeof addr !== 'string') return '';
  return addr.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Nettoie récursivement tout champ 'undefined' car Firestore interdit les valeurs undefined.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => stripUndefined(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        clean[key] = stripUndefined(val);
      }
    }
    return clean;
  }
  return obj;
}

// Initialisation unique du SDK Firestore
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
if (!fs.existsSync(configPath)) {
  console.error('[DatabaseManager] ERREUR CRITIQUE: firebase-applet-config.json introuvable.');
}

const firebaseConfig = fs.existsSync(configPath)
  ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
  : null;

const firebaseApp = firebaseConfig
  ? (!getApps().length ? initializeApp(firebaseConfig) : getApp())
  : null;

const firestore: Firestore | null = firebaseApp
  ? getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId)
  : null;

class DatabaseManager {
  private getDb(): Firestore {
    if (!firestore) {
      throw new Error('Base de données Firestore non initialisée.');
    }
    return firestore;
  }

  // --- Contrôle du statut du système ---
  public async getSystemState(): Promise<string> {
    const db = this.getDb();
    const snap = await getDoc(doc(db, 'meta', 'system'));
    if (!snap.exists()) {
      return 'NOT_STARTED';
    }
    return snap.data()?.state || 'NOT_STARTED';
  }

  // --- Categories ---
  public async getCategories(options?: { activeOnly?: boolean }): Promise<Category[]> {
    const db = this.getDb();
    const snap = await getDocs(collection(db, 'categories'));
    let cats: Category[] = [];
    snap.forEach(d => cats.push(d.data() as Category));

    if (options?.activeOnly) {
      cats = cats.filter(c => c.active);
    }
    return cats.sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : (a.order || 0);
      const orderB = b.sortOrder !== undefined ? b.sortOrder : (b.order || 0);
      return orderA - orderB;
    });
  }

  public async getCategoryById(id: string): Promise<Category | undefined> {
    const db = this.getDb();
    const snap = await getDoc(doc(db, 'categories', id));
    return snap.exists() ? (snap.data() as Category) : undefined;
  }

  public async saveCategory(category: Partial<Category> & { name: string }): Promise<Category> {
    if (!category.name || typeof category.name !== 'string' || !category.name.trim()) {
      throw new Error('Le nom de la catégorie est obligatoire.');
    }

    const db = this.getDb();
    const now = new Date().toISOString();
    const id = category.id || 'cat-' + Date.now();
    const existing = await this.getCategoryById(id);

    const sortOrder = category.sortOrder !== undefined
      ? Number(category.sortOrder)
      : (category.order !== undefined ? Number(category.order) : 10);
    const slug = category.slug || category.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const completeCategory: Category = {
      id,
      name: category.name.trim(),
      slug: slug || 'cat-item',
      icon: category.icon || 'Utensils',
      image: category.image || category.imageUrl || '',
      imageUrl: category.imageUrl || category.image || '',
      description: category.description || '',
      active: category.active !== false,
      order: sortOrder,
      sortOrder: sortOrder,
      createdAt: existing?.createdAt || category.createdAt || now,
      updatedAt: now
    };

    await setDoc(doc(db, 'categories', completeCategory.id), completeCategory);
    return completeCategory;
  }

  public async deleteCategory(id: string): Promise<boolean> {
    const db = this.getDb();
    const prodsSnap = await getDocs(query(collection(db, 'products'), where('categoryId', '==', id)));
    if (!prodsSnap.empty) {
      throw new Error('Impossible de supprimer cette catégorie car des produits y sont rattachés.');
    }

    await deleteDoc(doc(db, 'categories', id));
    return true;
  }

  // --- Suppliers ---
  public async getSuppliers(): Promise<Supplier[]> {
    const db = this.getDb();
    const snap = await getDocs(collection(db, 'suppliers'));
    const list: Supplier[] = [];
    snap.forEach(d => list.push(d.data() as Supplier));
    return list;
  }

  public async saveSupplier(supplier: Supplier): Promise<Supplier> {
    const db = this.getDb();
    if (!supplier.id) supplier.id = 'sup-' + Date.now();
    await setDoc(doc(db, 'suppliers', supplier.id), supplier);
    return supplier;
  }

  public async deleteSupplier(id: string): Promise<boolean> {
    const db = this.getDb();
    await deleteDoc(doc(db, 'suppliers', id));
    return true;
  }

  // --- Ingredients (Matières Premières) ---
  public async getIngredients(): Promise<Ingredient[]> {
    const db = this.getDb();
    const snap = await getDocs(collection(db, 'ingredients'));
    const list: Ingredient[] = [];
    snap.forEach(d => list.push(d.data() as Ingredient));
    return list;
  }

  public async getIngredientById(id: string): Promise<Ingredient | undefined> {
    const db = this.getDb();
    const snap = await getDoc(doc(db, 'ingredients', id));
    return snap.exists() ? (snap.data() as Ingredient) : undefined;
  }

  public async isIngredientInUse(id: string): Promise<{
    inUse: boolean;
    products: string[];
    supplements: string[];
    orders: string[];
    hasMovements: boolean;
  }> {
    const [products, supplements, orders, movements] = await Promise.all([
      this.getProducts(),
      this.getSupplements(),
      this.getOrders(),
      this.getStockMovements()
    ]);

    const matchingProducts = products
      .filter(p => p.baseIngredients?.some(bi => bi.ingredientId === id))
      .map(p => p.name);

    const matchingSupplements = supplements
      .filter(s => s.ingredientId === id)
      .map(s => s.name);

    const matchingOrders = orders
      .filter(o => o.items?.some(it =>
        it.preparationSheet?.totalIngredients?.some(pi => pi.ingredientId === id) ||
        it.supplements?.some(s => s.ingredientId === id)
      ))
      .map(o => o.orderNumber);

    const hasMovements = movements.some(m => m.ingredientId === id);
    const inUse = matchingProducts.length > 0 || matchingSupplements.length > 0 || matchingOrders.length > 0 || hasMovements;

    return {
      inUse,
      products: matchingProducts,
      supplements: matchingSupplements,
      orders: matchingOrders,
      hasMovements
    };
  }

  public async saveIngredient(ingredient: Ingredient): Promise<Ingredient> {
    const db = this.getDb();
    ingredient.updatedAt = new Date().toISOString();
    if (!ingredient.id) ingredient.id = 'ing-' + Date.now();
    if (!ingredient.createdAt) ingredient.createdAt = new Date().toISOString();
    if (ingredient.active === undefined) ingredient.active = true;

    await setDoc(doc(db, 'ingredients', ingredient.id), ingredient);
    return ingredient;
  }

  public async deleteIngredient(id: string): Promise<boolean> {
    const db = this.getDb();
    const ingredient = await this.getIngredientById(id);
    if (!ingredient) {
      throw new Error('Ingrédient introuvable.');
    }

    if (ingredient.active !== false) {
      throw new Error("Impossible de supprimer un ingrédient actif. Veuillez d'abord le désactiver.");
    }

    const usage = await this.isIngredientInUse(id);
    if (usage.inUse) {
      const reasons: string[] = [];
      if (usage.products.length > 0) reasons.push(`recettes (${usage.products.join(', ')})`);
      if (usage.supplements.length > 0) reasons.push(`suppléments (${usage.supplements.join(', ')})`);
      if (usage.orders.length > 0) reasons.push(`commandes (#${usage.orders.slice(0, 3).join(', #')})`);
      if (usage.hasMovements) reasons.push(`historique des mouvements de stock`);
      throw new Error(`Impossible de supprimer définitivement cet ingrédient car il est référencé (${reasons.join(' ; ')}). Veuillez le désactiver à la place.`);
    }

    await deleteDoc(doc(db, 'ingredients', id));
    return true;
  }

  public async addStockMovement(params: {
    ingredientId: string;
    type: StockMovement['type'] | 'order_cancellation';
    quantity: number;
    notes: string;
    performedBy?: string;
    orderId?: string;
    orderNumber?: string;
  }): Promise<{ ingredient: Ingredient; movement: StockMovement }> {
    const db = this.getDb();

    return await runTransaction(db, async (transaction) => {
      const ingRef = doc(db, 'ingredients', params.ingredientId);
      const ingSnap = await transaction.get(ingRef);
      if (!ingSnap.exists()) {
        throw new Error(`Ingrédient #${params.ingredientId} introuvable.`);
      }

      const ing = ingSnap.data() as Ingredient;
      ing.currentStock = Math.round((ing.currentStock + params.quantity) * 10) / 10;
      ing.updatedAt = new Date().toISOString();

      const movId = 'mov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
      const movement: StockMovement = {
        id: movId,
        ingredientId: ing.id,
        ingredientName: ing.name,
        type: params.type as any,
        quantity: params.quantity,
        unit: ing.unit,
        orderId: params.orderId,
        orderNumber: params.orderNumber,
        notes: params.notes,
        timestamp: new Date().toISOString(),
        performedBy: params.performedBy || 'Gestionnaire BEBBA'
      };

      transaction.update(ingRef, {
        currentStock: ing.currentStock,
        updatedAt: ing.updatedAt
      });
      transaction.set(doc(db, 'stockMovements', movId), movement);

      return { ingredient: ing, movement };
    });
  }

  public async getStockMovements(): Promise<StockMovement[]> {
    const db = this.getDb();
    const snap = await getDocs(collection(db, 'stockMovements'));
    const list: StockMovement[] = [];
    snap.forEach(d => list.push(d.data() as StockMovement));
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  // --- Supplements ---
  public async getSupplements(options?: { activeOnly?: boolean; availableOnly?: boolean }): Promise<Supplement[]> {
    const db = this.getDb();
    const [supSnap, ingSnap] = await Promise.all([
      getDocs(collection(db, 'supplements')),
      getDocs(collection(db, 'ingredients'))
    ]);

    const ingMap = new Map<string, Ingredient>();
    ingSnap.forEach(d => ingMap.set(d.id, d.data() as Ingredient));

    let list: Supplement[] = [];
    supSnap.forEach(d => {
      const s = d.data() as Supplement;
      const ing = ingMap.get(s.ingredientId);
      list.push({
        ...s,
        ingredientActive: ing ? ing.active !== false : false
      });
    });

    if (options?.activeOnly) {
      list = list.filter(s => s.active && s.ingredientActive !== false);
    }
    if (options?.availableOnly) {
      list = list.filter(s => s.available && s.isAvailable !== false);
    }
    return list.sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : (a.order || 0);
      const orderB = b.sortOrder !== undefined ? b.sortOrder : (b.order || 0);
      return orderA - orderB;
    });
  }

  public async getSupplementById(id: string): Promise<Supplement | undefined> {
    const db = this.getDb();
    const snap = await getDoc(doc(db, 'supplements', id));
    if (!snap.exists()) return undefined;
    const s = snap.data() as Supplement;
    const ing = await this.getIngredientById(s.ingredientId);
    return {
      ...s,
      ingredientActive: ing ? ing.active !== false : false
    };
  }

  public async saveSupplement(sup: Partial<Supplement> & { name: string; price: number }): Promise<Supplement> {
    if (!sup.name || typeof sup.name !== 'string' || !sup.name.trim()) {
      throw new Error('Le nom du supplément est obligatoire.');
    }
    if (typeof sup.price !== 'number' || isNaN(sup.price) || sup.price < 0) {
      throw new Error('Le prix du supplément doit être un nombre positif.');
    }

    const db = this.getDb();
    const now = new Date().toISOString();
    const id = sup.id || 'sup-' + Date.now();
    const existing = await this.getSupplementById(id);

    const sortOrder = sup.sortOrder !== undefined ? Number(sup.sortOrder) : (sup.order !== undefined ? Number(sup.order) : 10);
    const quantityConsumed = sup.quantityConsumed !== undefined ? Number(sup.quantityConsumed) : (sup.quantity !== undefined ? Number(sup.quantity) : 100);

    const ing = sup.ingredientId ? await this.getIngredientById(sup.ingredientId) : undefined;
    const isAvailable = sup.available !== false && sup.isAvailable !== false;

    const completeSup: Supplement = {
      id,
      name: sup.name.trim(),
      description: sup.description || '',
      price: Math.round(sup.price * 10) / 10,
      ingredientId: sup.ingredientId || (ing ? ing.id : 'ing-legumes'),
      ingredientName: ing ? ing.name : (sup.ingredientName || 'Ingrédient'),
      quantityConsumed: quantityConsumed,
      quantity: quantityConsumed,
      unit: ing ? ing.unit : (sup.unit || 'g'),
      available: isAvailable,
      isAvailable: isAvailable,
      active: sup.active !== false,
      order: sortOrder,
      sortOrder: sortOrder,
      createdAt: existing?.createdAt || sup.createdAt || now,
      updatedAt: now
    };

    await setDoc(doc(db, 'supplements', completeSup.id), completeSup);
    return completeSup;
  }

  public async deleteSupplement(id: string): Promise<boolean> {
    const db = this.getDb();
    await deleteDoc(doc(db, 'supplements', id));
    return true;
  }

  // --- Products ---
  public async getProducts(options?: { categoryId?: string; activeOnly?: boolean; availableOnly?: boolean }): Promise<Product[]> {
    const db = this.getDb();
    const [prodSnap, ingSnap] = await Promise.all([
      getDocs(collection(db, 'products')),
      getDocs(collection(db, 'ingredients'))
    ]);

    const ingMap = new Map<string, Ingredient>();
    ingSnap.forEach(d => ingMap.set(d.id, d.data() as Ingredient));

    let prods: Product[] = [];
    prodSnap.forEach(d => {
      const p = d.data() as Product;
      const hasInactiveIngredient = (p.baseIngredients || []).some(bi => {
        const ing = ingMap.get(bi.ingredientId);
        return ing && ing.active === false;
      });
      prods.push({
        ...p,
        hasInactiveIngredient
      });
    });

    if (options?.categoryId && options.categoryId !== 'all') {
      prods = prods.filter(p => p.categoryId === options.categoryId);
    }
    if (options?.activeOnly) {
      prods = prods.filter(p => p.active);
    }
    if (options?.availableOnly) {
      prods = prods.filter(p => p.available && p.isAvailable !== false);
    }
    return prods.sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : (a.order || 0);
      const orderB = b.sortOrder !== undefined ? b.sortOrder : (b.order || 0);
      return orderA - orderB;
    });
  }

  public async getProductById(id: string): Promise<Product | undefined> {
    const db = this.getDb();
    const snap = await getDoc(doc(db, 'products', id));
    if (!snap.exists()) return undefined;

    const p = snap.data() as Product;
    const ingSnap = await getDocs(collection(db, 'ingredients'));
    const ingMap = new Map<string, Ingredient>();
    ingSnap.forEach(d => ingMap.set(d.id, d.data() as Ingredient));

    const hasInactiveIngredient = (p.baseIngredients || []).some(bi => {
      const ing = ingMap.get(bi.ingredientId);
      return ing && ing.active === false;
    });

    return {
      ...p,
      hasInactiveIngredient
    };
  }

  public async saveProduct(prod: Partial<Product> & { name: string; basePrice: number; categoryId: string }): Promise<Product> {
    if (!prod.name || typeof prod.name !== 'string' || !prod.name.trim()) {
      throw new Error('Le nom du produit est obligatoire.');
    }
    if (typeof prod.basePrice !== 'number' || isNaN(prod.basePrice) || prod.basePrice < 0) {
      throw new Error('Le prix de base du produit doit être un nombre positif.');
    }
    if (!prod.categoryId) {
      throw new Error('La catégorie du produit est obligatoire.');
    }

    const db = this.getDb();
    const now = new Date().toISOString();
    const id = prod.id || 'prod-' + Date.now();
    const existing = await this.getProductById(id);

    const sortOrder = prod.sortOrder !== undefined ? Number(prod.sortOrder) : (prod.order !== undefined ? Number(prod.order) : 10);
    const isAvailable = prod.available !== false && prod.isAvailable !== false;

    const completeProduct: Product = {
      id,
      name: prod.name.trim(),
      description: prod.description || '',
      categoryId: prod.categoryId,
      basePrice: Math.round(prod.basePrice * 10) / 10,
      imageUrl: prod.imageUrl || prod.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
      image: prod.imageUrl || prod.image || '',
      calories: prod.calories,
      proteinGrams: prod.proteinGrams,
      carbsGrams: prod.carbsGrams,
      fatGrams: prod.fatGrams,
      active: prod.active !== false,
      available: isAvailable,
      isAvailable: isAvailable,
      isPopular: prod.isPopular || false,
      order: sortOrder,
      sortOrder: sortOrder,
      createdAt: existing?.createdAt || prod.createdAt || now,
      updatedAt: now,
      baseIngredients: Array.isArray(prod.baseIngredients) ? prod.baseIngredients : [],
      customization: prod.customization || {
        allowedSupplementIds: []
      }
    };

    await setDoc(doc(db, 'products', completeProduct.id), completeProduct);
    return completeProduct;
  }

  public async deleteProduct(id: string): Promise<boolean> {
    const db = this.getDb();
    await deleteDoc(doc(db, 'products', id));
    return true;
  }

  // --- Drivers ---
  public async getDrivers(): Promise<Driver[]> {
    const db = this.getDb();
    const [drvSnap, usrSnap] = await Promise.all([
      getDocs(collection(db, 'drivers')),
      getDocs(query(collection(db, 'users'), where('role', '==', 'driver')))
    ]);

    const userMap = new Map<string, string>();
    usrSnap.forEach(d => {
      const u = d.data() as User;
      if (u.driverId) userMap.set(u.driverId, u.username);
    });

    const list: Driver[] = [];
    drvSnap.forEach(d => {
      const drv = d.data() as Driver;
      list.push({
        ...drv,
        username: userMap.get(drv.id)
      });
    });
    return list;
  }

  public async getDriverById(id: string): Promise<Driver | undefined> {
    const db = this.getDb();
    const snap = await getDoc(doc(db, 'drivers', id));
    return snap.exists() ? (snap.data() as Driver) : undefined;
  }

  public async getUserByDriverId(driverId: string): Promise<User | undefined> {
    const db = this.getDb();
    const snap = await getDocs(query(collection(db, 'users'), where('driverId', '==', driverId)));
    if (snap.empty) return undefined;
    return snap.docs[0].data() as User;
  }

  public async saveDriver(driver: Driver): Promise<Driver> {
    const db = this.getDb();
    if (!driver.id) driver.id = 'drv-' + Date.now();
    await setDoc(doc(db, 'drivers', driver.id), driver);
    return driver;
  }

  public async createDriverWithAccount(data: {
    name: string;
    phone: string;
    vehicle: string;
    username: string;
    passwordHash: string;
    active?: boolean;
  }): Promise<{ driver: Driver; user: User }> {
    const cleanUsername = (data.username || '').trim().toLowerCase();
    if (!cleanUsername) throw new Error('Le nom d’utilisateur est obligatoire.');
    if (!data.name || !data.name.trim()) throw new Error('Le nom du livreur est obligatoire.');
    if (!data.phone || !data.phone.trim()) throw new Error('Le téléphone du livreur est obligatoire.');
    if (!data.passwordHash) throw new Error('Le mot de passe haché est requis.');

    const db = this.getDb();

    // 1. Vérifier l'unicité du nom d'utilisateur
    const userSnap = await getDocs(query(collection(db, 'users'), where('username', '==', cleanUsername)));
    if (!userSnap.empty) {
      throw new Error(`Le nom d’utilisateur "${cleanUsername}" est déjà attribué.`);
    }

    const driverId = 'drv-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const userId = 'usr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const now = new Date().toISOString();
    const isActive = data.active !== false;

    const driver: Driver = {
      id: driverId,
      name: data.name.trim(),
      phone: data.phone.trim(),
      vehicle: (data.vehicle || 'Scooter standard').trim(),
      active: isActive,
      totalDeliveries: 0,
      rating: 5.0
    };

    const user: User = {
      id: userId,
      username: cleanUsername,
      name: data.name.trim(),
      phone: data.phone.trim(),
      passwordHash: data.passwordHash,
      role: 'driver',
      driverId: driver.id,
      active: isActive,
      createdAt: now,
      updatedAt: now
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'drivers', driverId), driver);
    batch.set(doc(db, 'users', userId), user);
    await batch.commit();

    return { driver, user };
  }

  public async updateDriverWithAccount(
    driverId: string,
    data: { name?: string; phone?: string; vehicle?: string }
  ): Promise<Driver> {
    const db = this.getDb();
    const driver = await this.getDriverById(driverId);
    if (!driver) {
      throw new Error(`Livreur #${driverId} introuvable.`);
    }

    if (data.name && data.name.trim()) driver.name = data.name.trim();
    if (data.phone && data.phone.trim()) driver.phone = data.phone.trim();
    if (data.vehicle && data.vehicle.trim()) driver.vehicle = data.vehicle.trim();

    const batch = writeBatch(db);
    batch.set(doc(db, 'drivers', driverId), driver);

    const linkedUser = await this.getUserByDriverId(driverId);
    if (linkedUser) {
      if (data.name && data.name.trim()) linkedUser.name = data.name.trim();
      if (data.phone && data.phone.trim()) linkedUser.phone = data.phone.trim();
      linkedUser.updatedAt = new Date().toISOString();
      batch.set(doc(db, 'users', linkedUser.id), linkedUser);
    }

    await batch.commit();
    return driver;
  }

  public async setDriverActiveStatus(driverId: string, active: boolean): Promise<{ driver: Driver; user?: User }> {
    const db = this.getDb();
    const driver = await this.getDriverById(driverId);
    if (!driver) throw new Error(`Livreur #${driverId} introuvable.`);

    driver.active = active;
    const batch = writeBatch(db);
    batch.update(doc(db, 'drivers', driverId), { active });

    const linkedUser = await this.getUserByDriverId(driverId);
    if (linkedUser) {
      linkedUser.active = active;
      linkedUser.updatedAt = new Date().toISOString();
      batch.update(doc(db, 'users', linkedUser.id), { active, updatedAt: linkedUser.updatedAt });
    }

    await batch.commit();
    return { driver, user: linkedUser };
  }

  public async resetDriverPassword(driverId: string, newPasswordHash: string): Promise<User> {
    const db = this.getDb();
    const linkedUser = await this.getUserByDriverId(driverId);
    if (!linkedUser) throw new Error(`Compte utilisateur introuvable pour le livreur #${driverId}.`);

    linkedUser.passwordHash = newPasswordHash;
    linkedUser.updatedAt = new Date().toISOString();
    await updateDoc(doc(db, 'users', linkedUser.id), {
      passwordHash: newPasswordHash,
      updatedAt: linkedUser.updatedAt
    });
    return linkedUser;
  }

  public async deleteDriver(driverId: string): Promise<boolean> {
    const db = this.getDb();
    const driver = await this.getDriverById(driverId);
    if (!driver) throw new Error(`Livreur #${driverId} introuvable.`);

    // Vérifier l'historique des commandes
    const ordersSnap = await getDocs(query(collection(db, 'orders'), where('assignedDriverId', '==', driverId)));
    if (!ordersSnap.empty) {
      throw new Error(`Impossible de supprimer définitivement le livreur "${driver.name}" car des commandes historiques lui sont associées. Veuillez le désactiver.`);
    }

    const linkedUser = await this.getUserByDriverId(driverId);
    const batch = writeBatch(db);
    batch.delete(doc(db, 'drivers', driverId));
    if (linkedUser) {
      batch.delete(doc(db, 'users', linkedUser.id));
    }
    await batch.commit();
    return true;
  }

  // --- Calcul de fiche de préparation (en mémoire) ---
  public computePreparationSheet(
    product: Product,
    proteinOptionOrOptions?: any,
    veggiesOption?: { label: string; extraPrice: number; extraGrams: number },
    baseChoice?: { label: string; extraPrice: number },
    supplements: Array<{ id?: string; supplementId?: string; quantity: number }> = [],
    specialInstructions?: string,
    allSupplementsMap: Map<string, Supplement> = new Map(),
    allIngredientsMap: Map<string, Ingredient> = new Map()
  ): {
    totalIngredients: PreparationIngredient[];
    ingredientConsumptions: PreparationIngredient[];
    summaryLines: string[];
    enrichedSupplements: any[];
    itemPrice: number;
    unitPrice: number;
    itemTotalPrice: number;
  } {
    let actualProteinOption: { label: string; extraPrice: number; extraGrams: number } | undefined = undefined;
    let actualVeggiesOption: { label: string; extraPrice: number; extraGrams: number } | undefined = undefined;
    let actualBaseChoice: { label: string; extraPrice: number } | undefined = undefined;
    let actualSupplements: Array<{ id?: string; supplementId?: string; quantity: number }> = [];
    let actualSpecialInstructions: string | undefined = undefined;
    let quantityMultiplier = 1;

    if (
      proteinOptionOrOptions &&
      typeof proteinOptionOrOptions === 'object' &&
      ('proteinOption' in proteinOptionOrOptions ||
        'supplements' in proteinOptionOrOptions ||
        'quantity' in proteinOptionOrOptions ||
        'baseChoice' in proteinOptionOrOptions ||
        'veggiesOption' in proteinOptionOrOptions)
    ) {
      actualProteinOption = proteinOptionOrOptions.proteinOption;
      actualVeggiesOption = proteinOptionOrOptions.veggiesOption;
      actualBaseChoice = proteinOptionOrOptions.baseChoice;
      actualSupplements = proteinOptionOrOptions.supplements || [];
      actualSpecialInstructions = proteinOptionOrOptions.specialInstructions;
      quantityMultiplier = Number(proteinOptionOrOptions.quantity) || 1;
    } else {
      actualProteinOption = proteinOptionOrOptions;
      actualVeggiesOption = veggiesOption;
      actualBaseChoice = baseChoice;
      actualSupplements = supplements || [];
      actualSpecialInstructions = specialInstructions;
      quantityMultiplier = 1;
    }

    const ingredientMap = new Map<string, { name: string; quantity: number; unit: string }>();

    // 1. Ingrédients de base
    const baseIngredientsList = product.baseIngredients || [];
    for (const base of baseIngredientsList) {
      const baseIng = allIngredientsMap.get(base.ingredientId);
      if (baseIng && baseIng.active === false) {
        throw new Error(`Le produit "${product.name}" ne peut pas être commandé car l'ingrédient de base "${baseIng.name}" est désactivé.`);
      }
      ingredientMap.set(base.ingredientId, {
        name: base.ingredientName,
        quantity: base.quantity,
        unit: base.unit
      });
    }

    // 2. Extra protéine
    if (actualProteinOption && actualProteinOption.extraGrams > 0) {
      const proteinBase = baseIngredientsList.find(b =>
        b.ingredientId.includes('poulet') ||
        b.ingredientId.includes('boeuf') ||
        b.ingredientId.includes('dinde') ||
        b.ingredientId.includes('saumon') ||
        b.ingredientId.includes('halloumi') ||
        b.ingredientId.includes('ing-1') ||
        b.ingredientId.includes('ing-2') ||
        b.ingredientId.includes('ing-3')
      );
      if (proteinBase) {
        const existing = ingredientMap.get(proteinBase.ingredientId);
        if (existing) existing.quantity += actualProteinOption.extraGrams;
      }
    }

    // 3. Extra légumes
    if (actualVeggiesOption && actualVeggiesOption.extraGrams > 0) {
      const veggiesBase = baseIngredientsList.find(b =>
        b.ingredientId.includes('legumes') || b.ingredientId.includes('ing-4') || b.ingredientId.includes('ing-5')
      );
      if (veggiesBase) {
        const existing = ingredientMap.get(veggiesBase.ingredientId);
        if (existing) existing.quantity += actualVeggiesOption.extraGrams;
      }
    }

    // 4. Choix de base
    if (actualBaseChoice && actualBaseChoice.label.includes('Quinoa')) {
      const riceBase = baseIngredientsList.find(b => b.ingredientId === 'ing-riz' || b.ingredientId === 'ing-6');
      if (riceBase) {
        const qty = riceBase.quantity;
        ingredientMap.delete(riceBase.ingredientId);
        ingredientMap.set('ing-quinoa', {
          name: 'Quinoa royal aux graines',
          quantity: qty,
          unit: 'g'
        });
      }
    } else if (actualBaseChoice && actualBaseChoice.label.includes('Patates douces')) {
      const riceBase = baseIngredientsList.find(b => b.ingredientId === 'ing-riz' || b.ingredientId === 'ing-6');
      if (riceBase) {
        const qty = riceBase.quantity;
        ingredientMap.delete(riceBase.ingredientId);
        ingredientMap.set('ing-patate-douce', {
          name: 'Patates douces rôties au romarin',
          quantity: qty,
          unit: 'g'
        });
      }
    } else if (actualBaseChoice && actualBaseChoice.label.includes('100% Légumes')) {
      const riceBase = baseIngredientsList.find(b => b.ingredientId === 'ing-riz' || b.ingredientId === 'ing-6' || b.ingredientId === 'ing-patate-douce');
      if (riceBase) {
        const qty = riceBase.quantity;
        ingredientMap.delete(riceBase.ingredientId);
        const leg = ingredientMap.get('ing-legumes') || ingredientMap.get('ing-5');
        if (leg) leg.quantity += qty;
      }
    }

    // 5. Suppléments
    const enrichedSupplements: any[] = [];
    let supplementsPrice = 0;

    for (const itemSup of actualSupplements) {
      const supId = itemSup.id || (itemSup as any).supplementId;
      const supDef = allSupplementsMap.get(supId);
      if (supDef && itemSup.quantity > 0) {
        if (!supDef.active) {
          throw new Error(`Le supplément "${supDef.name}" n'est plus actif au catalogue.`);
        }
        if (supDef.available === false || supDef.isAvailable === false) {
          throw new Error(`Le supplément "${supDef.name}" est actuellement indisponible.`);
        }
        const supIng = allIngredientsMap.get(supDef.ingredientId);
        if (supIng && supIng.active === false) {
          throw new Error(`Le supplément "${supDef.name}" n'est plus disponible car son ingrédient "${supIng.name}" est désactivé.`);
        }

        const totalSupQty = (supDef.quantityConsumed || supDef.quantity || 100) * itemSup.quantity;
        supplementsPrice += supDef.price * itemSup.quantity;

        const existing = ingredientMap.get(supDef.ingredientId);
        if (existing) {
          existing.quantity += totalSupQty;
        } else {
          ingredientMap.set(supDef.ingredientId, {
            name: supDef.ingredientName || supDef.name,
            quantity: totalSupQty,
            unit: supDef.unit || 'g'
          });
        }

        enrichedSupplements.push({
          supplementId: supDef.id,
          name: supDef.name,
          price: supDef.price,
          quantity: itemSup.quantity,
          ingredientId: supDef.ingredientId,
          ingredientName: supDef.ingredientName || supDef.name,
          quantityConsumed: totalSupQty,
          unit: supDef.unit || 'g'
        });
      }
    }

    const proteinExtraPrice = actualProteinOption ? (actualProteinOption.extraPrice || 0) : 0;
    const veggiesExtraPrice = actualVeggiesOption ? (actualVeggiesOption.extraPrice || 0) : 0;
    const baseExtraPrice = actualBaseChoice ? (actualBaseChoice.extraPrice || 0) : 0;
    const unitPrice = Math.round((product.basePrice + proteinExtraPrice + veggiesExtraPrice + baseExtraPrice + supplementsPrice) * 10) / 10;
    const itemTotalPrice = Math.round(unitPrice * quantityMultiplier * 10) / 10;

    const totalIngredients: PreparationIngredient[] = [];
    const ingredientConsumptions: PreparationIngredient[] = [];
    const summaryLines: string[] = [];

    ingredientMap.forEach((val, key) => {
      totalIngredients.push({
        ingredientId: key,
        ingredientName: val.name,
        totalQuantity: Math.round(val.quantity * 10) / 10,
        unit: val.unit
      });

      ingredientConsumptions.push({
        ingredientId: key,
        ingredientName: val.name,
        totalQuantity: Math.round(val.quantity * quantityMultiplier * 10) / 10,
        unit: val.unit
      });

      const icon = val.name.includes('Poulet')
        ? '🍗'
        : val.name.includes('Bœuf')
        ? '🥩'
        : val.name.includes('Dinde')
        ? '🍗'
        : val.name.includes('Saumon')
        ? '🐟'
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

      summaryLines.push(`${icon} ${val.name}: ${Math.round(val.quantity * quantityMultiplier)} ${val.unit}`);
    });

    if (actualSpecialInstructions && actualSpecialInstructions.trim()) {
      summaryLines.push(`⚠️ NOTE CLIENT: « ${actualSpecialInstructions.trim()} »`);
    }

    return {
      totalIngredients,
      ingredientConsumptions,
      summaryLines,
      enrichedSupplements,
      itemPrice: unitPrice,
      unitPrice,
      itemTotalPrice
    };
  }

  // --- Création Transactionnelle et Atomique d'une Commande ---
  public async createOrder(
    payload: {
      clientId?: string;
      client: { name: string; phone: string; deliveryAddress: string; notes?: string };
      items: Array<{
        productId: string;
        quantity: number;
        proteinOption?: { label: string; extraPrice: number; extraGrams: number };
        veggiesOption?: { label: string; extraPrice: number; extraGrams: number };
        baseChoice?: { label: string; extraPrice: number };
        supplements?: Array<{ id: string; quantity: number }>;
        specialInstructions?: string;
      }>;
    },
    idempotency?: {
      idempotencyKey?: string;
      callerId?: string;
      requestHash?: string;
    }
  ): Promise<{ order: Order; isExisting: boolean }> {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Le panier est vide.');
    }
    if (!payload.client || !payload.client.name || !payload.client.phone || !payload.client.deliveryAddress) {
      throw new Error('Veuillez renseigner le nom, téléphone et adresse de livraison.');
    }

    const db = this.getDb();

    return await runTransaction(db, async (transaction) => {
      // 1. VÉRIFICATION DU VERROU SYSTÈME
      const sysRef = doc(db, 'meta', 'system');
      const sysSnap = await transaction.get(sysRef);
      if (!sysSnap.exists() || sysSnap.data()?.state !== 'READY') {
        throw new SystemNotReadyError('Système temporairement indisponible (migration en cours ou maintenance).');
      }

      // 2. VÉRIFICATION DE L'IDEMPOTENCE (Idempotency-Key)
      let idemRef: any = null;
      if (idempotency?.idempotencyKey) {
        idemRef = doc(db, 'orderIdempotencyKeys', idempotency.idempotencyKey);
        const idemSnap = await transaction.get(idemRef);

        if (idemSnap.exists()) {
          const idemData = idemSnap.data() as any;

          // Comportement 3 : same key + different caller -> 403 Forbidden
          if (idemData.callerId !== idempotency.callerId) {
            throw new IdempotencyForbiddenError('Accès refusé : La clé d’idempotence appartient à un autre émetteur.');
          }

          // Comportement 2 : same key + same caller + different hash -> 422 Unprocessable Entity
          if (idemData.requestHash !== idempotency.requestHash) {
            throw new IdempotencyConflictError('Conflit d’idempotence : La clé fournie est associée à un contenu de commande différent.');
          }

          // Cas incohérent : enregistrement existant mais commande inexistante ou sans ID
          if (!idemData.orderId) {
            throw new IdempotencyInconsistencyError('Incohérence technique d’idempotence : enregistrement d’idempotence sans identifiant de commande.');
          }

          // Comportement 1 : same key + same caller + same hash -> retourner la commande existante
          const existingOrderRef = doc(db, 'orders', idemData.orderId);
          const existingOrderSnap = await transaction.get(existingOrderRef);
          if (!existingOrderSnap.exists()) {
            throw new IdempotencyInconsistencyError(`Incohérence technique d’idempotence : la commande #${idemData.orderId} référencée est introuvable.`);
          }

          return {
            order: existingOrderSnap.data() as Order,
            isExisting: true
          };
        }
      }

      // 3. LECTURE DU COMPTEUR DE COMMANDE
      const counterRef = doc(db, 'meta', 'counters');
      const counterSnap = await transaction.get(counterRef);
      const nextOrderSeq: number = counterSnap.exists() ? (counterSnap.data()?.nextOrderSeq || 1101) : 1101;

      // 4. COLLECTE ET LECTURE DE TOUS LES PRODUITS, SUPPLÉMENTS ET INGRÉDIENTS REQUIS
      const rawProductIds = Array.from(new Set(payload.items.map(it => it.productId)));
      const rawSupplementIds = Array.from(
        new Set(payload.items.flatMap(it => (it.supplements || []).map(s => s.id)).filter(Boolean))
      );

      // Lectures parallèles des produits et suppléments
      const productSnaps = await Promise.all(rawProductIds.map(pid => transaction.get(doc(db, 'products', pid))));
      const productsMap = new Map<string, Product>();
      productSnaps.forEach(snap => {
        if (snap.exists()) productsMap.set(snap.id, snap.data() as Product);
      });

      const supplementSnaps = await Promise.all(rawSupplementIds.map(sid => transaction.get(doc(db, 'supplements', sid))));
      const supplementsMap = new Map<string, Supplement>();
      supplementSnaps.forEach(snap => {
        if (snap.exists()) supplementsMap.set(snap.id, snap.data() as Supplement);
      });

      // Identifier tous les identifiants d'ingrédients nécessaires
      const neededIngredientIds = new Set<string>();
      productsMap.forEach(p => {
        (p.baseIngredients || []).forEach(bi => neededIngredientIds.add(bi.ingredientId));
      });
      supplementsMap.forEach(s => {
        if (s.ingredientId) neededIngredientIds.add(s.ingredientId);
      });
      // Ingrédients par défaut pour substitutions éventuelles
      neededIngredientIds.add('ing-quinoa');
      neededIngredientIds.add('ing-patate-douce');
      neededIngredientIds.add('ing-legumes');
      neededIngredientIds.add('ing-riz');

      const ingredientSnaps = await Promise.all(
        Array.from(neededIngredientIds).map(iid => transaction.get(doc(db, 'ingredients', iid)))
      );
      const ingredientsMap = new Map<string, Ingredient>();
      ingredientSnaps.forEach(snap => {
        if (snap.exists()) ingredientsMap.set(snap.id, snap.data() as Ingredient);
      });

      // TOUTES LES LECTURES FIRESTORE SONT EFFECTUÉES AVANT TOUTE ÉCRITURE
      // --- PHASE DE CALCUL & VALIDATION MÉTIER ---

      let subtotal = 0;
      const computedItems: OrderItem[] = [];
      const requiredStockMap = new Map<string, { ingredient: Ingredient; required: number }>();

      for (const rawItem of payload.items) {
        const product = productsMap.get(rawItem.productId);
        if (!product) {
          throw new Error(`Produit #${rawItem.productId} introuvable.`);
        }
        if (!product.active) {
          throw new Error(`Le produit "${product.name}" n'est plus actif au catalogue.`);
        }
        if (product.available === false || product.isAvailable === false) {
          throw new Error(`Le produit "${product.name}" est actuellement indisponible.`);
        }

        const prep = this.computePreparationSheet(
          product,
          rawItem.proteinOption,
          rawItem.veggiesOption,
          rawItem.baseChoice,
          rawItem.supplements || [],
          rawItem.specialInstructions,
          supplementsMap,
          ingredientsMap
        );

        const qty = Math.max(1, rawItem.quantity || 1);
        const itemTotalPrice = Math.round(prep.itemPrice * qty * 10) / 10;
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

        // Cumuler la consommation requise pour chaque ingrédient
        for (const ingredientUsage of prep.totalIngredients) {
          const totalNeeded = Math.round(ingredientUsage.totalQuantity * qty * 10) / 10;
          const ing = ingredientsMap.get(ingredientUsage.ingredientId);
          if (!ing) {
            throw new Error(`Ingrédient requis #${ingredientUsage.ingredientId} (${ingredientUsage.ingredientName}) introuvable dans le stock.`);
          }

          const existing = requiredStockMap.get(ing.id);
          if (existing) {
            existing.required = Math.round((existing.required + totalNeeded) * 10) / 10;
          } else {
            requiredStockMap.set(ing.id, {
              ingredient: ing,
              required: totalNeeded
            });
          }
        }
      }

      // 5. VÉRIFICATION STRICTE DE LA DISPONIBILITÉ DU STOCK
      const missingStockDetails: InsufficientStockDetail[] = [];
      requiredStockMap.forEach(({ ingredient, required }) => {
        const currentStock = Math.round(ingredient.currentStock * 10) / 10;
        if (currentStock < required) {
          const missing = Math.round((required - currentStock) * 10) / 10;
          missingStockDetails.push({
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            required,
            available: currentStock,
            missing,
            unit: ingredient.unit
          });
        }
      });

      if (missingStockDetails.length > 0) {
        throw new InsufficientStockError(missingStockDetails);
      }

      // 6. PRÉPARATION DE LA COMMANDE
      const orderNumber = `BEBBA-${nextOrderSeq}`;
      const trackingToken = 'tk_' + crypto.randomBytes(6).toString('hex');
      const orderId = 'ord-' + Date.now();
      const deliveryFee = 2.5;
      const totalAmount = Math.round((subtotal + deliveryFee) * 10) / 10;
      const now = new Date().toISOString();

      const newOrder: Order = {
        id: orderId,
        orderNumber: orderNumber,
        trackingToken: trackingToken,
        createdAt: now,
        clientId: payload.clientId ? payload.clientId.trim() : undefined,
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
        stockConsumed: true,
        paymentMethod: 'cash_on_delivery',
        paymentStatus: 'to_collect',
        statusHistory: [
          {
            status: 'received',
            label: 'Commande reçue & transmise à la cuisine',
            timestamp: now,
            note: 'Paiement à la livraison sélectionné',
            updatedBy: 'Système Client'
          }
        ]
      };

      // --- PHASE D'ÉCRITURE FIRESTORE (ATOMICITÉ TOTALE) ---

      // 6.1 Enregistrement de la commande
      transaction.set(doc(db, 'orders', orderId), stripUndefined(newOrder));

      // 6.2 Décrémentation du stock et création des mouvements
      requiredStockMap.forEach(({ ingredient, required }) => {
        const newStock = Math.round((ingredient.currentStock - required) * 10) / 10;
        transaction.update(doc(db, 'ingredients', ingredient.id), {
          currentStock: newStock,
          updatedAt: now
        });

        const movId = 'mov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
        const movement: StockMovement = {
          id: movId,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          type: 'order_consumption',
          quantity: -required,
          unit: ingredient.unit,
          orderId: newOrder.id,
          orderNumber: newOrder.orderNumber,
          notes: `Consommation automatique commande #${newOrder.orderNumber}`,
          timestamp: now,
          performedBy: 'Système BEBBA'
        };
        transaction.set(doc(db, 'stockMovements', movId), movement);
      });

      // 6.3 Enregistrement de la clé d'idempotence si fournie
      if (idemRef && idempotency) {
        transaction.set(idemRef, {
          key: idempotency.idempotencyKey,
          callerId: idempotency.callerId,
          requestHash: idempotency.requestHash,
          orderId: newOrder.id,
          createdAt: now
        });
      }

      // 6.4 Incrémentation atomique du compteur de commande
      transaction.set(counterRef, {
        nextOrderSeq: nextOrderSeq + 1,
        updatedAt: now
      });

      return {
        order: newOrder,
        isExisting: false
      };
    });
  }

  // --- Gestion des commandes ---
  public async getOrders(): Promise<Order[]> {
    const db = this.getDb();
    const snap = await getDocs(collection(db, 'orders'));
    const list: Order[] = [];
    snap.forEach(d => list.push(d.data() as Order));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getOrdersByClientId(clientId: string): Promise<Order[]> {
    if (!clientId) return [];
    const db = this.getDb();
    const snap = await getDocs(query(collection(db, 'orders'), where('clientId', '==', clientId)));
    const list: Order[] = [];
    snap.forEach(d => list.push(d.data() as Order));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async getOrderById(id: string): Promise<Order | undefined> {
    const db = this.getDb();
    const snap = await getDoc(doc(db, 'orders', id));
    return snap.exists() ? (snap.data() as Order) : undefined;
  }

  public async getOrderByTrackingToken(token: string): Promise<Order | undefined> {
    const db = this.getDb();
    const snap = await getDocs(query(collection(db, 'orders'), where('trackingToken', '==', token)));
    if (snap.empty) return undefined;
    return snap.docs[0].data() as Order;
  }

  public async getOrderByOrderNumberAndPhone(orderNumberRaw: string, phoneRaw: string): Promise<Order | undefined> {
    if (!orderNumberRaw || !phoneRaw || typeof orderNumberRaw !== 'string' || typeof phoneRaw !== 'string') {
      return undefined;
    }

    let cleanOrderNum = orderNumberRaw.trim().replace(/^#/, '').toUpperCase();
    if (/^\d+$/.test(cleanOrderNum)) {
      cleanOrderNum = `BEBBA-${cleanOrderNum}`;
    }

    const inputDigits = phoneRaw.replace(/\D/g, '');
    if (inputDigits.length < 8) return undefined;
    const inputLast8 = inputDigits.slice(-8);

    const db = this.getDb();
    const snap = await getDocs(query(collection(db, 'orders'), where('orderNumber', '==', cleanOrderNum)));
    if (snap.empty) return undefined;

    for (const docSnap of snap.docs) {
      const order = docSnap.data() as Order;
      const storedPhone = order.client?.phone || (order as any).phone || '';
      const storedDigits = storedPhone.replace(/\D/g, '');
      if (storedDigits.length >= 8 && storedDigits.slice(-8) === inputLast8) {
        return order;
      }
    }

    return undefined;
  }

  public async updateOrderStatus(params: {
    orderId: string;
    status: OrderStatus;
    updatedBy?: string;
    note?: string;
    assignedDriverId?: string;
  }): Promise<Order> {
    const db = this.getDb();
    const orderRef = doc(db, 'orders', params.orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) {
      throw new Error(`Commande #${params.orderId} introuvable.`);
    }

    const order = orderSnap.data() as Order;
    const previousStatus = order.status;

    if (previousStatus === params.status) {
      return order;
    }

    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      received: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['waiting_for_driver', 'cancelled'],
      waiting_for_driver: ['delivering', 'cancelled'],
      delivering: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };

    if (!allowedTransitions[previousStatus]?.includes(params.status)) {
      throw new Error(
        `Transition interdite : Impossible de passer du statut '${previousStatus}' au statut '${params.status}'.`
      );
    }

    if (params.status === 'delivering') {
      const driverIdToUse = params.assignedDriverId || order.assignedDriverId;
      if (!driverIdToUse) {
        throw new Error("Une commande ne peut pas passer en livraison sans attribution préalable d'un livreur.");
      }
      const driver = await this.getDriverById(driverIdToUse);
      if (!driver) throw new Error(`Livreur #${driverIdToUse} introuvable.`);
      if (driver.active === false) throw new Error(`Le livreur "${driver.name}" est désactivé.`);
      order.assignedDriverId = driver.id;
      order.assignedDriverName = driver.name;
    }

    // Gestion de la consommation du stock lors du passage à 'preparing' si non déjà consommé
    if (params.status === 'preparing' && !order.stockConsumed) {
      // Les commandes créées avec V2.2.4 consomment immédiatement à la création.
      // Pour toute commande rétrocompatible non consommée :
      const [allIngs, allSups] = await Promise.all([this.getIngredients(), this.getSupplements()]);
      const ingMap = new Map<string, Ingredient>();
      allIngs.forEach(i => ingMap.set(i.id, i));
      const supMap = new Map<string, Supplement>();
      allSups.forEach(s => supMap.set(s.id, s));

      const requiredStockMap = new Map<string, { ingredient: Ingredient; required: number }>();
      for (const item of order.items) {
        const qty = Math.max(1, item.quantity || 1);
        if (item.preparationSheet?.totalIngredients) {
          for (const ingUsage of item.preparationSheet.totalIngredients) {
            const needed = Math.round(ingUsage.totalQuantity * qty * 10) / 10;
            const ing = ingMap.get(ingUsage.ingredientId);
            if (ing) {
              const prev = requiredStockMap.get(ing.id);
              requiredStockMap.set(ing.id, {
                ingredient: ing,
                required: prev ? Math.round((prev.required + needed) * 10) / 10 : needed
              });
            }
          }
        }
      }

      // Vérification disponibilité
      for (const [, reqData] of requiredStockMap) {
        if (reqData.ingredient.currentStock < reqData.required) {
          throw new Error(`Stock insuffisant pour l'ingrédient ${reqData.ingredient.name}.`);
        }
      }

      // Déduction
      for (const [, reqData] of requiredStockMap) {
        await this.addStockMovement({
          ingredientId: reqData.ingredient.id,
          type: 'order_consumption',
          quantity: -reqData.required,
          notes: `Consommation préparation commande #${order.orderNumber}`,
          performedBy: params.updatedBy || 'Cuisine BEBBA',
          orderId: order.id,
          orderNumber: order.orderNumber
        });
      }
      order.stockConsumed = true;
    }

    const statusLabels: Record<OrderStatus, string> = {
      received: 'Commande reçue',
      preparing: 'En préparation en cuisine',
      ready: 'Commande prête & emballée',
      waiting_for_driver: 'En attente de livreur',
      delivering: 'En cours de livraison',
      delivered: 'Commande livrée au client',
      cancelled: 'Commande annulée'
    };

    if (params.status === 'ready') {
      order.statusHistory.push({
        status: 'ready',
        label: statusLabels.ready,
        timestamp: new Date().toISOString(),
        note: params.note || 'Plats préparés et emballés en sac thermique',
        updatedBy: params.updatedBy || 'Cuisine BEBBA'
      });

      order.status = 'waiting_for_driver';
      order.statusHistory.push({
        status: 'waiting_for_driver',
        label: statusLabels.waiting_for_driver,
        timestamp: new Date().toISOString(),
        note: "Placée automatiquement en attente d'attribution d'un livreur",
        updatedBy: 'Système BEBBA'
      });

      await setDoc(orderRef, order);
      return order;
    }

    order.status = params.status;

    if (params.status === 'delivered' && order.assignedDriverId) {
      const driver = await this.getDriverById(order.assignedDriverId);
      if (driver) {
        driver.totalDeliveries = (driver.totalDeliveries || 0) + 1;
        await updateDoc(doc(db, 'drivers', driver.id), {
          totalDeliveries: driver.totalDeliveries
        });
      }
    }

    order.statusHistory.push({
      status: params.status,
      label: statusLabels[params.status] || params.status,
      timestamp: new Date().toISOString(),
      note: params.note || '',
      updatedBy: params.updatedBy || 'Équipe BEBBA'
    });

    await setDoc(orderRef, order);
    return order;
  }

  public async assignDriver(orderId: string, driverId: string, updatedBy: string): Promise<Order> {
    const db = this.getDb();
    const orderRef = doc(db, 'orders', orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) throw new Error(`Commande #${orderId} introuvable.`);
    const order = snap.data() as Order;

    if (order.status === 'delivered' || order.status === 'cancelled') {
      throw new Error('Impossible de modifier l’affectation d’une commande clôturée ou annulée.');
    }

    const driver = await this.getDriverById(driverId);
    if (!driver) throw new Error(`Livreur #${driverId} introuvable.`);
    if (driver.active === false) {
      throw new Error(`Le livreur "${driver.name}" est désactivé et ne peut pas recevoir de nouvelle commande.`);
    }

    order.assignedDriverId = driver.id;
    order.assignedDriverName = driver.name;

    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status: order.status,
      label: `Livreur affecté : ${driver.name}`,
      timestamp: new Date().toISOString(),
      note: 'Affectation livreur mise à jour par l\'administrateur',
      updatedBy
    });

    await setDoc(orderRef, order);
    return order;
  }

  public async updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Promise<Order> {
    const db = this.getDb();
    const orderRef = doc(db, 'orders', orderId);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) throw new Error(`Commande #${orderId} introuvable.`);

    const order = snap.data() as Order;
    if (paymentStatus === 'paid' && order.status !== 'delivered') {
      throw new Error("Impossible d'encaisser une commande qui n'est pas encore livrée.");
    }

    order.paymentStatus = paymentStatus;
    await updateDoc(orderRef, { paymentStatus });
    return order;
  }

  // --- Dashboard Stats ---
  public async getDashboardStats(): Promise<DashboardStats> {
    const [orders, ingredients] = await Promise.all([this.getOrders(), this.getIngredients()]);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const todayOrders = orders.filter(o => o.createdAt.startsWith(todayStr));
    const todayRevenue = todayOrders.reduce((sum, o) => (o.status !== 'cancelled' ? sum + o.totalAmount : sum), 0);

    const statusCounts: Record<OrderStatus, number> = {
      received: 0,
      preparing: 0,
      ready: 0,
      waiting_for_driver: 0,
      delivering: 0,
      delivered: 0,
      cancelled: 0
    };

    let totalCollectedCash = 0;
    let pendingCashToCollect = 0;

    orders.forEach(o => {
      if (statusCounts[o.status] !== undefined) statusCounts[o.status]++;
      if (o.paymentStatus === 'paid') totalCollectedCash += o.totalAmount;
      else if (o.status !== 'cancelled') pendingCashToCollect += o.totalAmount;
    });

    const lowStockCount = ingredients.filter(i => i.currentStock <= i.minThreshold).length;

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

  // --- Users & Authentification ---
  public async getUsers(): Promise<User[]> {
    const db = this.getDb();
    const snap = await getDocs(collection(db, 'users'));
    const list: User[] = [];
    snap.forEach(d => list.push(d.data() as User));
    return list;
  }

  public async getUserById(id: string): Promise<User | undefined> {
    const db = this.getDb();
    const snap = await getDoc(doc(db, 'users', id));
    return snap.exists() ? (snap.data() as User) : undefined;
  }

  public async getUserByUsername(username: string): Promise<User | undefined> {
    if (!username || typeof username !== 'string') return undefined;
    const cleanUsername = username.trim().toLowerCase();
    const db = this.getDb();
    const snap = await getDocs(query(collection(db, 'users'), where('username', '==', cleanUsername)));
    if (snap.empty) return undefined;
    return snap.docs[0].data() as User;
  }

  public async getUserByPhone(phoneRaw: string): Promise<User | undefined> {
    const norm = normalizePhoneNumber(phoneRaw);
    if (!norm) return undefined;
    return await this.getClientByPhone(phoneRaw);
  }

  public async getClientByPhone(phoneRaw: string): Promise<User | undefined> {
    const norm = normalizePhoneNumber(phoneRaw);
    if (!norm) return undefined;
    const db = this.getDb();

    // 1. Recherche par clientPhoneIndex
    const indexSnap = await getDoc(doc(db, 'clientPhoneIndex', norm));
    if (indexSnap.exists()) {
      const userId = indexSnap.data()?.userId;
      if (userId) {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) return userSnap.data() as User;
      }
    }

    // 2. Recherche directe si l'index n'est pas encore synchronisé
    const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'client')));
    for (const docSnap of snap.docs) {
      const u = docSnap.data() as User;
      if (u.phone && normalizePhoneNumber(u.phone) === norm) {
        // Enregistrement différé dans l'index
        await setDoc(doc(db, 'clientPhoneIndex', norm), {
          userId: u.id,
          phone: u.phone,
          normalizedPhone: norm,
          name: u.name || '',
          createdAt: u.createdAt || new Date().toISOString()
        }).catch(() => {});
        return u;
      }
    }

    return undefined;
  }

  public async createClient(data: {
    name: string;
    phone: string;
    passwordHash: string;
    address?: string;
  }): Promise<User> {
    if (!data.name || !data.name.trim()) throw new Error('Le nom est obligatoire.');
    if (!data.phone || !data.phone.trim()) throw new Error('Le numéro de téléphone est obligatoire.');
    const norm = normalizePhoneNumber(data.phone);
    if (!norm) throw new Error('Numéro de téléphone invalide (au moins 8 chiffres requis).');
    if (!data.passwordHash) throw new Error('Le mot de passe haché est requis.');

    const db = this.getDb();

    // Unicité du téléphone chez les clients
    const existing = await this.getClientByPhone(data.phone);
    if (existing) {
      throw new Error('Un compte client avec ce numéro de téléphone existe déjà.');
    }

    const now = new Date().toISOString();
    const clientId = 'cli-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const clientUser: User = {
      id: clientId,
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: (data.address || '').trim(),
      passwordHash: data.passwordHash,
      role: 'client',
      active: true,
      createdAt: now,
      updatedAt: now
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', clientId), clientUser);
    batch.set(doc(db, 'clientPhoneIndex', norm), {
      userId: clientId,
      phone: data.phone.trim(),
      normalizedPhone: norm,
      name: data.name.trim(),
      createdAt: now
    });
    await batch.commit();

    return clientUser;
  }

  public async updateClientProfile(clientId: string, data: { name?: string; phone?: string; address?: string }): Promise<User> {
    const db = this.getDb();
    const userRef = doc(db, 'users', clientId);
    const snap = await getDoc(userRef);
    if (!snap.exists() || snap.data()?.role !== 'client') {
      throw new Error('Client introuvable.');
    }

    const user = snap.data() as User;
    const oldNormPhone = user.phone ? normalizePhoneNumber(user.phone) : null;
    let newNormPhone: string | null = null;

    if (data.name !== undefined) {
      if (!data.name.trim()) throw new Error('Le nom ne peut pas être vide.');
      user.name = data.name.trim();
    }

    if (data.phone !== undefined) {
      const norm = normalizePhoneNumber(data.phone);
      if (!norm) throw new Error('Numéro de téléphone invalide (au moins 8 chiffres requis).');
      const existing = await this.getClientByPhone(data.phone);
      if (existing && existing.id !== clientId) {
        throw new Error('Ce numéro de téléphone est déjà utilisé par un autre compte client.');
      }
      user.phone = data.phone.trim();
      newNormPhone = norm;
    }

    if (data.address !== undefined) {
      user.address = data.address.trim();
    }

    user.updatedAt = new Date().toISOString();

    const batch = writeBatch(db);
    batch.set(userRef, user);

    if (newNormPhone && newNormPhone !== oldNormPhone) {
      if (oldNormPhone) {
        batch.delete(doc(db, 'clientPhoneIndex', oldNormPhone));
      }
      batch.set(doc(db, 'clientPhoneIndex', newNormPhone), {
        userId: user.id,
        phone: user.phone,
        normalizedPhone: newNormPhone,
        name: user.name,
        createdAt: user.createdAt
      });
    }

    await batch.commit();
    return user;
  }

  public async saveUser(user: User): Promise<User> {
    const db = this.getDb();
    user.updatedAt = new Date().toISOString();
    if (!user.id) user.id = 'usr-' + Date.now();
    if (!user.createdAt) user.createdAt = new Date().toISOString();
    await setDoc(doc(db, 'users', user.id), user);
    return user;
  }

  public async updateUserLastLogin(id: string): Promise<void> {
    const db = this.getDb();
    await updateDoc(doc(db, 'users', id), {
      lastLoginAt: new Date().toISOString()
    }).catch(() => {});
  }

  public async deleteUser(id: string): Promise<boolean> {
    const db = this.getDb();
    const snap = await getDoc(doc(db, 'users', id));
    if (!snap.exists()) return false;
    const user = snap.data() as User;

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', id));
    if (user.role === 'client' && user.phone) {
      const norm = normalizePhoneNumber(user.phone);
      if (norm) batch.delete(doc(db, 'clientPhoneIndex', norm));
    }
    await batch.commit();
    return true;
  }
}

export const db = new DatabaseManager();
