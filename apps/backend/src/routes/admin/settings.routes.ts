import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth.middleware';
import { getSettings, updateSettings } from '../../services/settings.service';
import { getIO } from '../../sockets/socket.server';
import { SOCKET_EVENTS } from '@donation-app/shared-types';

const router = Router();
router.use(requireAdmin);

router.get('/', async (_req: Request, res: Response) => {
  try {
    return res.json(await getSettings());
  } catch (err) {
    console.error('[admin/settings] GET error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const b = req.body as Record<string, unknown>;
    const d: Record<string, unknown> = {};

    // ── String fields ──────────────────────────────────────────────────────
    const strings = [
      'slipOkMode',
      'profanityList',
      // Goal
      'goalLabel','goalBarColor','goalTextColor','goalFont',
      // Top donators
      'topFont','topTextColor','topAccentColor','topBarColor','topLayout',
      // Timer
      'timerFont','timerTextColor','timerExpiredColor','timerBackgroundColor',
      'timerLayout','timerAnimation',
      // Alert
      'alertFont','alertTextColor','alertAccentColor',
      'alertGifUrl','alertSoundUrl','alertAnimation',
    ];
    strings.forEach((k) => { if (b[k] !== undefined) d[k] = String(b[k]); });

    // ── Number fields ──────────────────────────────────────────────────────
    const numbers = [
      'minTtsAmount',
      'goalTargetAmount','goalCurrentAmount',
      'topDonatorsLimit',
      'timerBaseAmount','timerBaseMinutes',
      'alertDuration',
    ];
    numbers.forEach((k) => { if (b[k] !== undefined) d[k] = Number(b[k]); });

    // ── Boolean fields ─────────────────────────────────────────────────────
    const booleans = [
      'goalShowCountdown','goalShowPercent',
      'topShowBar',
      'timerEnabled',
      'alertTtsEnabled','alertShowGif',
    ];
    booleans.forEach((k) => { if (b[k] !== undefined) d[k] = Boolean(b[k]); });

    // ── Nullable DateTime fields ───────────────────────────────────────────
    if ('goalEndsAt'  in b) d.goalEndsAt  = b.goalEndsAt  ? new Date(b.goalEndsAt  as string) : null;
    if ('timerEndsAt' in b) d.timerEndsAt = b.timerEndsAt ? new Date(b.timerEndsAt as string) : null;

    const updated = await updateSettings(d as never);

    // Push updated goal state to widget immediately
    getIO().emit(SOCKET_EVENTS.GOAL_UPDATED, {
      label:         updated.goalLabel,
      currentAmount: updated.goalCurrentAmount,
      targetAmount:  updated.goalTargetAmount,
    });

    return res.json(updated);
  } catch (err) {
    console.error('[admin/settings] PATCH error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;