import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { socket } from '../lib/socket';
import type { DonationAlertPayload } from '@donation-app/shared-types';
import { SOCKET_EVENTS } from '@donation-app/shared-types';

const DISPLAY_DURATION_MS = 7000;
const CARD_CLIP = 'polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 0 100%)';

interface AlertState {
  active: DonationAlertPayload | null;
  queue: DonationAlertPayload[];
}

export default function OverlayPage() {
  const [state, setState] = useState<AlertState>({ active: null, queue: [] });

  function enqueueAlert(payload: DonationAlertPayload) {
    setState((prev) =>
      prev.active
        ? { active: prev.active, queue: [...prev.queue, payload] }
        : { active: payload, queue: prev.queue }
    );
  }

  function advanceQueue() {
    setState((prev) => {
      const [next, ...rest] = prev.queue;
      return { active: next ?? null, queue: rest };
    });
  }

  useEffect(() => {
    socket.connect();
    const handleDonation = (payload: DonationAlertPayload) => enqueueAlert(payload);

    socket.on(SOCKET_EVENTS.DONATION_VERIFIED, handleDonation);
    socket.on('connect', () => console.log('[overlay] connected to backend'));
    socket.on('disconnect', () => console.log('[overlay] disconnected from backend'));

    return () => {
      socket.off(SOCKET_EVENTS.DONATION_VERIFIED, handleDonation);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!state.active) return;
    const timer = setTimeout(advanceQueue, DISPLAY_DURATION_MS);
    return () => clearTimeout(timer);
  }, [state.active]);

  return (
    <div className="w-screen h-screen flex items-end justify-center pb-16">
      <AnimatePresence mode="wait">
        {state.active && (
          <motion.div
            key={state.active.donationId}
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: [0, 1, 0.5, 1], y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.6, times: [0, 0.5, 0.7, 1], ease: 'easeOut' }}
            style={{ clipPath: CARD_CLIP }}
            className="bg-panel border border-signal/30 shadow-[0_0_40px_rgba(56,225,198,0.25)] px-8 py-6 min-w-[420px] max-w-[560px]"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
              <span className="font-mono text-xs tracking-[0.2em] text-ink-muted uppercase">Signal detected</span>
            </div>
            <h1 className="font-display text-3xl text-ink uppercase tracking-wide truncate">
              {state.active.senderName}
            </h1>
            <p className="font-mono text-2xl text-gold mt-1">฿{state.active.amount.toLocaleString()}</p>
            {state.active.message && (
              <p className="font-body text-ink-muted mt-3 leading-relaxed break-words">{state.active.message}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}