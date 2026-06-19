// Centralized event name constants — avoids typo bugs from
// hardcoding 'donation:verified' as a raw string in multiple places.
export const SOCKET_EVENTS = {
  DONATION_VERIFIED: 'donation:verified',
} as const;

// The exact payload pushed to the OBS overlay the instant
// SlipOK confirms a transaction.
export interface DonationAlertPayload {
  donationId: string;
  senderName: string;
  message: string | null;
  amount: number;
  verifiedAt: string; // ISO 8601 string
}

// Typed event maps — pass these as generics to Socket.io's
// Server<ClientToServerEvents, ServerToClientEvents> for
// compile-time-checked .emit() and .on() calls.
export interface ServerToClientEvents {
  [SOCKET_EVENTS.DONATION_VERIFIED]: (payload: DonationAlertPayload) => void;
}

// The overlay is a passive listener; it never emits anything back.
// Kept as an empty interface so the generic still type-checks.
export interface ClientToServerEvents {
  // intentionally empty for now
}