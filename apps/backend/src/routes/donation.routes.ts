import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma, VerificationStatus as PrismaVerificationStatus } from '@prisma/client';
import { upload } from '../middleware/upload.middleware';
import { verifySlip } from '../services/slipOk.service';
import { getIO } from '../sockets/socket.server';
import type {
  DonationSubmissionPayload,
  DonationSubmissionResponse,
  DonationAlertPayload,
} from '@donation-app/shared-types';
import { VerificationStatus, SOCKET_EVENTS } from '@donation-app/shared-types';

const router = Router();
const prisma = new PrismaClient();

router.post('/', upload.single('slipImage'), async (req: Request, res: Response) => {
  try {
    const { senderName, message, amount } = req.body as Record<string, string>;

    if (!senderName || senderName.trim().length === 0) {
      return res.status(400).json({ error: 'senderName is required.' });
    }

    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'slipImage file is required.' });
    }

    const payload: DonationSubmissionPayload = {
      senderName: senderName.trim(),
      message: message?.trim() || undefined,
      amount: parsedAmount,
    };

    const slipImageUrl = `/uploads/${req.file.filename}`;

    const donation = await prisma.donation.create({
      data: {
        senderName: payload.senderName,
        message: payload.message ?? null,
        amount: payload.amount,
        slipImageUrl,
        verificationStatus: PrismaVerificationStatus.PENDING,
      },
    });

    const verificationResult = await verifySlip({
      filePath: req.file.path,
      expectedAmount: payload.amount,
    });

    const updated = await prisma.donation.update({
      where: { id: donation.id },
      data: {
        verificationStatus: verificationResult.success
          ? PrismaVerificationStatus.VERIFIED
          : PrismaVerificationStatus.FAILED,
        slipOkReferenceId: verificationResult.referenceId ?? null,
        slipOkRawResponse: (verificationResult.rawResponse as Prisma.InputJsonValue) ?? undefined,
      },
    });

    if (updated.verificationStatus === PrismaVerificationStatus.VERIFIED) {
      const alertPayload: DonationAlertPayload = {
        donationId: updated.id,
        senderName: updated.senderName,
        message: updated.message,
        amount: Number(updated.amount),
        verifiedAt: updated.updatedAt.toISOString(),
      };
      getIO().emit(SOCKET_EVENTS.DONATION_VERIFIED, alertPayload);
    }

    const response: DonationSubmissionResponse = {
      donationId: updated.id,
      status: updated.verificationStatus as VerificationStatus,
    };

    return res.status(201).json(response);
  } catch (err) {
    console.error('Error processing donation:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;