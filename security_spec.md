# Spécifications de Sécurité & Contrôle d'Accès (BEBBA Healthy Food)

Ce document formalise les règles de sécurité, de contrôle d'accès basé sur les rôles (RBAC), de protection contre les failles IDOR et de cycle de vie des commandes de la plateforme BEBBA Healthy Food.

---

## 1. Rôles et Matrice d'Accès (RBAC)

L'application distingue quatre profils d'utilisateurs avec une isolation étanche :

| Rôle | Périmètre d'action | Authentification |
| :--- | :--- | :--- |
| **Admin** (`admin`) | Accès complet : catalogue, stocks, utilisateurs, livreurs, statistiques, supervision et affectation des commandes. | Nom d'utilisateur + Mot de passe (bcrypt) |
| **Cuisine** (`kitchen`) | Consultation des commandes en cours, mise à jour du statut vers préparation et prêt, suivi des fiches techniques et stocks. | Nom d'utilisateur + Mot de passe (bcrypt) |
| **Livreur** (`driver`) | Consultation stricte de ses seules courses assignées, mise à jour du statut vers livré, enregistrement de l'encaissement. | Nom d'utilisateur + Mot de passe (bcrypt) |
| **Client** (`client`) | Consultation du menu public, passation de commande, consultation de son historique personnel, suivi de ses commandes. | Téléphone normalisé (8 chiffres) + Mot de passe (bcrypt) |

---

## 2. Authentification et Sessions (JWT)

1. **Jeton JWT** :
   - Émis côté serveur lors de la connexion réussie (`/api/auth/login`) ou inscription client (`/api/auth/register-client`).
   - Signé avec `process.env.JWT_SECRET` (durée de validité : 24 heures).
   - Payload minimal : `id`, `role`, `username` ou `phone`, et `driverId` pour les livreurs.
2. **Protection des Mots de Passe** :
   - Hachage cryptographique fort avec `bcryptjs` (salt rounds = 10).
   - Le champ `passwordHash` est systématiquement exclu des réponses API (`sanitizeUser`).
3. **Middleware `authenticateUser`** :
   - Valide l'en-tête `Authorization: Bearer <token>`.
   - Vérifie la validité cryptographique du jeton et que l'utilisateur existe et est actif dans la base.
   - Injecte `req.user` (sécurisé) dans la requête Express.

---

## 3. Matrice de Transition des Statuts de Commande

Le cycle de vie d'une commande est strictement unidirectionnel, sans saut d'étape ni retour arrière :

```
received ──> preparing ──> ready ──> waiting_for_driver ──> delivering ──> delivered
   │              │           │               │                 │
   └───[Annulé]───┴───[Annulé]┴───[Annulé]────┴────[Annulé]─────┴───[Annulé]
```

### Permissions par rôle :
- **Client** : Aucune transition autorisée (lecture seule de ses commandes).
- **Cuisine** :
  - `received` ➔ `preparing` (Prise en charge de la préparation).
  - `preparing` ➔ `ready` (Préparation terminée). La transition vers `waiting_for_driver` est gérée automatiquement par le système.
- **Livreur** :
  - `delivering` ➔ `delivered` (Confirmation de livraison physique).
- **Admin** :
  - Autorisé sur toutes les étapes du cycle de vie et l'annulation.
  - Seul l'administrateur peut assigner un livreur lors du passage à `delivering` (ou via `/api/orders/:id/assign-driver`).

---

## 4. Protection Anti-IDOR (Insecure Direct Object References)

1. **Isolation des commandes livreurs (`driver`)** :
   - `GET /api/orders` : Les livreurs ne reçoivent que les commandes dont `assignedDriverId === req.user.driverId`.
   - `GET /api/orders/:id` et `PATCH /api/orders/:id/status` : Contrôle serveur strict bloquant l'accès avec un code `403 Forbidden` si la commande n'est pas assignée au livreur appelant.
2. **Isolation des commandes clients (`client`)** :
   - `GET /api/orders/:id` : Le client ne peut consulter que les commandes associées à son `clientId`.
   - Anti-spoofing à la création : Le champ `clientId` fourni dans le corps d'une requête `POST /api/orders` est totalement ignoré ; seul l'identifiant extrait du JWT validé est pris en compte.
3. **Suivi Public Sécurisé (`/api/orders/track/:token`)** :
   - Accès anonyme protégé par un token cryptographique aléatoire à haute entropie (`trackingToken`).
   - Le payload retourné masque les métadonnées internes du système.
4. **Récupération de Commande (`/api/orders/track-lookup`)** :
   - Requiert obligatoirement le couple strict `orderNumber` + `phone`.
   - Protégé par limitation de débit (Rate Limiting) : blocage temporaire après 5 tentatives infructueuses par IP.

---

## 5. Gestion des Encaissements et Paiements

1. Seuls l'**Admin** et le **Livreur assigné** sont habilités à enregistrer le statut de paiement (`PATCH /api/orders/:id/payment`).
2. Règle métier stricte : Une commande ne peut être marquée comme encaissée (`paid`) que si son statut physique est `delivered`.
3. La cuisine et les clients ont une interdiction absolue (`403 Forbidden`) d'altérer le statut financier d'une commande.

---

## 6. Décrémentation Atomique des Stocks & Idempotence

1. **Vérification et décrémentation atomiques** : Exécutées au sein d'une transaction Firestore unifiée (`runTransaction`).
2. **Gestion de rupture de stock** : Levée d'une exception `InsufficientStockError` retournant un statut `HTTP 409 Conflict` avec la liste détaillée des ingrédients manquants et de leurs disponibilités réelles.
3. **Clé d'Idempotence (`Idempotency-Key`)** :
   - Enregistrée dans `/idempotency_keys/{key}`.
   - Détection de doublon : Retourne la commande existante (`HTTP 200 OK`) si le contenu est identique.
   - Détection de conflit de contenu : `HTTP 422 Unprocessable Entity`.
   - Détection d'usurpation de clé par un tiers : `HTTP 403 Forbidden`.
