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

class DatabaseManager {
  private data: DatabaseSchema;
  private isLoaded = false;

  constructor() {
    this.data = this.getDefaultData();
    this.init();
  }

  private getDefaultUsers(): User[] {
    const adminUsername = (process.env.INITIAL_ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const kitchenPassword = process.env.INITIAL_KITCHEN_PASSWORD;
    const driverPassword = process.env.INITIAL_DRIVER_PASSWORD;

    if (!adminPassword || adminPassword.trim() === '') {
      throw new Error("Variable d'environnement INITIAL_ADMIN_PASSWORD obligatoire manquante pour initialiser le compte administrateur.");
    }

    const now = new Date().toISOString();

    const users: User[] = [
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
      }
    ];

    if (kitchenPassword && kitchenPassword.trim() !== '') {
      users.push({
        id: 'usr-kitchen-1',
        username: 'cuisine',
        name: 'Chef de Cuisine BEBBA',
        phone: '+216 71 000 002',
        passwordHash: bcrypt.hashSync(kitchenPassword, 10),
        role: 'kitchen',
        active: true,
        createdAt: now,
        updatedAt: now
      });
    }

    if (driverPassword && driverPassword.trim() !== '') {
      users.push(
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
      );
    }

    return users;
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
      users: [],
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

        // Ensure default categories, ingredients, supplements, and products are present
        let dataUpdated = false;

        initialCategories.forEach(cat => {
          if (!this.data.categories.some(c => c.id === cat.id)) {
            this.data.categories.push(cat);
            dataUpdated = true;
          }
        });

        initialIngredients.forEach(ing => {
          if (!this.data.ingredients.some(i => i.id === ing.id)) {
            this.data.ingredients.push(ing);
            dataUpdated = true;
          }
        });

        initialSupplements.forEach(sup => {
          if (!this.data.supplements.some(s => s.id === sup.id)) {
            this.data.supplements.push(sup);
            dataUpdated = true;
          }
        });

        initialProducts.forEach(prod => {
          if (!this.data.products.some(p => p.id === prod.id)) {
            this.data.products.push(prod);
            dataUpdated = true;
          }
        });

        // If users collection does not exist or is empty in db.json, initialize with default users
        if (!this.data.users || this.data.users.length === 0) {
          this.data.users = this.getDefaultUsers();
          dataUpdated = true;
        } else {
          this.data.users.forEach(u => {
            if (u.role === 'driver' && !u.driverId) {
              if (u.username === 'livreur1') { u.driverId = 'drv-1'; dataUpdated = true; }
              else if (u.username === 'livreur2') { u.driverId = 'drv-2'; dataUpdated = true; }
              else if (u.username === 'livreur3') { u.driverId = 'drv-3'; dataUpdated = true; }
            }
          });
        }

        if (dataUpdated) {
          this.persist();
        }
      } else {
        // Fresh database creation: initialize with default users from environment
        this.data.users = this.getDefaultUsers();
        this.persist();
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('[DB Initialization Error]:', err);
      throw err;
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
      throw err;
    }
  }

  public resetToDefaults() {
    this.data = this.getDefaultData();
    this.data.users = this.getDefaultUsers();
    this.persist();
    return this.data;
  }

  // --- Categories ---
  public getCategories(options?: { activeOnly?: boolean }): Category[] {
    let cats = [...this.data.categories];
    if (options?.activeOnly) {
      cats = cats.filter(c => c.active);
    }
    return cats.sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : (a.order || 0);
      const orderB = b.sortOrder !== undefined ? b.sortOrder : (b.order || 0);
      return orderA - orderB;
    });
  }

  public getCategoryById(id: string): Category | undefined {
    return this.data.categories.find(c => c.id === id);
  }

  public saveCategory(category: Partial<Category> & { name: string }): Category {
    if (!category.name || typeof category.name !== 'string' || !category.name.trim()) {
      throw new Error('Le nom de la catégorie est obligatoire.');
    }

    const now = new Date().toISOString();
    const sortOrder = category.sortOrder !== undefined ? Number(category.sortOrder) : (category.order !== undefined ? Number(category.order) : this.data.categories.length + 1);
    const slug = category.slug || category.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const completeCategory: Category = {
      id: category.id || 'cat-' + Date.now(),
      name: category.name.trim(),
      slug: slug || 'cat-item',
      icon: category.icon || 'Utensils',
      image: category.image || category.imageUrl || '',
      imageUrl: category.imageUrl || category.image || '',
      description: category.description || '',
      active: category.active !== false,
      order: sortOrder,
      sortOrder: sortOrder,
      createdAt: category.createdAt || now,
      updatedAt: now
    };

    const idx = this.data.categories.findIndex(c => c.id === completeCategory.id);
    if (idx >= 0) {
      completeCategory.createdAt = this.data.categories[idx].createdAt || now;
      this.data.categories[idx] = completeCategory;
    } else {
      this.data.categories.push(completeCategory);
    }

    this.persist();
    return completeCategory;
  }

  public deleteCategory(id: string): boolean {
    // Check if any product is assigned to this category
    const hasProducts = this.data.products.some(p => p.categoryId === id);
    if (hasProducts) {
      throw new Error('Impossible de supprimer cette catégorie car des produits y sont rattachés.');
    }

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
      if (!ingredient.createdAt) ingredient.createdAt = new Date().toISOString();
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
    type: StockMovement['type'] | 'order_cancellation';
    quantity: number;
    notes: string;
    performedBy?: string;
    orderId?: string;
    orderNumber?: string;
    skipPersist?: boolean;
  }): { ingredient: Ingredient; movement: StockMovement } {
    const ing = this.getIngredientById(params.ingredientId);
    if (!ing) {
      throw new Error(`Ingrédient #${params.ingredientId} introuvable.`);
    }

    ing.currentStock = Math.round((ing.currentStock + params.quantity) * 10) / 10;
    ing.updatedAt = new Date().toISOString();

    const movement: StockMovement = {
      id: 'mov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
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

    this.data.stockMovements.unshift(movement);
    if (!params.skipPersist) {
      this.persist();
    }
    return { ingredient: ing, movement };
  }

  public getStockMovements(): StockMovement[] {
    return this.data.stockMovements;
  }

  // --- Supplements ---
  public getSupplements(options?: { activeOnly?: boolean; availableOnly?: boolean }): Supplement[] {
    let list = [...this.data.supplements];
    if (options?.activeOnly) {
      list = list.filter(s => s.active);
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

  public getSupplementById(id: string): Supplement | undefined {
    return this.data.supplements.find(s => s.id === id);
  }

  public saveSupplement(sup: Partial<Supplement> & { name: string; price: number }): Supplement {
    if (!sup.name || typeof sup.name !== 'string' || !sup.name.trim()) {
      throw new Error('Le nom du supplément est obligatoire.');
    }
    if (typeof sup.price !== 'number' || isNaN(sup.price) || sup.price < 0) {
      throw new Error('Le prix du supplément doit être un nombre positif.');
    }

    const now = new Date().toISOString();
    const sortOrder = sup.sortOrder !== undefined ? Number(sup.sortOrder) : (sup.order !== undefined ? Number(sup.order) : this.data.supplements.length + 1);
    const quantityConsumed = sup.quantityConsumed !== undefined ? Number(sup.quantityConsumed) : (sup.quantity !== undefined ? Number(sup.quantity) : 100);

    const ing = sup.ingredientId ? this.getIngredientById(sup.ingredientId) : undefined;
    const isAvailable = sup.available !== false && sup.isAvailable !== false;

    const completeSup: Supplement = {
      id: sup.id || 'sup-' + Date.now(),
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
      createdAt: sup.createdAt || now,
      updatedAt: now
    };

    const idx = this.data.supplements.findIndex(s => s.id === completeSup.id);
    if (idx >= 0) {
      completeSup.createdAt = this.data.supplements[idx].createdAt || now;
      this.data.supplements[idx] = completeSup;
    } else {
      this.data.supplements.push(completeSup);
    }

    this.persist();
    return completeSup;
  }

  public deleteSupplement(id: string): boolean {
    const initialLen = this.data.supplements.length;
    this.data.supplements = this.data.supplements.filter(s => s.id !== id);
    if (this.data.supplements.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
  }

  // --- Products ---
  public getProducts(options?: { categoryId?: string; activeOnly?: boolean; availableOnly?: boolean }): Product[] {
    let prods = [...this.data.products];
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

  public getProductById(id: string): Product | undefined {
    return this.data.products.find(p => p.id === id);
  }

  public saveProduct(prod: Partial<Product> & { name: string; basePrice: number; categoryId: string }): Product {
    if (!prod.name || typeof prod.name !== 'string' || !prod.name.trim()) {
      throw new Error('Le nom du produit est obligatoire.');
    }
    if (typeof prod.basePrice !== 'number' || isNaN(prod.basePrice) || prod.basePrice < 0) {
      throw new Error('Le prix de base du produit doit être un nombre positif.');
    }
    if (!prod.categoryId) {
      throw new Error('La catégorie du produit est obligatoire.');
    }

    const now = new Date().toISOString();
    const sortOrder = prod.sortOrder !== undefined ? Number(prod.sortOrder) : (prod.order !== undefined ? Number(prod.order) : this.data.products.length + 1);
    const isAvailable = prod.available !== false && prod.isAvailable !== false;

    const completeProduct: Product = {
      id: prod.id || 'prod-' + Date.now(),
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
      createdAt: prod.createdAt || now,
      updatedAt: now,
      baseIngredients: Array.isArray(prod.baseIngredients) ? prod.baseIngredients : [],
      customization: prod.customization || {
        allowedSupplementIds: []
      }
    };

    const idx = this.data.products.findIndex(p => p.id === completeProduct.id);
    if (idx >= 0) {
      completeProduct.createdAt = this.data.products[idx].createdAt || now;
      this.data.products[idx] = completeProduct;
    } else {
      this.data.products.push(completeProduct);
    }

    this.persist();
    return completeProduct;
  }

  public deleteProduct(id: string): boolean {
    const initialLen = this.data.products.length;
    this.data.products = this.data.products.filter(p => p.id !== id);
    if (this.data.products.length !== initialLen) {
      this.persist();
      return true;
    }
    return false;
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
    productOrId: Product | string,
    proteinOptionOrOptions?: any,
    veggiesOption?: { label: string; extraPrice: number; extraGrams: number },
    baseChoice?: { label: string; extraPrice: number },
    supplements: Array<{ id?: string; supplementId?: string; quantity: number }> = [],
    specialInstructions?: string
  ): {
    totalIngredients: PreparationIngredient[];
    ingredientConsumptions: PreparationIngredient[];
    summaryLines: string[];
    enrichedSupplements: any[];
    itemPrice: number;
    unitPrice: number;
    itemTotalPrice: number;
  } {
    const product: Product | undefined =
      typeof productOrId === 'string'
        ? this.getProductById(productOrId)
        : productOrId;

    if (!product) {
      throw new Error(`Produit introuvable pour la préparation.`);
    }

    let actualProteinOption: { label: string; extraPrice: number; extraGrams: number } | undefined = undefined;
    let actualVeggiesOption: { label: string; extraPrice: number; extraGrams: number } | undefined = undefined;
    let actualBaseChoice: { label: string; extraPrice: number } | undefined = undefined;
    let actualSupplements: Array<{ id?: string; supplementId?: string; quantity: number }> = [];
    let actualSpecialInstructions: string | undefined = undefined;
    let quantityMultiplier = 1;

    // Check if options passed as single configuration object
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

    // 1. Base recipe ingredients (safe array fallback)
    const baseIngredientsList = product.baseIngredients || [];
    for (const base of baseIngredientsList) {
      ingredientMap.set(base.ingredientId, {
        name: base.ingredientName,
        quantity: base.quantity,
        unit: base.unit
      });
    }

    // 2. Extra protein option grams
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
        if (existing) {
          existing.quantity += actualProteinOption.extraGrams;
        }
      }
    }

    // 3. Extra veggies option grams
    if (actualVeggiesOption && actualVeggiesOption.extraGrams > 0) {
      const veggiesBase = baseIngredientsList.find(b =>
        b.ingredientId.includes('legumes') || b.ingredientId.includes('ing-4') || b.ingredientId.includes('ing-5')
      );
      if (veggiesBase) {
        const existing = ingredientMap.get(veggiesBase.ingredientId);
        if (existing) {
          existing.quantity += actualVeggiesOption.extraGrams;
        }
      }
    }

    // 4. Base choice replacements if applicable
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
        if (leg) {
          leg.quantity += qty;
        }
      }
    }

    // 5. Supplements calculation & stock tracking
    const enrichedSupplements: any[] = [];
    let supplementsPrice = 0;

    for (const itemSup of actualSupplements) {
      const supId = itemSup.id || (itemSup as any).supplementId;
      const supDef = this.getSupplements().find(s => s.id === supId);
      if (supDef && itemSup.quantity > 0) {
        if (!supDef.active) {
          throw new Error(`Le supplément "${supDef.name}" n'est plus actif au catalogue.`);
        }
        if (supDef.available === false || supDef.isAvailable === false) {
          throw new Error(`Le supplément "${supDef.name}" est actuellement indisponible.`);
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

    // Calculate unit price and total item price
    const proteinExtraPrice = actualProteinOption ? (actualProteinOption.extraPrice || 0) : 0;
    const veggiesExtraPrice = actualVeggiesOption ? (actualVeggiesOption.extraPrice || 0) : 0;
    const baseExtraPrice = actualBaseChoice ? (actualBaseChoice.extraPrice || 0) : 0;
    const unitPrice = Math.round((product.basePrice + proteinExtraPrice + veggiesExtraPrice + baseExtraPrice + supplementsPrice) * 10) / 10;
    const itemTotalPrice = Math.round(unitPrice * quantityMultiplier * 10) / 10;

    // Formatted list for single unit & total consumed
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

  // --- Create Order ---
  public createOrder(payload: {
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
  }): Order {
    if (!payload.items || payload.items.length === 0) {
      throw new Error('Le panier est vide.');
    }
    if (!payload.client || !payload.client.name || !payload.client.phone || !payload.client.deliveryAddress) {
      throw new Error('Veuillez renseigner le nom, téléphone et adresse de livraison.');
    }

    let subtotal = 0;
    const computedItems: OrderItem[] = [];

    // 1. Valider tous les articles et calculer la fiche de préparation (sans déduire de stock)
    for (const rawItem of payload.items) {
      const product = this.getProductById(rawItem.productId);
      if (!product) {
        throw new Error(`Produit #${rawItem.productId} introuvable.`);
      }

      // Check product active status
      if (!product.active) {
        throw new Error(`Le produit "${product.name}" n'est plus actif au catalogue.`);
      }

      // Check product availability
      if (product.available === false || product.isAvailable === false) {
        throw new Error(`Le produit "${product.name}" est actuellement indisponible / en rupture de stock.`);
      }

      const prep = this.computePreparationSheet(
        product,
        rawItem.proteinOption,
        rawItem.veggiesOption,
        rawItem.baseChoice,
        rawItem.supplements || [],
        rawItem.specialInstructions
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
    }

    // 2. Création de la commande : Statut 'received', stock STRICTEMENT INCHANGÉ, AUCUN mouvement créé
    const orderSeq = this.data.nextOrderSeq++;
    const orderNumber = `BEBBA-${orderSeq}`;
    const trackingToken = 'tk_' + crypto.randomBytes(6).toString('hex');
    const orderId = 'ord-' + Date.now();

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
      stockConsumed: false,
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

    const previousStatus = order.status;

    // Règle d'idempotence : si le statut demandé est identique au statut actuel,
    // ignorer proprement et renvoyer la commande sans effet de bord ni doublon d'historique
    if (previousStatus === params.status) {
      return order;
    }

    // RÈGLES DE TRANSITION DU WORKFLOW STRICT (Bloc B) :
    // Workflow cible : Reçue → En préparation → Prête → En attente de livreur → En cours de livraison → Livrée
    // Interdictions absolues :
    // - Sauter une étape est strictement interdit
    // - Revenir en arrière est strictement interdit
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
        `Transition interdite : Impossible de passer du statut '${previousStatus}' au statut '${params.status}'. Le saut d'étape et le retour en arrière sont strictement interdits.`
      );
    }

    // RÈGLE 4 : En attente de livreur → En cours de livraison
    // Une commande ne doit passer en livraison qu'après attribution d'un livreur
    if (params.status === 'delivering') {
      const driverIdToUse = params.assignedDriverId || order.assignedDriverId;
      if (!driverIdToUse) {
        throw new Error("Une commande ne peut pas passer en cours de livraison sans attribution préalable d'un livreur.");
      }
      const driver = this.data.drivers.find(d => d.id === driverIdToUse);
      if (!driver) {
        throw new Error(`Livreur #${driverIdToUse} introuvable.`);
      }
      order.assignedDriverId = driver.id;
      order.assignedDriverName = driver.name;
    }

    // --- CONSOMMATION DU STOCK AU PASSAGE 'Reçue' -> 'En préparation' ---
    if (params.status === 'preparing') {
      const alreadyConsumed = order.stockConsumed === true || this.data.stockMovements.some(
        m => m.orderId === order.id && m.type === 'order_consumption'
      );

      // Protection stricte contre double consommation
      if (!alreadyConsumed && previousStatus !== 'preparing') {
        // 1. Calculer la totalité des besoins en matières premières de la commande
        const requiredStockMap = new Map<string, { ingredient: Ingredient; required: number }>();

        for (const item of order.items) {
          const qty = Math.max(1, item.quantity || 1);
          let prepIngredients = item.preparationSheet?.totalIngredients;

          // Si la fiche n'est pas déjà présente, calculer via computePreparationSheet
          if (!prepIngredients || prepIngredients.length === 0) {
            const product = this.getProductById(item.productId);
            if (product) {
              const prep = this.computePreparationSheet(
                product,
                item.proteinOption,
                item.veggiesOption,
                item.baseChoice,
                item.supplements,
                item.specialInstructions
              );
              item.preparationSheet = {
                totalIngredients: prep.totalIngredients,
                summaryLines: prep.summaryLines
              };
              prepIngredients = prep.totalIngredients;
            }
          }

          if (prepIngredients) {
            for (const ingredientUsage of prepIngredients) {
              const totalNeeded = Math.round(ingredientUsage.totalQuantity * qty * 10) / 10;
              const ing = this.getIngredientById(ingredientUsage.ingredientId);
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
        }

        // 2. Vérification STRICTE et ATOMIQUE de la disponibilité AVANT toute déduction
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
          // L'opération est atomique :
          // - La commande reste strictement à son statut précédent (ex: 'received')
          // - Aucune quantité de stock n'est modifiée
          // - Aucun mouvement de consommation n'est créé
          // - Aucune déduction partielle n'est autorisée
          throw new InsufficientStockError(missingStockDetails);
        }

        // 3. TOUS les ingrédients sont disponibles : déduction en mémoire et mouvements (sans persistance intermédiaire)
        const backupIngredients: Array<{ ing: Ingredient; originalStock: number; originalUpdatedAt: string }> = [];
        const createdMovements: StockMovement[] = [];

        try {
          for (const item of order.items) {
            const qty = Math.max(1, item.quantity || 1);
            if (item.preparationSheet?.totalIngredients) {
              for (const ingredientUsage of item.preparationSheet.totalIngredients) {
                const totalUsed = Math.round(ingredientUsage.totalQuantity * qty * 10) / 10;
                const ing = this.getIngredientById(ingredientUsage.ingredientId);
                if (!ing) {
                  throw new Error(`Ingrédient requis #${ingredientUsage.ingredientId} (${ingredientUsage.ingredientName}) introuvable dans le stock.`);
                }

                if (!backupIngredients.some(b => b.ing.id === ing.id)) {
                  backupIngredients.push({
                    ing,
                    originalStock: ing.currentStock,
                    originalUpdatedAt: ing.updatedAt
                  });
                }

                const res = this.addStockMovement({
                  ingredientId: ingredientUsage.ingredientId,
                  type: 'order_consumption',
                  quantity: -totalUsed,
                  notes: `Préparation commande #${order.orderNumber} (${item.productName} x${qty})`,
                  performedBy: params.updatedBy || 'Cuisine BEBBA',
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                  skipPersist: true
                });
                createdMovements.push(res.movement);
              }
            }
          }

          order.stockConsumed = true;
        } catch (err) {
          // ROLLBACK ATOMIQUE EN CAS D'ERREUR PENDANT LA CONSOMMATION
          for (const b of backupIngredients) {
            b.ing.currentStock = b.originalStock;
            b.ing.updatedAt = b.originalUpdatedAt;
          }
          if (createdMovements.length > 0) {
            const createdIds = new Set(createdMovements.map(m => m.id));
            this.data.stockMovements = this.data.stockMovements.filter(m => !createdIds.has(m.id));
          }
          order.stockConsumed = false;
          order.status = previousStatus;
          throw err;
        }
      }
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

    // RÈGLE 3 : Prête → En attente de livreur
    // Après le passage d'une commande à 'ready', le système bascule AUTOMATIQUEMENT la commande
    // en 'waiting_for_driver' dans TOUS LES CAS (même lorsqu'un livreur est disponible).
    // Cette étape ne doit pas consommer de stock.
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
        note: 'Placée automatiquement en attente d\'attribution d\'un livreur',
        updatedBy: 'Système BEBBA'
      });

      this.persist();
      return order;
    }

    order.status = params.status;

    // RÈGLE 5 : En cours de livraison → Livrée
    // Le livreur confirme que la commande a physiquement été remise au client.
    // Cette étape ne signifie PAS automatiquement que le paiement est encaissé (Bloc C).
    if (params.status === 'delivered') {
      if (order.assignedDriverId) {
        const driver = this.data.drivers.find(d => d.id === order.assignedDriverId);
        if (driver) {
          driver.totalDeliveries = (driver.totalDeliveries || 0) + 1;
        }
      }
    }

    // RÈGLE 8 : En cas d'annulation ('cancelled'), NE PAS restaurer automatiquement le stock
    // (qu'elle soit annulée avant ou après préparation). Pas de mouvement inverse automatique.

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
      waiting_for_driver: 0,
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
