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

app.use(cors({
  origin: ['http://localhost:5173', 'http://192.168.1.153:5173'],
  credentials: true,
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