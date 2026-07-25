export declare const SOCKET_EVENTS: {
    readonly DONATION_VERIFIED: "donation:verified";
    readonly SLIP_UPLOADED: "slip:uploaded";
};
export interface DonationAlertPayload {
    donationId: string;
    senderName: string;
    message: string | null;
    amount: number;
    verifiedAt: string;
}
export interface SlipUploadedPayload {
    sessionId: string;
    slipUrl: string;
    filename: string;
}
export interface ServerToClientEvents {
    [SOCKET_EVENTS.DONATION_VERIFIED]: (payload: DonationAlertPayload) => void;
    [SOCKET_EVENTS.SLIP_UPLOADED]: (payload: SlipUploadedPayload) => void;
}
export interface ClientToServerEvents {
    'join:session': (sessionId: string) => void;
}
