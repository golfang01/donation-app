export const SOCKET_EVENTS = {
  DONATION_VERIFIED: 'donation:verified',
  SLIP_UPLOADED:     'slip:uploaded',
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

export interface ServerToClientEvents {
  [SOCKET_EVENTS.DONATION_VERIFIED]: (payload: DonationAlertPayload) => void;
  [SOCKET_EVENTS.SLIP_UPLOADED]:     (payload: SlipUploadedPayload)  => void;
}

export interface ClientToServerEvents {
  'join:session': (sessionId: string) => void;
}