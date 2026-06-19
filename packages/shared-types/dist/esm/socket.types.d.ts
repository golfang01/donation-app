export declare const SOCKET_EVENTS: {
    readonly DONATION_VERIFIED: "donation:verified";
};
export interface DonationAlertPayload {
    donationId: string;
    senderName: string;
    message: string | null;
    amount: number;
    verifiedAt: string;
}
export interface ServerToClientEvents {
    [SOCKET_EVENTS.DONATION_VERIFIED]: (payload: DonationAlertPayload) => void;
}
export interface ClientToServerEvents {
}
