import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import { MulterError } from 'multer';
import donationRoutes from './routes/donation.routes';
import ttsRoutes from './routes/tts.routes';          // 👈 add this
import { initializeSocket } from './sockets/socket.server';
import uploadRoutes from './routes/upload.routes'; // add this import

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/donations', donationRoutes);
app.use('/api/tts', ttsRoutes);                       // 👈 add this

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err?.message) {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error.' });
});

app.use('/api/upload', uploadRoutes);

initializeSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});