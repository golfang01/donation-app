import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken } from '../lib/jwt';

// Extends Express's Request so downstream handlers can read req.admin
// without casting.
declare global {
  namespace Express {
    interface Request {
      admin?: { adminId: string; username: string };
    }
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Accept token from Authorization header OR from an httpOnly cookie.
  // Header wins if both are present.
  const authHeader = req.headers.authorization;
  const token =
    authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.adminToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = verifyAdminToken(token);
    req.admin = { adminId: payload.adminId, username: payload.username };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
}