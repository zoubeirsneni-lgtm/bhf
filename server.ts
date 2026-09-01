import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';
import {
  getJwtSecret,
  authenticateUser,
  requireRole,
  comparePassword,
  hashPassword,
  generateToken,
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

  // POST /api/auth/login (Public)
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        res.status(400).json({ error: 'Nom d’utilisateur et mot de passe requis.' });
        return;
      }

      const user = db.getUserByUsername(username);

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

  // POST /api/ingredients (Admin only)
  app.post('/api/ingredients', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const saved = db.saveIngredient(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/ingredients/:id (Admin only)
  app.put('/api/ingredients/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const ing = { ...req.body, id: req.params.id };
      const saved = db.saveIngredient(ing);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/ingredients/:id (Admin only)
  app.delete('/api/ingredients/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const success = db.deleteIngredient(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Manual Stock Adjustments (Admin only)
  app.post('/api/ingredients/:id/stock', authenticateUser, requireRole('admin'), (req: AuthenticatedRequest, res) => {
    try {
      const { type, quantity, notes } = req.body;
      if (typeof quantity !== 'number' || isNaN(quantity)) {
        res.status(400).json({ error: 'Quantité invalide.' });
        return;
      }
      const performer = req.user ? `${req.user.name} (Admin)` : 'Administrateur';
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

  // POST /api/drivers (Admin only)
  app.post('/api/drivers', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const saved = db.saveDriver(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // PUT /api/drivers/:id (Admin only)
  app.put('/api/drivers/:id', authenticateUser, requireRole('admin'), (req, res) => {
    try {
      const saved = db.saveDriver({ ...req.body, id: req.params.id });
      res.json(saved);
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

  // GET /api/orders/:id (Staff with IDOR protection)
  app.get('/api/orders/:id', authenticateUser, requireRole('admin', 'kitchen', 'driver'), (req: AuthenticatedRequest, res) => {
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

      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public Order Tracking by unique token (No auth required)
  app.get('/api/orders/track/:token', (req, res) => {
    try {
      const order = db.getOrderByTrackingToken(req.params.token);
      if (!order) {
        res.status(404).json({ error: 'Lien de suivi invalide ou commande introuvable.' });
        return;
      }

      // Safe public payload (avoids exposing private backend details while giving live status)
      const publicOrder = {
        id: order.id,
        orderNumber: order.orderNumber,
        trackingToken: order.trackingToken,
        createdAt: order.createdAt,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        clientName: order.client.name,
        deliveryAddress: order.client.deliveryAddress,
        items: order.items.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          itemTotalPrice: item.itemTotalPrice,
          proteinOption: item.proteinOption?.label,
          veggiesOption: item.veggiesOption?.label,
          baseChoice: item.baseChoice?.label,
          supplements: item.supplements.map(s => s.name),
          specialInstructions: item.specialInstructions
        })),
        statusHistory: order.statusHistory,
        assignedDriverName: order.assignedDriverName
      };

      res.json(publicOrder);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/orders (Public Client Order Creation)
  app.post('/api/orders', (req, res) => {
    try {
      const newOrder = db.createOrder(req.body);
      res.status(201).json(newOrder);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
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

      // Driver assignment can ONLY be performed by Admin
      const validAssignedDriverId = user.role === 'admin' ? assignedDriverId : undefined;

      const updated = db.updateOrderStatus({
        orderId: req.params.id,
        status,
        note,
        updatedBy: verifiedUpdatedBy,
        assignedDriverId: validAssignedDriverId
      });

      res.json(updated);
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

      // Kitchen is strictly forbidden from modifying payment
      if (user.role === 'kitchen') {
        res.status(403).json({ error: 'Accès refusé : La cuisine n’a pas l’autorisation de modifier le statut de paiement.' });
        return;
      }

      // Driver can only confirm payment for their assigned orders and when marked as paid
      if (user.role === 'driver') {
        if (!user.driverId || order.assignedDriverId !== user.driverId) {
          res.status(403).json({ error: 'Accès refusé : Cette commande ne vous est pas attribuée.' });
          return;
        }
        if (req.body.paymentStatus !== 'paid') {
          res.status(400).json({ error: 'Le livreur peut uniquement enregistrer le paiement reçu (paid).' });
          return;
        }
      }

      const { paymentStatus } = req.body;
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

