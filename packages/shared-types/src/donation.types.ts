export enum VerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
}

export interface DonationSubmissionPayload {
  senderName: string;
  message?: string;
  amount: number;
}

// เหลือไว้แค่อันเดียว
export interface DonationSubmissionResponse {
  donationId: string;
  status: VerificationStatus;
}

export interface DonationRecord {
  id: string;
  senderName: string;
  message: string | null;
  amount: number;
  slipImageUrl: string;
  verificationStatus: VerificationStatus;
  slipOkReferenceId: string | null;
  createdAt: string;
  updatedAt: string;
}