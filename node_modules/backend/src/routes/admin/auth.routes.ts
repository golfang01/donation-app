import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { signAdminToken } from '../../lib/jwt';
import { requireAdmin } from '../../middleware/auth.middleware';

const router  = Router();
const prisma  = new PrismaClient();

// Strict rate limit — login endpoints are the most obvious brute-force
// target. 10 attempts per 15 minutes per IP is generous for legitimate use
// and brutal for an automated attack.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const admin = await prisma.admin.findUnique({ where: { username } });

    // Constant-time comparison even on "not found" — prevents username
    // enumeration via response-timing differences.
    const passwordValid = admin
      ? await bcrypt.compare(password, admin.passwordHash)
      : await bcrypt.compare(password, '$2b$12$placeholderHashToPreventTimingLeak000000000000');

    if (!admin || !passwordValid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = signAdminToken({ adminId: admin.id, username: admin.username });

    // httpOnly cookie so the token is inaccessible to JavaScript running
    // in the page — protects against XSS token theft.
    res.cookie('adminToken', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure:   process.env.NODE_ENV === 'production',
      maxAge:   8 * 60 * 60 * 1000, // 8 hours in ms
    });

    return res.json({
      username: admin.username,
      // Also return the token in the body so the React frontend can store it
      // in memory (not localStorage) and use it for API calls this session.
      token,
    });
  } catch (err) {
    console.error('[auth] Login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('adminToken');
  return res.json({ success: true });
});

// Lightweight session check — the frontend calls this on page load to
// decide whether to redirect to /admin/login or render the dashboard.
router.get('/me', requireAdmin, (req: Request, res: Response) => {
  return res.json({ username: req.admin!.username });
});

export default router;