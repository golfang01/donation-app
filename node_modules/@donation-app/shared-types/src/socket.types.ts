export const SOCKET_EVENTS = {
  DONATION_VERIFIED:    'donation:verified',
  SLIP_UPLOADED:        'slip:uploaded',
  GOAL_UPDATED:         'goal:updated',
  TOP_DONATORS_UPDATED: 'top_donators:updated',
  TIMER_UPDATED:        'timer:updated',
  MANUAL_ALERT:         'manual:alert',
} as const;

export interface DonationAlertPayload {
  donationId:  string;
  senderName:  string;
  message:     string | null;
  amount:      number;
  verifiedAt:  string;
}

export interface SlipUploadedPayload {
  sessionId: string;
  slipUrl:   string;
  filename:  string;
}

export interface GoalUpdatedPayload {
  label:         string;
  currentAmount: number;
  targetAmount:  number;
}

export interface TopDonatorsUpdatedPayload {
  donators: { senderName: string; total: number }[];
}

export interface TimerUpdatedPayload {
  endsAt:  string | null;
  enabled: boolean;
}

export interface ServerToClientEvents {
  [SOCKET_EVENTS.DONATION_VERIFIED]:    (payload: DonationAlertPayload)      => void;
  [SOCKET_EVENTS.SLIP_UPLOADED]:        (payload: SlipUploadedPayload)       => void;
  [SOCKET_EVENTS.GOAL_UPDATED]:         (payload: GoalUpdatedPayload)        => void;
  [SOCKET_EVENTS.TOP_DONATORS_UPDATED]: (payload: TopDonatorsUpdatedPayload) => void;
  [SOCKET_EVENTS.TIMER_UPDATED]:        (payload: TimerUpdatedPayload)       => void;
  [SOCKET_EVENTS.MANUAL_ALERT]:         (payload: DonationAlertPayload)      => void;
}

export interface ClientToServerEvents {
  'join:session': (sessionId: string) => void;
}