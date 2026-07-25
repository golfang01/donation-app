export declare enum VerificationStatus {
    PENDING = "PENDING",
    VERIFIED = "VERIFIED",
    FAILED = "FAILED"
}
export interface DonationSubmissionPayload {
    senderName: string;
    message?: string;
    amount: number;
}
export interface DonationSubmissionResponse {
    donationId: string;
    status: VerificationStatus;
    message?: string;
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
