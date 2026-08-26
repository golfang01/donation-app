import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma, VerificationStatus as PrismaVerificationStatus } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import { upload } from '../middleware/upload.middleware';
import { verifySlip } from '../services/slipOk.service';
import { getIO } from '../sockets/socket.server';
import {
  getSettings,
  incrementGoalAmount,
  addTimerTime,
} from '../services/settings.service';
import type {
  DonationSubmissionPayload,
  DonationSubmissionResponse,
  DonationAlertPayload,
} from '@donation-app/shared-types';
import { VerificationStatus, SOCKET_EVENTS } from '@donation-app/shared-types';

const router  = Router();
const prisma  = new PrismaClient();

const donationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { error: 'Too many submissions. Please try again later.' },
});

router.post(
  '/',
  donationLimiter,
  upload.single('slipImage'),
  async (req: Request, res: Response) => {
    try {
      const { senderName, message, amount } =
        req.body as Record<string, string>;

      if (!senderName || senderName.trim().length === 0) {
        return res.status(400).json({ error: 'senderName is required.' });
      }

      const parsedAmount = Number(amount);
      if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number.' });
      }

      const preUploadedUrl =
        (req.body as Record<string, string>).slipImageUrl ?? null;

      if (!req.file && !preUploadedUrl) {
        return res.status(400).json({ error: 'slipImage file is required.' });
      }

      // กำหนด slipImageUrl ให้รับค่าจาก Cloudinary โดยตรง (รองรับทั้งอัปโหลดใหม่และพรีอัปโหลด)
      const slipImageUrl = req.file
        ? req.file.path
        : preUploadedUrl!;

      const payload: DonationSubmissionPayload = {
        senderName: senderName.trim(),
        message:    message?.trim() || undefined,
        amount:     parsedAmount,
      };

      const donation = await prisma.donation.create({
        data: {
          senderName:         payload.senderName,
          message:            payload.message ?? null,
          amount:             payload.amount,
          slipImageUrl,
          verificationStatus: PrismaVerificationStatus.PENDING,
        },
      });

      // กำหนดค่า path ให้ฉลาดขึ้น รองรับทั้งไฟล์เครื่อง, ไฟล์พรีอัปโหลด และลิงก์ Cloudinary เต็มๆ
      let targetPath = '';
      if (req.file) {
        targetPath = req.file.path;
      } else if (preUploadedUrl) {
        targetPath = preUploadedUrl;
      } else {
        targetPath = slipImageUrl;
      }

      const verificationResult = await verifySlip({
        filePath: targetPath,
        expectedAmount: payload.amount,
      });

      let updated;
      let failureMessage = verificationResult.success
        ? undefined
        : verificationResult.errorMessage;

      try {
        updated = await prisma.donation.update({
          where: { id: donation.id },
          data:  {
            verificationStatus: verificationResult.success
              ? PrismaVerificationStatus.VERIFIED
              : PrismaVerificationStatus.FAILED,
            slipOkReferenceId:  verificationResult.referenceId ?? null,
            slipOkRawResponse:  (verificationResult.rawResponse as Prisma.InputJsonValue) ?? undefined,
          },
        });
      } catch (updateErr) {
        if (
          updateErr instanceof Prisma.PrismaClientKnownRequestError &&
          updateErr.code === 'P2002'
        ) {
          failureMessage = 'This slip has already been used for another donation.';
          updated = await prisma.donation.update({
            where: { id: donation.id },
            data:  {
              verificationStatus: PrismaVerificationStatus.FAILED,
              slipOkRawResponse:  (verificationResult.rawResponse as Prisma.InputJsonValue) ?? undefined,
            },
          });
        } else {
          throw updateErr;
        }
      }

      if (updated.verificationStatus === PrismaVerificationStatus.VERIFIED) {
        const alertPayload: DonationAlertPayload = {
          donationId:  updated.id,
          senderName:  updated.senderName,
          message:     updated.message,
          amount:      Number(updated.amount),
          verifiedAt:  updated.updatedAt.toISOString(),
        };

        getIO().emit(SOCKET_EVENTS.DONATION_VERIFIED, alertPayload);

        await incrementGoalAmount(Number(updated.amount));
        const freshSettings = await getSettings();
        getIO().emit(SOCKET_EVENTS.GOAL_UPDATED, {
          label:         freshSettings.goalLabel,
          currentAmount: freshSettings.goalCurrentAmount,
          targetAmount:  freshSettings.goalTargetAmount,
        });

        const topDonators = await prisma.donation.groupBy({
          by:      ['senderName'],
          where:   { verificationStatus: PrismaVerificationStatus.VERIFIED },
          _sum:    { amount: true },
          orderBy: { _sum: { amount: 'desc' } },
          take:    freshSettings.topDonatorsLimit,
        });
        getIO().emit(SOCKET_EVENTS.TOP_DONATORS_UPDATED, {
          donators: topDonators.map((d) => ({
            senderName: d.senderName,
            total:      Number(d._sum.amount ?? 0),
          })),
        });

        const newEndsAt = await addTimerTime(Number(updated.amount));
        getIO().emit(SOCKET_EVENTS.TIMER_UPDATED, {
          endsAt:  newEndsAt?.toISOString() ?? null,
          enabled: freshSettings.timerEnabled,
        });
      }

      const response: DonationSubmissionResponse = {
        donationId: updated.id,
        status:     updated.verificationStatus as VerificationStatus,
        message:    failureMessage,
      };

      return res.status(201).json(response);

    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);
export default router;