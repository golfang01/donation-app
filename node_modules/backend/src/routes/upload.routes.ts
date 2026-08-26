import { Router, Request, Response } from 'express';
import { upload } from '../middleware/upload.middleware';
import { getIO } from '../sockets/socket.server';
import type { SlipUploadedPayload } from '@donation-app/shared-types';
import { SOCKET_EVENTS } from '@donation-app/shared-types';

const router = Router();

router.post('/', upload.single('slipImage'), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.query as { sessionId?: string };

    if (!sessionId || sessionId.trim().length === 0) {
      return res.status(400).json({ error: 'sessionId query param is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'slipImage file is required.' });
    }

   // เนื่องจากเราใช้ Cloudinary ระบบจะส่ง URL เต็มๆ มาที่ req.file.path แล้ว
    const slipUrl = req.file.path;

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