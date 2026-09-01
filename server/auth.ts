import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, SafeUser, InternalRole, OrderStatus } from '../src/types';
import { db } from './db';

// JWT Configuration
const JWT_SECRET: string = process.env.JWT_SECRET || 'bebba_healthy_food_jwt_secure_secret_2026';
const JWT_EXPIRES_IN = '24h';

export interface TokenPayload {
  id: string;
  username: string;
  role: InternalRole;
  driverId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: SafeUser;
}

/**
 * Remove passwordHash from user object to prevent any accidental leakage.
 */
export function sanitizeUser(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * Hash a plain password using bcrypt (salt rounds = 10).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain password against a stored bcrypt hash.
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a signed JWT token containing minimal payload.
 */
export function generateToken(user: SafeUser): string {
  const payload: TokenPayload = {
    id: user.id,
    username: user.username,
    role: user.role,
    ...(user.driverId ? { driverId: user.driverId } : {})
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Server-side Authentication Middleware:
 * 1. Checks Authorization header ('Bearer <token>')
 * 2. Validates JWT signature & expiration
 * 3. Fetches user from db (ensures user exists and is active)
 * 4. Attaches safe user object to req.user
 * 5. Returns 401 on missing, invalid, or inactive user
 */
export function authenticateUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Accès non autorisé : Jeton d’authentification manquant.' });
    return;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Accès non autorisé : Jeton d’authentification invalide.' });
    return;
  }

  const payload = verifyToken(token);
  if (!payload || !payload.id) {
    res.status(401).json({ error: 'Accès non autorisé : Jeton d’authentification invalide ou expiré.' });
    return;
  }

  const user = db.getUserById(payload.id);
  if (!user || !user.active) {
    res.status(401).json({ error: 'Accès non autorisé : Utilisateur inexistant ou désactivé.' });
    return;
  }

  // Attach the authenticated safe user to the request
  req.user = sanitizeUser(user);
  next();
}

/**
 * Role-Based Access Control (RBAC) Middleware:
 * Checks if the authenticated user has one of the allowed roles.
 * Returns 401 if unauthenticated, 403 if role is forbidden.
 */
export function requireRole(...allowedRoles: InternalRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Accès non autorisé : Authentification requise.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: `Accès refusé : Le rôle '${req.user.role}' n'a pas les permissions requises.` });
      return;
    }

    next();
  };
}

/**
 * Server-side Order Status Transition Rules:
 * Validates whether the given role is allowed to transition the order
 * from currentStatus to targetStatus.
 */
export function isValidStatusTransition(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  role: InternalRole
): boolean {
  if (role === 'admin') {
    // Admin can perform all valid lifecycle transitions
    const validLifecycle: Record<OrderStatus, OrderStatus[]> = {
      received: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['delivering', 'cancelled'],
      delivering: ['delivered', 'cancelled'],
      delivered: [],
      cancelled: []
    };
    return (validLifecycle[currentStatus] || []).includes(targetStatus);
  }

  if (role === 'kitchen') {
    // Kitchen is strictly limited to preparation workflow
    if (currentStatus === 'received' && targetStatus === 'preparing') return true;
    if (currentStatus === 'preparing' && targetStatus === 'ready') return true;
    return false;
  }

  if (role === 'driver') {
    // Driver is strictly limited to delivery workflow
    if (currentStatus === 'ready' && targetStatus === 'delivering') return true;
    if (currentStatus === 'delivering' && targetStatus === 'delivered') return true;
    return false;
  }

  return false;
}

