import { Router, Request, Response } from 'express';
import { PrismaClient, VerificationStatus } from '@prisma/client';
import { getSettings } from '../services/settings.service';

const router = Router();
const prisma = new PrismaClient();

// Goal widget initial state
router.get('/goal', async (_req, res) => {
  try {
    const s = await getSettings();
    return res.json({
      label:             s.goalLabel,
      currentAmount:     s.goalCurrentAmount,
      targetAmount:      s.goalTargetAmount,
      goalEndsAt:        s.goalEndsAt?.toISOString() ?? null,
      goalBarColor:      s.goalBarColor,
      goalTextColor:     s.goalTextColor,
      goalFont:          s.goalFont,
      goalShowCountdown: s.goalShowCountdown,
      goalShowPercent:   s.goalShowPercent,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Timer widget initial state
router.get('/timer', async (_req: Request, res: Response) => {
  try {
    const s = await getSettings();
    return res.json({
      endsAt:  s.timerEndsAt?.toISOString() ?? null,
      enabled: s.timerEnabled,
    });
  } catch (err) {
    console.error('[widget/timer]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Top donators widget initial state
router.get('/top-donators', async (_req: Request, res: Response) => {
  try {
    const s        = await getSettings();
    const donators = await prisma.donation.groupBy({
      by:      ['senderName'],
      where:   { verificationStatus: VerificationStatus.VERIFIED },
      _sum:    { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take:    s.topDonatorsLimit,
    });
    return res.json({
      limit: s.topDonatorsLimit,
      donators: donators.map((d) => ({
        senderName: d.senderName,
        total:      Number(d._sum.amount ?? 0),
      })),
    });
  } catch (err) {
    console.error('[widget/top-donators]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;