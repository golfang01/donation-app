import { Router, Request, Response } from 'express';
import {
  PrismaClient,
  VerificationStatus,
  DonationSource,
} from '@prisma/client';
import { requireAdmin } from '../../middleware/auth.middleware';
import { getIO } from '../../sockets/socket.server';
import { SOCKET_EVENTS } from '@donation-app/shared-types';
import type { DonationAlertPayload } from '@donation-app/shared-types';

const router = Router();
const prisma = new PrismaClient();

// Every route in this file requires a valid admin JWT.
router.use(requireAdmin);

// ── Paginated donation history ─────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const page     = Math.max(1, Number(req.query.page)  || 1);
    const pageSize = Math.min(100, Number(req.query.size) || 20);
    const skip     = (page - 1) * pageSize;

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.donation.count(),
    ]);

    return res.json({
      data: donations.map((d) => ({
        ...d,
        amount: Number(d.amount),
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error('[admin/donations] GET error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Today's stats + top donators ───────────────────────────────────────────
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [todayResult, topDonators] = await Promise.all([
      prisma.donation.aggregate({
        where: {
          verificationStatus: VerificationStatus.VERIFIED,
          createdAt:          { gte: startOfDay },
        },
        _sum:   { amount: true },
        _count: true,
      }),
      prisma.donation.groupBy({
        by:      ['senderName'],
        where:   { verificationStatus: VerificationStatus.VERIFIED },
        _sum:    { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take:    5,
      }),
    ]);

    return res.json({
      todayTotal:  Number(todayResult._sum.amount ?? 0),
      todayCount:  todayResult._count,
      topDonators: topDonators.map((d) => ({
        senderName: d.senderName,
        total:      Number(d._sum.amount ?? 0),
      })),
    });
  } catch (err) {
    console.error('[admin/donations] stats error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Replay a past donation on the OBS overlay ──────────────────────────────
router.post('/:id/replay', async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);

    const donation = await prisma.donation.findUnique({ where: { id } });
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found.' });
    }

    const alertPayload: DonationAlertPayload = {
      donationId:  donation.id,
      senderName:  donation.senderName,
      message:     donation.message,
      amount:      Number(donation.amount),
      verifiedAt:  donation.updatedAt.toISOString(),
    };

    getIO().emit(SOCKET_EVENTS.DONATION_VERIFIED, alertPayload);
    return res.json({ success: true });
  } catch (err) {
    console.error('[admin/donations] replay error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── Manual alert — cash handoff or test trigger ───────────────────────────
router.post('/manual-trigger', async (req: Request, res: Response) => {
  try {
    const { senderName, message, amount } = req.body as {
      senderName?: string;
      message?:    string;
      amount?:     number;
    };

    if (!senderName || senderName.trim().length === 0) {
      return res.status(400).json({ error: 'senderName is required.' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number.' });
    }

    const donation = await prisma.donation.create({
      data: {
        senderName:         senderName.trim(),
        message:            message?.trim() || null,
        amount:             Number(amount),
        slipImageUrl:       null,
        verificationStatus: VerificationStatus.MANUAL,
        source:             DonationSource.MANUAL,
      },
    });

    const alertPayload: DonationAlertPayload = {
      donationId:  donation.id,
      senderName:  donation.senderName,
      message:     donation.message,
      amount:      Number(donation.amount),
      verifiedAt:  new Date().toISOString(),
    };

    getIO().emit(SOCKET_EVENTS.DONATION_VERIFIED, alertPayload);
    return res.status(201).json({ success: true, donation });
  } catch (err) {
    console.error('[admin/donations] manual trigger error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;