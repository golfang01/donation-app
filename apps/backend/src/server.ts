import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { MulterError } from 'multer';

import donationRoutes      from './routes/donation.routes';
import uploadRoutes        from './routes/upload.routes';
import ttsRoutes           from './routes/tts.routes';
import adminAuthRoutes     from './routes/admin/auth.routes';
import adminDonationRoutes from './routes/admin/donation.routes';
import adminSettingsRoutes from './routes/admin/settings.routes';
import { initializeSocket } from './sockets/socket.server';

import widgetRoutes from './routes/widget.routes';

const app        = express();
const httpServer = http.createServer(app);
const PORT       = process.env.PORT ?? 4000;

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Always allow localhost for local dev regardless of env
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:4000');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true, // required for httpOnly cookie auth
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ── Public routes ──────────────────────────────────────────────────────────
app.use('/api/donations', donationRoutes);   // public donation form
app.use('/api/upload',    uploadRoutes);     // cross-device slip upload
app.use('/api/tts',       ttsRoutes);        // TTS synthesis
app.use('/api/widget', widgetRoutes);

// ── Admin routes (JWT required inside each router) ─────────────────────────
app.use('/api/admin/auth',      adminAuthRoutes);     // login / logout / me
app.use('/api/admin/donations', adminDonationRoutes); // history, stats, replay
app.use('/api/admin/settings',  adminSettingsRoutes); // read / update settings

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ───────────────────────────────────────────────────
app.use((
  err:   any,
  _req:  express.Request,
  res:   express.Response,
  _next: express.NextFunction,
) => {
  if (err instanceof MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.message) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error.' });
});

initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});