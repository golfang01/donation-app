import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma, VerificationStatus as PrismaVerificationStatus } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import { fromFile } from 'file-type';
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

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const donationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many submissions. Please try again later.' },
});

router.post('/', donationLimiter, upload.single('slipImage'), async (req: Request, res: Response) => {
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

    const detectedType = await fromFile(req.file.path);
    if (!detectedType || !ALLOWED_MIME_TYPES.includes(detectedType.mime)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Uploaded file is not a valid image.' });
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

    let updated;
    let failureMessage = verificationResult.success ? undefined : verificationResult.errorMessage;

    try {
      updated = await prisma.donation.update({
        where: { id: donation.id },
        data: {
          verificationStatus: verificationResult.success
            ? PrismaVerificationStatus.VERIFIED
            : PrismaVerificationStatus.FAILED,
          slipOkReferenceId: verificationResult.referenceId ?? null,
          slipOkRawResponse: (verificationResult.rawResponse as Prisma.InputJsonValue) ?? undefined,
        },
      });
    } catch (updateErr) {
      if (updateErr instanceof Prisma.PrismaClientKnownRequestError && updateErr.code === 'P2002') {
        // Postgres rejected it: this exact transRef already belongs to another donation.
        failureMessage = 'This slip has already been used for another donation.';
        updated = await prisma.donation.update({
          where: { id: donation.id },
          data: {
            verificationStatus: PrismaVerificationStatus.FAILED,
            slipOkRawResponse: (verificationResult.rawResponse as Prisma.InputJsonValue) ?? undefined,
            // referenceId left null on purpose — re-saving it would hit the same unique violation again
          },
        });
      } else {
        throw updateErr;
      }
    }

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
      message: failureMessage,
    };

    return res.status(201).json(response);
  } catch (err) {
    console.error('Error processing donation:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;