import { Router, Request, Response } from 'express';
import { fromFile } from 'file-type';
import fs from 'fs';
import { upload } from '../middleware/upload.middleware';
import { getIO } from '../sockets/socket.server';
import type { SlipUploadedPayload } from '@donation-app/shared-types';
import { SOCKET_EVENTS } from '@donation-app/shared-types';

const router = Router();
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

router.post('/', upload.single('slipImage'), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query as { sessionId?: string };

    if (!sessionId || sessionId.trim().length === 0) {
      return res.status(400).json({ error: 'sessionId query param is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'slipImage file is required.' });
    }

    // Magic-byte validation — same as the main donation route.
    const detectedType = await fromFile(req.file.path);
    if (!detectedType || !ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Uploaded file is not a valid image.' });
    }

    const slipUrl = `/uploads/${req.file.filename}`;

    const payload: SlipUploadedPayload = {
      sessionId: sessionId.trim(),
      slipUrl,
      filename: req.file.originalname,
    };

    // Emit only to the desktop tab that owns this sessionId.
    getIO().to(`session:${sessionId}`).emit(SOCKET_EVENTS.SLIP_UPLOADED, payload);

    return res.json({ success: true, slipUrl });
  } catch (err) {
    console.error('[upload.routes] Error:', err);
    return res.status(500).json({ error: 'Upload failed.' });
  }
});

export default router;