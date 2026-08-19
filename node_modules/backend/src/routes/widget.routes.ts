import { Router, Request, Response } from 'express';
import { PrismaClient, VerificationStatus } from '@prisma/client';
import { getSettings } from '../services/settings.service';

const router = Router();
const prisma = new PrismaClient();

// ── Goal widget ─────────────────────────────────────────────────────────────
router.get('/goal', async (_req: Request, res: Response) => {
  try {
    const s = await getSettings();
    return res.json({
      // Data
      label:             s.goalLabel,
      currentAmount:     s.goalCurrentAmount,
      targetAmount:      s.goalTargetAmount,
      goalEndsAt:        s.goalEndsAt?.toISOString() ?? null,
      // Appearance
      goalBarColor:      s.goalBarColor,
      goalTextColor:     s.goalTextColor,
      goalFont:          s.goalFont,
      goalShowCountdown: s.goalShowCountdown,
      goalShowPercent:   s.goalShowPercent,
    });
  } catch (err) {
    console.error('[widget/goal]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Timer widget ────────────────────────────────────────────────────────────
router.get('/timer', async (_req: Request, res: Response) => {
  try {
    const s = await getSettings();
    return res.json({
      // Data
      endsAt:              s.timerEndsAt?.toISOString() ?? null,
      enabled:             s.timerEnabled,
      // Appearance
      timerFont:           s.timerFont,
      timerTextColor:      s.timerTextColor,
      timerExpiredColor:   s.timerExpiredColor,
      timerBackgroundColor: s.timerBackgroundColor,
      timerLayout:         s.timerLayout,
      timerAnimation:      s.timerAnimation,
    });
  } catch (err) {
    console.error('[widget/timer]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Top donators widget ─────────────────────────────────────────────────────
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
      // Data
      limit:    s.topDonatorsLimit,
      donators: donators.map((d) => ({
        senderName: d.senderName,
        total:      Number(d._sum.amount ?? 0),
      })),
      // Appearance
      topFont:        s.topFont,
      topTextColor:   s.topTextColor,
      topAccentColor: s.topAccentColor,
      topBarColor:    s.topBarColor,
      topLayout:      s.topLayout,
      topShowBar:     s.topShowBar,
    });
  } catch (err) {
    console.error('[widget/top-donators]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Overlay / Alert widget ──────────────────────────────────────────────────
// The overlay fetches its appearance config on mount so it can self-style.
// It doesn't need data (alerts are pushed via socket), only appearance.
router.get('/overlay', async (_req: Request, res: Response) => {
  try {
    const s = await getSettings();
    return res.json({
      alertFont:        s.alertFont,
      alertTextColor:   s.alertTextColor,
      alertAccentColor: s.alertAccentColor,
      alertGifUrl:      s.alertGifUrl,
      alertSoundUrl:    s.alertSoundUrl,
      alertAnimation:   s.alertAnimation,
      alertDuration:    s.alertDuration,
      alertTtsEnabled:  s.alertTtsEnabled,
      alertShowGif:     s.alertShowGif,
    });
  } catch (err) {
    console.error('[widget/overlay]', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;