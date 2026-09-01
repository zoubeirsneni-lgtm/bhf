import { db } from './server/db';

async function runRBACTests() {
  console.log('=====================================================');
  console.log('--- EXÉCUTION DE LA SUITE DE TESTS PHASE 2B (RBAC) ---');
  console.log('=====================================================');

  const BASE_URL = 'http://localhost:3000';
  let allPassed = true;
  const testResults: Array<{ id: number; name: string; status: number; expectedStatus: number | number[]; passed: boolean; details: string }> = [];

  // Wait for server health
  let serverReady = false;
  for (let i = 0; i < 15; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  if (!serverReady) {
    console.error('Server not reachable at http://localhost:3000');
    process.exit(1);
  }

  // Helper fetch with JSON
  async function api(path: string, options: any = {}) {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const status = res.status;
    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status, data };
  }

  // 1. Obtenir les tokens de connexion pour chaque rôle
  console.log('\n[AUTH SETUP] Récupération des tokens pour Admin, Kitchen, Driver 1, Driver 2...');

  const adminLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: process.env.INITIAL_ADMIN_PASSWORD || 'Bebba@Admin2026!' })
  });
  console.log('adminLogin result:', adminLogin);
  const adminToken = adminLogin.data?.token;

  const kitchenLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'cuisine', password: process.env.INITIAL_KITCHEN_PASSWORD || 'Bebba@Kitchen2026!' })
  });
  const kitchenToken = kitchenLogin.data?.token;

  const driver1Login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'livreur1', password: process.env.INITIAL_DRIVER_PASSWORD || 'Bebba@Driver2026!' })
  });
  const driver1Token = driver1Login.data?.token;
  const driver1Id = driver1Login.data?.user?.driverId;

  const driver2Login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'livreur2', password: process.env.INITIAL_DRIVER_PASSWORD || 'Bebba@Driver2026!' })
  });
  const driver2Token = driver2Login.data?.token;
  const driver2Id = driver2Login.data?.user?.driverId;

  console.log(`Tokens reçus: Admin=${!!adminToken}, Kitchen=${!!kitchenToken}, Driver1(${driver1Id})=${!!driver1Token}, Driver2(${driver2Id})=${!!driver2Token}`);

  function record(id: number, name: string, status: number, expectedStatus: number | number[], passed: boolean, details: string) {
    testResults.push({ id, name, status, expectedStatus, passed, details });
    if (!passed) allPassed = false;
    console.log(`[TEST ${id}] ${name} -> ${passed ? '✅ PASSED' : '❌ FAILED'} (HTTP ${status}, Attendu: ${Array.isArray(expectedStatus) ? expectedStatus.join('/') : expectedStatus}) - ${details}`);
  }

  // --- TEST 1: GET /api/stats sans authentification (401) ---
  const t1 = await api('/api/stats');
  record(1, 'GET /api/stats sans authentification', t1.status, 401, t1.status === 401, t1.data?.error || '');

  // --- TEST 2: GET /api/stats avec KITCHEN (403) ---
  const t2 = await api('/api/stats', { headers: { Authorization: `Bearer ${kitchenToken}` } });
  record(2, 'GET /api/stats avec rôle KITCHEN', t2.status, 403, t2.status === 403, t2.data?.error || '');

  // --- TEST 3: GET /api/stats avec DRIVER (403) ---
  const t3 = await api('/api/stats', { headers: { Authorization: `Bearer ${driver1Token}` } });
  record(3, 'GET /api/stats avec rôle DRIVER', t3.status, 403, t3.data?.error || '');

  // --- TEST 4: GET /api/stats avec ADMIN (200) ---
  const t4 = await api('/api/stats', { headers: { Authorization: `Bearer ${adminToken}` } });
  record(4, 'GET /api/stats avec rôle ADMIN', t4.status, 200, t4.status === 200, `Revenue: ${t4.data?.todayRevenue} TND`);

  // --- TEST 5: Route de gestion produit sans authentification (401) ---
  const t5 = await api('/api/products', {
    method: 'POST',
    body: JSON.stringify({ name: 'Test Dish No Auth', basePrice: 15, categoryId: 'cat-bowls' })
  });
  record(5, 'POST /api/products sans authentification', t5.status, 401, t5.status === 401, t5.data?.error || '');

  // --- TEST 6: Route de gestion produit avec KITCHEN (403) ---
  const t6 = await api('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: JSON.stringify({ name: 'Test Dish Kitchen', basePrice: 15, categoryId: 'cat-bowls' })
  });
  record(6, 'POST /api/products avec rôle KITCHEN', t6.status, 403, t6.status === 403, t6.data?.error || '');

  // --- TEST 7: Route de gestion produit avec DRIVER (403) ---
  const t7 = await api('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${driver1Token}` },
    body: JSON.stringify({ name: 'Test Dish Driver', basePrice: 15, categoryId: 'cat-bowls' })
  });
  record(7, 'POST /api/products avec rôle DRIVER', t7.status, 403, t7.status === 403, t7.data?.error || '');

  // --- TEST 8: Route de gestion produit avec ADMIN (200) ---
  const t8 = await api('/api/products', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      id: 'prod-test-admin-rbac',
      name: 'Salade Protéinée RBAC Test',
      description: 'Salade spéciale test RBAC',
      categoryId: 'cat-salades',
      basePrice: 17.5,
      calories: 380,
      proteinGrams: 35,
      carbsGrams: 20,
      fatGrams: 10,
      active: true,
      isAvailable: true,
      isPopular: false,
      baseIngredients: [{ ingredientId: 'ing-poulet', ingredientName: 'Poulet', quantity: 150, unit: 'g' }],
      customization: { allowedSupplementIds: [] }
    })
  });
  record(8, 'POST /api/products avec rôle ADMIN', t8.status, 200, t8.status === 200, `Produit créé: ${t8.data?.id}`);
  // Nettoyage du produit de test
  if (t8.data?.id) {
    await api(`/api/products/${t8.data.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${adminToken}` } });
  }

  // Configuration des commandes de test via API HTTP
  // Commande 1 : received -> preparing -> ready (attribuée à Livreur 1 / drv-1)
  const o1Res = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      client: { name: 'Client Livreur 1', phone: '+216 99 111 222', deliveryAddress: 'Lac 1' },
      items: [{ productId: 'prod-poulet-bowl', quantity: 1, baseChoice: { label: 'Riz' }, supplements: [] }]
    })
  });
  const orderForDriver1 = o1Res.data;
  // Step 1: received -> preparing
  await api(`/api/orders/${orderForDriver1.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'preparing', note: 'Préparation' })
  });
  // Step 2: preparing -> ready avec assignation drv-1
  await api(`/api/orders/${orderForDriver1.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'ready', assignedDriverId: 'drv-1', note: 'Prêt pour livraison' })
  });

  // Commande 2 : received -> preparing -> ready (attribuée à Livreur 2 / drv-2)
  const o2Res = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      client: { name: 'Client Livreur 2', phone: '+216 99 333 444', deliveryAddress: 'Marsa' },
      items: [{ productId: 'prod-poulet-bowl', quantity: 1, baseChoice: { label: 'Riz' }, supplements: [] }]
    })
  });
  const orderForDriver2 = o2Res.data;
  // Step 1: received -> preparing
  await api(`/api/orders/${orderForDriver2.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'preparing', note: 'Préparation' })
  });
  // Step 2: preparing -> ready avec assignation drv-2
  await api(`/api/orders/${orderForDriver2.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'ready', assignedDriverId: 'drv-2', note: 'Prêt pour livraison' })
  });

  // --- TEST 9: Livreur A demande ses commandes (Isolation des données) ---
  const t9 = await api('/api/orders', { headers: { Authorization: `Bearer ${driver1Token}` } });
  const allOrdersAreDriver1 = Array.isArray(t9.data) && t9.data.every((o: any) => o.assignedDriverId === 'drv-1');
  const driver1OrdersCount = t9.data?.length || 0;
  record(9, 'Livreur 1 demande GET /api/orders (Isolation des commandes)', t9.status, 200, t9.status === 200 && allOrdersAreDriver1 && driver1OrdersCount > 0, `${driver1OrdersCount} commandes reçues, toutes assignées à drv-1`);

  // --- TEST 10: Livreur A tente d'accéder à la commande du Livreur B (IDOR) ---
  const t10 = await api(`/api/orders/${orderForDriver2.id}`, { headers: { Authorization: `Bearer ${driver1Token}` } });
  record(10, 'Livreur 1 tente d’accéder à la commande de Livreur 2 (IDOR protection)', t10.status, 403, t10.status === 403, t10.data?.error || '');

  // Commande de test pour la cuisine (status: received)
  const oKitchenRes = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      client: { name: 'Client Test Cuisine', phone: '+216 99 555 666', deliveryAddress: 'Ennasr 2' },
      items: [{ productId: 'prod-poulet-bowl', quantity: 1, baseChoice: { label: 'Riz' }, supplements: [] }]
    })
  });
  const orderForKitchen = oKitchenRes.data;

  // --- TEST 11: KITCHEN modifie un statut de préparation autorisé (received -> preparing) ---
  const t11 = await api(`/api/orders/${orderForKitchen.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: JSON.stringify({ status: 'preparing', note: 'En cuisson' })
  });
  record(11, 'KITCHEN met à jour statut autorisé (received -> preparing)', t11.status, 200, t11.status === 200 && t11.data?.status === 'preparing', `Statut passé à: ${t11.data?.status}`);

  // --- TEST 12: KITCHEN tente de passer directement à 'delivered' (Interdit) ---
  const t12 = await api(`/api/orders/${orderForKitchen.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: JSON.stringify({ status: 'delivered', note: 'Fraude cuisine' })
  });
  record(12, 'KITCHEN tente transition interdite vers "delivered"', t12.status, 403, t12.status === 403, t12.data?.error || '');

  // --- TEST 13: DRIVER modifie un statut de livraison autorisé sur sa commande (ready -> delivering) ---
  const t13 = await api(`/api/orders/${orderForDriver1.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${driver1Token}` },
    body: JSON.stringify({ status: 'delivering', note: 'En route' })
  });
  record(13, 'DRIVER met à jour statut de livraison autorisé (ready -> delivering)', t13.status, 200, t13.status === 200 && t13.data?.status === 'delivering', `Statut passé à: ${t13.data?.status}`);

  // --- TEST 14: DRIVER tente de modifier un produit (403) ---
  const t14 = await api('/api/products/prod-poulet-bowl', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${driver1Token}` },
    body: JSON.stringify({ name: 'Hacked Bowl', basePrice: 1 })
  });
  record(14, 'DRIVER tente PUT /api/products/:id', t14.status, 403, t14.status === 403, t14.data?.error || '');

  // --- TEST 15: DRIVER tente de modifier le stock (403) ---
  const t15 = await api('/api/ingredients/ing-poulet/stock', {
    method: 'POST',
    headers: { Authorization: `Bearer ${driver1Token}` },
    body: JSON.stringify({ quantity: 1000, type: 'manual_in' })
  });
  record(15, 'DRIVER tente POST /api/ingredients/:id/stock', t15.status, 403, t15.status === 403, t15.data?.error || '');

  // --- TEST 16: KITCHEN tente de confirmer un paiement (403) ---
  const t16 = await api(`/api/orders/${orderForDriver1.id}/payment`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: JSON.stringify({ paymentStatus: 'paid' })
  });
  record(16, 'KITCHEN tente PATCH /api/orders/:id/payment', t16.status, 403, t16.status === 403, t16.data?.error || '');

  // --- TEST 17: DRIVER confirme le paiement d'une commande qui lui est attribuée (200) ---
  const t17 = await api(`/api/orders/${orderForDriver1.id}/payment`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${driver1Token}` },
    body: JSON.stringify({ paymentStatus: 'paid' })
  });
  record(17, 'DRIVER confirme paiement pour sa commande assignée', t17.status, 200, t17.status === 200 && t17.data?.paymentStatus === 'paid', `PaymentStatus: ${t17.data?.paymentStatus}`);

  // --- TEST 18: Utilisateur non authentifié crée une commande client (201) ---
  const t18 = await api('/api/orders', {
    method: 'POST',
    body: JSON.stringify({
      client: { name: 'Client Public Anonyme', phone: '+216 20 123 456', deliveryAddress: 'Menzah 9' },
      items: [{ productId: 'prod-poulet-bowl', quantity: 1, baseChoice: { label: 'Riz Basmati' }, supplements: [] }]
    })
  });
  record(18, 'Client public non authentifié crée une commande (POST /api/orders)', t18.status, 201, t18.status === 201 && !!t18.data?.trackingToken, `Commande: #${t18.data?.orderNumber}, Token: ${t18.data?.trackingToken}`);

  const publicTrackingToken = t18.data?.trackingToken;

  // --- TEST 19: Utilisateur non authentifié utilise un trackingToken valide (200) ---
  const t19 = await api(`/api/orders/track/${publicTrackingToken}`);
  record(19, 'Client public consulte suivi par trackingToken (GET /api/orders/track/:token)', t19.status, 200, t19.status === 200 && t19.data?.trackingToken === publicTrackingToken, `Client: ${t19.data?.clientName}, Status: ${t19.data?.status}`);

  // --- TEST 20: Tentative de contournement React currentRole sans token serveur (401/403) ---
  // Simulation d'un client React qui tenterait d'appeler l'API Admin avec un token de rôle driver ou un faux token
  const t20a = await api('/api/stats', { headers: { Authorization: 'Bearer fake_jwt_token_tampered' } });
  const t20b = await api('/api/reset-demo-data', { method: 'POST', headers: { Authorization: `Bearer ${driver1Token}` } });
  const t20Passed = t20a.status === 401 && t20b.status === 403;
  record(20, 'Vérification autorité serveur (Bypass client impossible sans JWT valide)', t20b.status, [401, 403], t20Passed, `Faux token: HTTP ${t20a.status}, Token Driver sur Admin Route: HTTP ${t20b.status}`);

  console.log('\n=====================================================');
  console.log(allPassed ? '✅ LES 20 TESTS RBAC SONT PASSÉS AVEC SUCCÈS !' : '❌ CERTAINS TESTS ONT ÉCHOUÉ');
  console.log('=====================================================');
}

runRBACTests().catch(console.error);
