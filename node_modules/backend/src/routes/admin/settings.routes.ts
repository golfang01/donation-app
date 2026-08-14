import { Router, Request, Response } from 'express';
import { requireAdmin } from '../../middleware/auth.middleware';
import { getSettings, updateSettings } from '../../services/settings.service';
import { getIO } from '../../sockets/socket.server';
import { SOCKET_EVENTS } from '@donation-app/shared-types';

const router = Router();
router.use(requireAdmin);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await getSettings();
    return res.json(settings);
  } catch (err) {
    console.error('[admin/settings] GET error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    // Scalar fields — only included if the key was actually sent
    if (body.slipOkMode        !== undefined) data.slipOkMode        = String(body.slipOkMode);
    if (body.minTtsAmount      !== undefined) data.minTtsAmount      = Number(body.minTtsAmount);
    if (body.profanityList     !== undefined) data.profanityList     = String(body.profanityList);
    if (body.goalLabel         !== undefined) data.goalLabel         = String(body.goalLabel);
    if (body.goalTargetAmount  !== undefined) data.goalTargetAmount  = Number(body.goalTargetAmount);
    if (body.goalCurrentAmount !== undefined) data.goalCurrentAmount = Number(body.goalCurrentAmount);
    if (body.topDonatorsLimit  !== undefined) data.topDonatorsLimit  = Number(body.topDonatorsLimit);
    if (body.timerEnabled      !== undefined) data.timerEnabled      = Boolean(body.timerEnabled);
    if (body.timerBaseAmount   !== undefined) data.timerBaseAmount   = Number(body.timerBaseAmount);
    if (body.timerBaseMinutes  !== undefined) data.timerBaseMinutes  = Number(body.timerBaseMinutes);

    // Nullable DateTime fields — must use 'in' check so explicit null is forwarded
    if ('goalEndsAt' in body) {
      data.goalEndsAt = body.goalEndsAt ? new Date(body.goalEndsAt as string) : null;
    }
    if ('timerEndsAt' in body) {
      data.timerEndsAt = body.timerEndsAt ? new Date(body.timerEndsAt as string) : null;
    }

    const updated = await updateSettings(data as never);

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