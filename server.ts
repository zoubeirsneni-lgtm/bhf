import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, normalizePhoneNumber } from './server/db';
import {
  getJwtSecret,
  authenticateUser,
  requireRole,
  comparePassword,
  hashPassword,
  generateToken,
  verifyToken,
  sanitizeUser,
  isValidStatusTransition,
  AuthenticatedRequest
} from './server/auth';

async function startServer() {
  // Ensure JWT_SECRET is configured; refuse to start if missing
  getJwtSecret();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Health check (Public)
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', brand: 'BEBBA Healthy Food', slogan: 'Vos Plats santé en un clic' });
  });

  // --- Authentication Routes ---

  // POST /api/auth/login (Public: Staff username/password or Client phone/password)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, phone, password } = req.body;

      if (!password || typeof password !== 'string') {
        res.status(400).json({ error: 'Mot de passe requis.' });
        return;
      }

      let user: any;

      // 1. Client : authentification par téléphone + mot de passe
      if (phone && typeof phone === 'string' && phone.trim()) {
        user = db.getClientByPhone(phone);
      }
      // 2. Utilisateurs internes (Admin, Cuisine, Livreur) : nom d’utilisateur + mot de passe
      else if (username && typeof username === 'string' && username.trim()) {
        user = db.getUserByUsername(username);
        // Les comptes clients n'ont pas de username et ne peuvent pas se connecter par ce mode
        if (user && user.role === 'client') {
          user = undefined;
        }
      } else {
        res.status(400).json({ error: 'Identifiant (téléphone pour client ou nom d’utilisateur pour le personnel) et mot de passe requis.' });
        return;
      }

      // Generic error response to prevent user enumeration
      if (!user || !user.active) {
        res.status(401).json({ error: 'Identifiants invalides.' });
        return;
      }

      const isPasswordValid = await comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        res.status(401).json({ error: 'Identifiants invalides.' });
        return;
      }

      // Update last login timestamp
      db.updateUserLastLogin(user.id);

      const safeUser = sanitizeUser(user);
      const token = generateToken(safeUser);

      res.json({
        token,
        user: safeUser
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erreur interne lors de la connexion.' });
    }
  });

  // POST /api/auth/register-client (Public: Client Self-Registration)
  app.post('/api/auth/register-client', async (req, res) => {
    try {
      const { name, phone, password, address } = req.body;

      // 1. Validation des champs obligatoires
      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Le nom est obligatoire.' });
        return;
      }
      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        res.status(400).json({ error: 'Le numéro de téléphone est obligatoire.' });
        return;
      }
      if (!password || typeof password !== 'string' || password.length < 4) {
        res.status(400).json({ error: 'Le mot de passe doit comporter au moins 4 caractères.' });
        return;
      }

      // 2. Normalisation du numéro de téléphone
      const normalizedPhone = normalizePhoneNumber(phone);
      if (!normalizedPhone) {
        res.status(400).json({ error: 'Numéro de téléphone invalide (au moins 8 chiffres requis).' });
        return;
      }

      // 3. Unicité du téléphone chez les clients
      const existingClient = db.getClientByPhone(phone);
      if (existingClient) {
        res.status(400).json({ error: 'Un compte client avec ce numéro de téléphone existe déjà.' });
        return;
      }

      // 4. Hachage sécurisé du mot de passe
      const passwordHash = await hashPassword(password);

      // 5. Création du compte client (ID généré serveur, rôle forcé à 'client')
      const newClient = db.createClient({
        name: name.trim(),
        phone: phone.trim(),
        address: typeof address === 'string' ? address.trim() : '',
        passwordHash
      });

      const safeUser = sanitizeUser(newClient);
      const token = generateToken(safeUser);

      res.status(201).json({
        token,
        user: safeUser
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Erreur lors de l’inscription client.' });
    }
  });

  // GET /api/auth/me (Protected by authenticateUser)
  app.get('/api/auth/me', authenticateUser, (req: AuthenticatedRequest, res) => {
    try {
      res.json({
        user: req.user
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Erreur lors de la récupération du profil.' });
    }
  });

  // POST /api/auth/logout (Public / Authenticated)
  app.post('/api/auth/logout', (req, res) => {
    res.json({ message: 'Déconnexion réussie.' });
  });

  // --- Categories Management ---
  // GET /api/categories (Public for menu browsing)
  app.get('/api/categories', (req, res) => {
    try {
      const activeOnly = req.query.activeOnly === 'true' || req.query.active === 'true';
      res.json(db.getCategories({ activeOnly }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/categories/:id
  app.get('/api/categories/:id', (req, res) => {
    try {
      const cat = db.getCategoryById(req.params.id);
      if (!cat) {
        res.status(404).json({ error: 'Catégorie non trouvée.' });
        return;
      }
      res.json(cat);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/categories (Admin only)
  app.post('/api/categories', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const saved = db.saveCategory(req.body);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/categories/:id (Admin only)
  app.put('/api/categories/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const category = { ...req.body, id: req.params.id };
      const saved = db.saveCategory(category);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/categories/:id (Admin only)
  app.delete('/api/categories/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const success = db.deleteCategory(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Products Management ---
  // GET /api/products (Public for catalog browsing)
  app.get('/api/products', (req, res) => {
    try {
      const categoryId = req.query.categoryId as string | undefined;
      const activeOnly = req.query.activeOnly === 'true' || req.query.active === 'true';
      const availableOnly = req.query.availableOnly === 'true' || req.query.available === 'true';
      res.json(db.getProducts({ categoryId, activeOnly, availableOnly }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/products/:id
  app.get('/api/products/:id', (req, res) => {
    try {
      const prod = db.getProductById(req.params.id);
      if (!prod) {
        res.status(404).json({ error: 'Produit non trouvé.' });
        return;
      }
      res.json(prod);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/products (Admin only)
  app.post('/api/products', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const saved = db.saveProduct(req.body);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/products/:id (Admin only)
  app.put('/api/products/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const prod = { ...req.body, id: req.params.id };
      const saved = db.saveProduct(prod);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/products/:id (Admin only)
  app.delete('/api/products/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const success = db.deleteProduct(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Supplements Management ---
  // GET /api/supplements (Public for menu customization)
  app.get('/api/supplements', (req, res) => {
    try {
      const activeOnly = req.query.activeOnly === 'true' || req.query.active === 'true';
      const availableOnly = req.query.availableOnly === 'true' || req.query.available === 'true';
      res.json(db.getSupplements({ activeOnly, availableOnly }));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/supplements/:id
  app.get('/api/supplements/:id', (req, res) => {
    try {
      const sup = db.getSupplementById(req.params.id);
      if (!sup) {
        res.status(404).json({ error: 'Supplément non trouvé.' });
        return;
      }
      res.json(sup);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/supplements (Admin only)
  app.post('/api/supplements', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const saved = db.saveSupplement(req.body);
      res.status(201).json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/supplements/:id (Admin only)
  app.put('/api/supplements/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const sup = { ...req.body, id: req.params.id };
      const saved = db.saveSupplement(sup);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/supplements/:id (Admin only)
  app.delete('/api/supplements/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const success = db.deleteSupplement(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Ingredients & Stock Management ---
  // GET /api/ingredients (Admin & Kitchen)
  app.get('/api/ingredients', authenticateUser, requireRole('admin', 'kitchen'), (req, res) => {
    try {
      res.json(db.getIngredients());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/ingredients (Admin & Kitchen)
  app.post('/api/ingredients', authenticateUser, requireRole('admin', 'kitchen'), (req, res) => {
    try {
      const saved = db.saveIngredient(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/ingredients/:id (Admin & Kitchen)
  app.put('/api/ingredients/:id', authenticateUser, requireRole('admin', 'kitchen'), (req, res) => {
    try {
      const ing = { ...req.body, id: req.params.id };
      const saved = db.saveIngredient(ing);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/ingredients/:id (Admin only - Protected against referenced ingredients)
  app.delete('/api/ingredients/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const success = db.deleteIngredient(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Manual Stock Adjustments / Restock (Admin & Kitchen)
  app.post('/api/ingredients/:id/stock', authenticateUser, requireRole('admin', 'kitchen'), (req: AuthenticatedRequest, res) => {
    try {
      const { type, quantity, notes } = req.body;
      if (typeof quantity !== 'number' || isNaN(quantity)) {
        res.status(400).json({ error: 'Quantité invalide.' });
        return;
      }
      const performer = req.user ? `${req.user.name} (${req.user.role === 'admin' ? 'Admin' : 'Cuisine'})` : 'Administrateur';
      const result = db.addStockMovement({
        ingredientId: req.params.id,
        type: type || 'manual_in',
        quantity: Number(quantity),
        notes: notes || 'Ajustement manuel de stock',
        performedBy: performer
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/stock-movements (Admin only)
  app.get('/api/stock-movements', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      res.json(db.getStockMovements());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Drivers Management ---
  // GET /api/drivers (Admin & Kitchen)
  app.get('/api/drivers', authenticateUser, requireRole('admin', 'kitchen'), (req, res) => {
    try {
      res.json(db.getDrivers());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/drivers (Admin only - Atomic Driver + User creation)
  app.post('/api/drivers', authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { name, phone, vehicle, username, password, active } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'Le nom du livreur est obligatoire.' });
        return;
      }
      if (!phone || typeof phone !== 'string' || !phone.trim()) {
        res.status(400).json({ error: 'Le numéro de téléphone du livreur est obligatoire.' });
        return;
      }
      if (!username || typeof username !== 'string' || !username.trim()) {
        res.status(400).json({ error: 'Le nom d’utilisateur (identifiant) est obligatoire.' });
        return;
      }
      if (!password || typeof password !== 'string' || password.length < 4) {
        res.status(400).json({ error: 'Le mot de passe doit comporter au moins 4 caractères.' });
        return;
      }

      // Hash password with bcrypt before persistence
      const passwordHash = await hashPassword(password);

      // Atomic creation in db
      const result = db.createDriverWithAccount({
        name,
        phone,
        vehicle: vehicle || 'Scooter standard',
        username,
        passwordHash,
        active: active !== false
      });

      res.status(201).json({
        driver: {
          ...result.driver,
          username: result.user.username
        },
        user: sanitizeUser(result.user)
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/drivers/:id (Admin only - Update business profile & sync User)
  app.put('/api/drivers/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const updated = db.updateDriverWithAccount(req.params.id, req.body);
      const user = db.getUserByDriverId(req.params.id);
      res.json({
        ...updated,
        username: user ? user.username : undefined
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PATCH /api/drivers/:id/status (Admin only - Synchronized active toggle for Driver AND User)
  app.patch('/api/drivers/:id/status', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const { active } = req.body;
      if (typeof active !== 'boolean') {
        res.status(400).json({ error: 'Le champ active (booléen) est requis.' });
        return;
      }

      const result = db.setDriverActiveStatus(req.params.id, active);
      res.json({
        success: true,
        driver: {
          ...result.driver,
          username: result.user ? result.user.username : undefined
        }
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PATCH /api/drivers/:id/password (Admin only - Reset driver password)
  app.patch('/api/drivers/:id/password', authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
        res.status(400).json({ error: 'Le nouveau mot de passe doit comporter au moins 4 caractères.' });
        return;
      }

      const passwordHash = await hashPassword(newPassword);
      db.resetDriverPassword(req.params.id, passwordHash);

      res.json({ success: true, message: 'Mot de passe réinitialisé avec succès.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/drivers/:id (Admin only - Safe delete with historical order protection)
  app.delete('/api/drivers/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const success = db.deleteDriver(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Suppliers Management ---
  // GET /api/suppliers (Admin only)
  app.get('/api/suppliers', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      res.json(db.getSuppliers());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/suppliers (Admin only)
  app.post('/api/suppliers', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const saved = db.saveSupplier(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/suppliers/:id (Admin only)
  app.put('/api/suppliers/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const saved = db.saveSupplier({ ...req.body, id: req.params.id });
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/suppliers/:id (Admin only)
  app.delete('/api/suppliers/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const success = db.deleteSupplier(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Users Management (Admin only) ---
  app.get('/api/users', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const users = db.getUsers().map(sanitizeUser);
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/users', authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { username, name, phone, password, role, driverId, active } = req.body;
      if (!username || !password || !role) {
        res.status(400).json({ error: 'Champs obligatoires manquants.' });
        return;
      }
      if (role === 'driver') {
        res.status(400).json({
          error: 'Les comptes livreurs doivent être créés via la gestion des livreurs.'
        });
        return;
      }
      if (role === 'client') {
        res.status(400).json({
          error: 'Les comptes clients doivent être créés via l’inscription client (/api/auth/register-client).'
        });
        return;
      }
      const existing = db.getUserByUsername(username);
      if (existing) {
        res.status(400).json({ error: 'Ce nom d’utilisateur est déjà utilisé.' });
        return;
      }
      const passwordHash = await hashPassword(password);
      const newUser = db.saveUser({
        id: 'usr-' + Date.now(),
        username: username.trim().toLowerCase(),
        name: name || username,
        phone: phone || '',
        passwordHash,
        role,
        driverId: role === 'driver' ? driverId : undefined,
        active: active !== false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      res.status(201).json(sanitizeUser(newUser));
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Orders Management & Role-Based Isolation ---

  // GET /api/orders (Staff: Admin, Kitchen, Driver with strict server-side isolation)
  app.get('/api/orders', authenticateUser, requireRole('admin', 'kitchen', 'driver'), (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const allOrders = db.getOrders();

      if (user.role === 'admin') {
        // Admin views all orders
        res.json(allOrders);
        return;
      }

      if (user.role === 'kitchen') {
        // Kitchen views all orders except cancelled (focus on received, preparing, ready, delivering, delivered)
        const kitchenOrders = allOrders.filter(o => o.status !== 'cancelled');
        res.json(kitchenOrders);
        return;
      }

      if (user.role === 'driver') {
        // Driver strictly views only orders assigned to their driverId
        const driverId = user.driverId;
        if (!driverId) {
          res.json([]);
          return;
        }
        const driverOrders = allOrders.filter(o => o.assignedDriverId === driverId);
        res.json(driverOrders);
        return;
      }

      res.status(403).json({ error: 'Accès non autorisé.' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/orders/:id (Staff & Client with IDOR protection)
  app.get('/api/orders/:id', authenticateUser, requireRole('admin', 'kitchen', 'driver', 'client'), (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const order = db.getOrderById(req.params.id);

      if (!order) {
        res.status(404).json({ error: 'Commande non trouvée.' });
        return;
      }

      // IDOR Protection: Drivers can ONLY access their own assigned order
      if (user.role === 'driver') {
        if (!user.driverId || order.assignedDriverId !== user.driverId) {
          res.status(403).json({ error: 'Accès refusé : Cette commande ne vous est pas attribuée.' });
          return;
        }
      }

      // IDOR Protection: Clients can ONLY access their own orders
      if (user.role === 'client') {
        if (!order.clientId || order.clientId !== user.id) {
          res.status(403).json({ error: 'Accès refusé : Vous ne pouvez pas accéder à cette commande.' });
          return;
        }
      }

      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper to format safe public payload (avoids exposing internal DB fields)
  function formatPublicOrder(order: any) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      trackingToken: order.trackingToken,
      createdAt: order.createdAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: order.totalAmount,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      client: {
        name: order.client?.name || '',
        phone: order.client?.phone || '',
        deliveryAddress: order.client?.deliveryAddress || '',
        notes: order.client?.notes || ''
      },
      clientName: order.client?.name || '',
      phone: order.client?.phone || '',
      deliveryAddress: order.client?.deliveryAddress || '',
      notes: order.client?.notes || '',
      items: (order.items || []).map((item: any) => ({
        productName: item.productName || item.product?.name || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemTotalPrice: item.itemTotalPrice,
        proteinOption: item.proteinOption?.label || item.proteinOption || null,
        veggiesOption: item.veggiesOption?.label || item.veggiesOption || null,
        baseChoice: item.baseChoice?.label || item.baseChoice || null,
        supplements: (item.supplements || []).map((s: any) => typeof s === 'string' ? s : (s.name || s.supplement?.name || '')),
        specialInstructions: item.specialInstructions || ''
      })),
      statusHistory: order.statusHistory || [],
      assignedDriverName: order.assignedDriverName || null
    };
  }

  // Rate Limiting in memory for Order Recovery endpoint (/api/orders/track-lookup)
  // Max 5 failed attempts per 10-minute window per IP
  interface LookupRateLimitEntry {
    failedAttempts: number;
    firstAttemptAt: number;
    blockedUntil?: number;
  }
  const lookupRateLimiter = new Map<string, LookupRateLimitEntry>();

  // Public Order Tracking by unique token (No auth required)
  app.get('/api/orders/track/:token', (req, res) => {
    try {
      const order = db.getOrderByTrackingToken(req.params.token);
      if (!order) {
        res.status(404).json({ error: 'Lien de suivi invalide ou commande introuvable.' });
        return;
      }

      res.json(formatPublicOrder(order));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/orders/track-lookup (Public Order Recovery with orderNumber + phone)
  app.post('/api/orders/track-lookup', (req, res) => {
    try {
      const clientIp = (req.ip || req.socket.remoteAddress || 'unknown').toString();
      const now = Date.now();
      const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
      const MAX_FAILED_ATTEMPTS = 5;

      const rateEntry = lookupRateLimiter.get(clientIp);

      if (rateEntry && rateEntry.blockedUntil && now < rateEntry.blockedUntil) {
        const remainingMinutes = Math.max(1, Math.ceil((rateEntry.blockedUntil - now) / 60000));
        res.status(429).json({
          error: `Trop de tentatives de recherche infructueuses. Par mesure de sécurité, veuillez patienter ${remainingMinutes} minute(s) avant de réessayer.`
        });
        return;
      }

      const { orderNumber, phone } = req.body || {};

      if (!orderNumber || !phone || typeof orderNumber !== 'string' || typeof phone !== 'string') {
        res.status(400).json({
          error: 'Impossible de retrouver cette commande. Vérifiez votre numéro de commande et votre numéro de téléphone.'
        });
        return;
      }

      const order = db.getOrderByOrderNumberAndPhone(orderNumber, phone);

      if (!order) {
        // Enregistrer l'échec pour le rate limiting
        const entry = rateEntry && (now - rateEntry.firstAttemptAt < WINDOW_MS)
          ? rateEntry
          : { failedAttempts: 0, firstAttemptAt: now };

        entry.failedAttempts += 1;
        if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
          entry.blockedUntil = now + WINDOW_MS;
        }
        lookupRateLimiter.set(clientIp, entry);

        res.status(404).json({
          error: 'Impossible de retrouver cette commande. Vérifiez votre numéro de commande et votre numéro de téléphone.'
        });
        return;
      }

      // Succès : réinitialiser les échecs pour cette IP
      lookupRateLimiter.delete(clientIp);

      res.json(formatPublicOrder(order));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/orders (Public Guest & Authenticated Client Order Creation)
  app.post('/api/orders', (req, res) => {
    try {
      // Identifier le client si un token JWT valide est fourni
      let authenticatedClientId: string | undefined = undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        const payload = verifyToken(token);
        if (payload && payload.id) {
          const user = db.getUserById(payload.id);
          if (user && user.active && user.role === 'client') {
            authenticatedClientId = user.id;
          }
        }
      }

      // Protection anti-spoofing : ignorer totalement tout clientId arbitraire envoyé dans le body
      const { clientId: _ignoredClientId, ...bodyWithoutClientId } = req.body || {};
      const orderPayload = {
        ...bodyWithoutClientId,
        clientId: authenticatedClientId
      };

      const newOrder = db.createOrder(orderPayload);
      res.status(201).json(newOrder);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // GET /api/client/orders (Protected: Client only)
  app.get('/api/client/orders', authenticateUser, requireRole('client'), (req: AuthenticatedRequest, res) => {
    try {
      const clientId = req.user!.id;
      const clientOrders = db.getOrdersByClientId(clientId);
      res.json(clientOrders);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH /api/orders/:id/status (Protected & strictly validated by role)
  app.patch('/api/orders/:id/status', authenticateUser, requireRole('admin', 'kitchen', 'driver'), (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const order = db.getOrderById(req.params.id);

      if (!order) {
        res.status(404).json({ error: 'Commande non trouvée.' });
        return;
      }

      // IDOR Protection: Drivers can only modify their own assigned orders
      if (user.role === 'driver') {
        if (!user.driverId || order.assignedDriverId !== user.driverId) {
          res.status(403).json({ error: 'Accès refusé : Cette commande ne vous est pas attribuée.' });
          return;
        }
      }

      const { status, note, assignedDriverId } = req.body;

      if (!status) {
        res.status(400).json({ error: 'Le champ statut est requis.' });
        return;
      }

      // Idempotency: if already in the requested status, cleanly return the order without side-effects
      if (order.status === status) {
        res.json(order);
        return;
      }

      // Check lifecycle transition permission for the current role
      if (!isValidStatusTransition(order.status, status, user.role)) {
        res.status(403).json({
          error: `Transition interdite : Le rôle '${user.role}' n'est pas autorisé à passer de '${order.status}' à '${status}'.`
        });
        return;
      }

      // Generate server-verified updatedBy string
      const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'kitchen' ? 'Cuisine' : 'Livreur';
      const verifiedUpdatedBy = `${user.name} (${roleLabel})`;

      // Driver assignment can ONLY be performed by Admin strictly upon transition to 'delivering'
      const validAssignedDriverId = (user.role === 'admin' && status === 'delivering') ? assignedDriverId : undefined;

      // Rule 4 & 5: Une commande ne doit passer en livraison qu'après attribution d'un livreur valide
      if (status === 'delivering') {
        const driverIdToUse = validAssignedDriverId || order.assignedDriverId;
        if (!driverIdToUse) {
          res.status(400).json({
            error: "Une commande ne peut pas passer en cours de livraison sans attribution préalable d'un livreur."
          });
          return;
        }
        const driver = db.getDrivers().find(d => d.id === driverIdToUse);
        if (!driver) {
          res.status(400).json({
            error: `Livreur #${driverIdToUse} introuvable.`
          });
          return;
        }
        if (driver.active === false) {
          res.status(400).json({
            error: `Le livreur "${driver.name}" est désactivé et ne peut pas recevoir de nouvelle commande.`
          });
          return;
        }
      }

      const updated = db.updateOrderStatus({
        orderId: req.params.id,
        status,
        note,
        updatedBy: verifiedUpdatedBy,
        assignedDriverId: validAssignedDriverId
      });

      res.json(updated);
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      res.status(statusCode).json({ error: err.message, details: err.details });
    }
  });

  // PATCH /api/orders/:id/assign-driver (Protected: Admin only)
  app.patch('/api/orders/:id/assign-driver', authenticateUser, requireRole('admin'), (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const order = db.getOrderById(req.params.id);

      if (!order) {
        res.status(404).json({ error: 'Commande non trouvée.' });
        return;
      }

      // Interdire la réaffectation sur commandes clôturées ou annulées
      if (order.status === 'delivered' || order.status === 'cancelled') {
        res.status(400).json({ error: 'Impossible de modifier l’affectation d’une commande clôturée ou annulée.' });
        return;
      }

      const targetDriverId = req.body.driverId || req.body.assignedDriverId;
      if (!targetDriverId) {
        res.status(400).json({ error: 'L’identifiant du livreur (driverId) est requis.' });
        return;
      }

      const driver = db.getDrivers().find(d => d.id === targetDriverId);
      if (!driver) {
        res.status(404).json({ error: `Livreur #${targetDriverId} introuvable.` });
        return;
      }

      if (driver.active === false) {
        res.status(400).json({
          error: `Le livreur "${driver.name}" est désactivé et ne peut pas recevoir de nouvelle commande.`
        });
        return;
      }

      // Préserver le statut actuel de la commande et mettre à jour le livreur affecté
      order.assignedDriverId = driver.id;
      order.assignedDriverName = driver.name;

      if (!order.statusHistory) {
        order.statusHistory = [];
      }
      order.statusHistory.push({
        status: order.status,
        label: `Livreur affecté : ${driver.name}`,
        timestamp: new Date().toISOString(),
        note: `Affectation livreur mise à jour par l'administrateur`,
        updatedBy: `${user.name} (Admin)`
      });

      (db as any).persist();

      res.json(order);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PATCH /api/orders/:id/payment (Protected: Admin or Assigned Driver only)
  app.patch('/api/orders/:id/payment', authenticateUser, (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user!;
      const order = db.getOrderById(req.params.id);

      if (!order) {
        res.status(404).json({ error: 'Commande non trouvée.' });
        return;
      }

      // Clients are strictly forbidden from modifying payment status
      if (user.role === 'client') {
        res.status(403).json({ error: 'Accès refusé : Les clients ne sont pas autorisés à modifier le statut de paiement.' });
        return;
      }

      // Kitchen is strictly forbidden from modifying payment
      if (user.role === 'kitchen') {
        res.status(403).json({ error: 'Accès refusé : La cuisine n’a pas l’autorisation de modifier le statut de paiement.' });
        return;
      }

      // Only admin and driver are permitted
      if (user.role !== 'admin' && user.role !== 'driver') {
        res.status(403).json({ error: 'Accès refusé : Vous n’avez pas l’autorisation de modifier le statut de paiement.' });
        return;
      }

      const { paymentStatus } = req.body;
      if (!paymentStatus || (paymentStatus !== 'paid' && paymentStatus !== 'to_collect')) {
        res.status(400).json({ error: 'Statut de paiement invalide.' });
        return;
      }

      // Strict Business Rule: ON NE PEUT ENCAISSER UNE COMMANDE QU'APRÈS CONFIRMATION DE SA LIVRAISON.
      // Even admin and assigned driver cannot set paymentStatus to 'paid' if order.status !== 'delivered'
      if (paymentStatus === 'paid' && order.status !== 'delivered') {
        res.status(400).json({ error: "Impossible d'encaisser une commande qui n'est pas encore livrée." });
        return;
      }

      // Driver can only confirm payment for their assigned orders and when marked as paid
      if (user.role === 'driver') {
        if (!user.driverId || order.assignedDriverId !== user.driverId) {
          res.status(403).json({ error: 'Accès refusé : Cette commande ne vous est pas attribuée.' });
          return;
        }
        if (paymentStatus !== 'paid') {
          res.status(400).json({ error: 'Le livreur peut uniquement enregistrer le paiement reçu (paid).' });
          return;
        }
      }

      const updated = db.updatePaymentStatus(req.params.id, paymentStatus);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dashboard Stats (Admin only)
  app.get('/api/stats', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      res.json(db.getDashboardStats());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset Demo Data (Admin only)
  app.post('/api/reset-demo-data', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const freshData = db.resetToDefaults();
      res.json({ message: 'Données de démonstration réinitialisées avec succès.', freshData });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Vite Middleware or Static Production Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BEBBA Healthy Food] Serveur démarré sur http://0.0.0.0:${PORT}`);
  });
}

startServer();

