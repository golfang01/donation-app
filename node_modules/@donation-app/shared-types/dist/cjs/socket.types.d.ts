export declare const SOCKET_EVENTS: {
    readonly DONATION_VERIFIED: "donation:verified";
    readonly SLIP_UPLOADED: "slip:uploaded";
    readonly GOAL_UPDATED: "goal:updated";
    readonly TOP_DONATORS_UPDATED: "top_donators:updated";
    readonly TIMER_UPDATED: "timer:updated";
    readonly MANUAL_ALERT: "manual:alert";
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
export interface GoalUpdatedPayload {
    label: string;
    currentAmount: number;
    targetAmount: number;
}
export interface TopDonatorsUpdatedPayload {
    donators: {
        senderName: string;
        total: number;
    }[];
}
export interface TimerUpdatedPayload {
    endsAt: string | null;
    enabled: boolean;
}
export interface ServerToClientEvents {
    [SOCKET_EVENTS.DONATION_VERIFIED]: (payload: DonationAlertPayload) => void;
    [SOCKET_EVENTS.SLIP_UPLOADED]: (payload: SlipUploadedPayload) => void;
    [SOCKET_EVENTS.GOAL_UPDATED]: (payload: GoalUpdatedPayload) => void;
    [SOCKET_EVENTS.TOP_DONATORS_UPDATED]: (payload: TopDonatorsUpdatedPayload) => void;
    [SOCKET_EVENTS.TIMER_UPDATED]: (payload: TimerUpdatedPayload) => void;
    [SOCKET_EVENTS.MANUAL_ALERT]: (payload: DonationAlertPayload) => void;
}
export interface ClientToServerEvents {
    'join:session': (sessionId: string) => void;
}
