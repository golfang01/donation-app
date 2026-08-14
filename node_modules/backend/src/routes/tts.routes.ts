import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { synthesizeThaiSpeech } from '../services/tts.service';
import { getSettings } from '../services/settings.service';

const router = Router();

const ttsLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

router.post('/synthesize', ttsLimiter, async (req: Request, res: Response) => {
  try {
    const { text } = req.body as { text?: string };

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required.' });
    }
    if (text.trim().length > 500) {
      return res.status(400).json({ error: 'Message is too long to synthesize.' });
    }

    const settings = await getSettings();
    const audioContent = await synthesizeThaiSpeech(text.trim(), settings.profanityList);
    return res.json({ audioContent });
  } catch (err) {
    console.error('[tts.routes] Failed to synthesize speech:', err);
    return res.status(500).json({ error: 'Could not generate speech audio.' });
  }
});

export default router;