import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API Routes ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', brand: 'BEBBA Healthy Food', slogan: 'Vos Plats santé en un clic' });
  });

  // Categories
  app.get('/api/categories', (req, res) => {
    try {
      res.json(db.getCategories());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/categories', (req, res) => {
    try {
      const saved = db.saveCategory(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/categories/:id', (req, res) => {
    try {
      const category = { ...req.body, id: req.params.id };
      const saved = db.saveCategory(category);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/categories/:id', (req, res) => {
    try {
      const success = db.deleteCategory(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Products
  app.get('/api/products', (req, res) => {
    try {
      res.json(db.getProducts());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/products', (req, res) => {
    try {
      const saved = db.saveProduct(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/products/:id', (req, res) => {
    try {
      const prod = { ...req.body, id: req.params.id };
      const saved = db.saveProduct(prod);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/products/:id', (req, res) => {
    try {
      const success = db.deleteProduct(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Supplements
  app.get('/api/supplements', (req, res) => {
    try {
      res.json(db.getSupplements());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/supplements', (req, res) => {
    try {
      const saved = db.saveSupplement(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/supplements/:id', (req, res) => {
    try {
      const sup = { ...req.body, id: req.params.id };
      const saved = db.saveSupplement(sup);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/supplements/:id', (req, res) => {
    try {
      const success = db.deleteSupplement(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Ingredients (Matières premières)
  app.get('/api/ingredients', (req, res) => {
    try {
      res.json(db.getIngredients());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/ingredients', (req, res) => {
    try {
      const saved = db.saveIngredient(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/ingredients/:id', (req, res) => {
    try {
      const ing = { ...req.body, id: req.params.id };
      const saved = db.saveIngredient(ing);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/ingredients/:id', (req, res) => {
    try {
      const success = db.deleteIngredient(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Stock Adjustments
  app.post('/api/ingredients/:id/stock', (req, res) => {
    try {
      const { type, quantity, notes, performedBy } = req.body;
      if (typeof quantity !== 'number') {
        return res.status(400).json({ error: 'Quantité invalide.' });
      }
      const result = db.addStockMovement({
        ingredientId: req.params.id,
        type: type || 'manual_in',
        quantity: Number(quantity),
        notes: notes || 'Ajustement manuel de stock',
        performedBy: performedBy || 'Gestionnaire'
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/stock-movements', (req, res) => {
    try {
      res.json(db.getStockMovements());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Drivers
  app.get('/api/drivers', (req, res) => {
    try {
      res.json(db.getDrivers());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/drivers', (req, res) => {
    try {
      const saved = db.saveDriver(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/drivers/:id', (req, res) => {
    try {
      const saved = db.saveDriver({ ...req.body, id: req.params.id });
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Suppliers
  app.get('/api/suppliers', (req, res) => {
    try {
      res.json(db.getSuppliers());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/suppliers', (req, res) => {
    try {
      const saved = db.saveSupplier(req.body);
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/suppliers/:id', (req, res) => {
    try {
      const saved = db.saveSupplier({ ...req.body, id: req.params.id });
      res.json(saved);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/suppliers/:id', (req, res) => {
    try {
      const success = db.deleteSupplier(req.params.id);
      res.json({ success });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Orders
  app.get('/api/orders', (req, res) => {
    try {
      res.json(db.getOrders());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/orders/:id', (req, res) => {
    try {
      const order = db.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ error: 'Commande non trouvée.' });
      }
      res.json(order);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public Order Tracking by unique token
  app.get('/api/orders/track/:token', (req, res) => {
    try {
      const order = db.getOrderByTrackingToken(req.params.token);
      if (!order) {
        return res.status(404).json({ error: 'Lien de suivi invalide ou commande introuvable.' });
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

  // Create Order (Calculates custom preparation, deducts stock, returns full order with tracking token)
  app.post('/api/orders', (req, res) => {
    try {
      const newOrder = db.createOrder(req.body);
      res.status(201).json(newOrder);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update Order Status (Kitchen, Driver, Admin)
  app.patch('/api/orders/:id/status', (req, res) => {
    try {
      const { status, note, updatedBy, assignedDriverId } = req.body;
      const updated = db.updateOrderStatus({
        orderId: req.params.id,
        status,
        note,
        updatedBy,
        assignedDriverId
      });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Update Order Payment Status
  app.patch('/api/orders/:id/payment', (req, res) => {
    try {
      const { paymentStatus } = req.body;
      const updated = db.updatePaymentStatus(req.params.id, paymentStatus);
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dashboard Stats
  app.get('/api/stats', (req, res) => {
    try {
      res.json(db.getDashboardStats());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset Demo Data
  app.post('/api/reset-demo-data', (req, res) => {
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
