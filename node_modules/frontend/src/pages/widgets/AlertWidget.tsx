import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { socket } from '../../lib/socket';
import { api } from '../../lib/api';
import { SOCKET_EVENTS } from '@donation-app/shared-types';
import type { DonationAlertPayload } from '@donation-app/shared-types';

interface AlertAppearance {
  alertFont:        string;
  alertTextColor:   string;
  alertAccentColor: string;
  alertGifUrl:      string;
  alertSoundUrl:    string;
  alertAnimation:   string;
  alertDuration:    number;
  alertTtsEnabled:  boolean;
  alertShowGif:     boolean;
}

interface AlertState {
  active: DonationAlertPayload | null;
  queue:  DonationAlertPayload[];
}

const TEXT_SHADOW = '0 0 4px rgba(0,0,0,0.9),1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000';
const CARD_CLIP   = 'polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 0 100%)';

function getVariants(animation: string) {
  const map: Record<string, { initial: object; animate: object; exit: object }> = {
    'slide-up': {
      initial: { opacity: 0, y: 40,  scale: 0.96 },
      animate: { opacity: 1, y: 0,   scale: 1    },
      exit:    { opacity: 0, y: -20, scale: 0.98 },
    },
    'fade': {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1    },
      exit:    { opacity: 0, scale: 1.02 },
    },
    'bounce': {
      initial: { opacity: 0, scale: 0.5,  y: 60 },
      animate: { opacity: 1, scale: 1,    y: 0   },
      exit:    { opacity: 0, scale: 0.85, y: -20 },
    },
  };
  return map[animation] ?? map['slide-up'];
}

function getTransition(animation: string) {
  return animation === 'bounce'
    ? { type: 'spring', stiffness: 300, damping: 20 }
    : { duration: 0.5, ease: 'easeOut' };
}

export default function AlertWidget() {
  const [appearance, setAppearance] = useState<AlertAppearance | null>(null);
  const [state,      setState]      = useState<AlertState>({ active: null, queue: [] });
  const soundRef    = useRef<HTMLAudioElement | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch appearance config on mount so the widget self-styles from the DB
  useEffect(() => {
    api.get<AlertAppearance>('/api/widget/overlay')
      .then(({ data }) => setAppearance(data))
      .catch(console.error);
  }, []);

  // Reload sound whenever the custom URL changes
  useEffect(() => {
    if (!appearance) return;
    const src   = appearance.alertSoundUrl.trim() || '/sounds/donation-alert.mp3';
    const audio = new Audio(src);
    audio.volume  = 0.7;
    audio.preload = 'auto';
    soundRef.current = audio;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance?.alertSoundUrl]);

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
    const handle = (payload: DonationAlertPayload) => enqueueAlert(payload);
    socket.on(SOCKET_EVENTS.DONATION_VERIFIED, handle);
    socket.on('connect',    () => console.log('[alert-widget] connected'));
    socket.on('disconnect', () => console.log('[alert-widget] disconnected'));
    return () => { socket.off(SOCKET_EVENTS.DONATION_VERIFIED, handle); socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (!state.active || !appearance) return;
    // Give messages extra time so TTS can finish reading
    const duration = state.active.message
      ? Math.max(appearance.alertDuration, 9000)
      : appearance.alertDuration;
    const t = setTimeout(advanceQueue, duration);
    return () => clearTimeout(t);
  }, [state.active, appearance]);

  const activeDonationId = state.active?.donationId;
  const activeMessage    = state.active?.message;

  useEffect(() => {
    if (!activeDonationId || !appearance) return;
    let cancelled = false;

    async function speakMessage() {
      if (!activeMessage || cancelled || !appearance?.alertTtsEnabled) return;
      try {
        const { data } = await api.post<{ audioContent: string }>(
          '/api/tts/synthesize', { text: activeMessage }, { timeout: 10000 }
        );
        if (cancelled) return;
        const ttsAudio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        ttsAudio.volume = 0.7;
        ttsAudioRef.current = ttsAudio;
        await ttsAudio.play();
      } catch (err) {
        console.warn('[alert-widget] TTS failed:', err);
      }
    }

    const sound = soundRef.current;
    if (sound) {
      sound.currentTime = 0;
      sound.onended = () => speakMessage();
      sound.play().catch(() => speakMessage());
    } else {
      speakMessage();
    }

    return () => {
      cancelled = true;
      if (sound) { sound.onended = null; sound.pause(); }
      ttsAudioRef.current?.pause();
      ttsAudioRef.current = null;
    };
  }, [activeDonationId, activeMessage, appearance]);

  if (!appearance) return null;

  const vars       = getVariants(appearance.alertAnimation);
  const transition = getTransition(appearance.alertAnimation);
  const fontFace   = { fontFamily: `'${appearance.alertFont}', sans-serif` };

  return (
    <div className="w-screen h-screen flex items-end justify-center pb-16">
      <AnimatePresence mode="wait">
        {state.active && (
          <motion.div
          /* eslint-disable @typescript-eslint/no-explicit-any */
            key={state.active.donationId}
            initial={vars.initial as any}
            animate={vars.animate as any}
            exit={vars.exit as any}
            transition={transition as any}
            style={{ clipPath: CARD_CLIP as any, WebkitClipPath: CARD_CLIP as any }}
            className="min-w-105 max-w-140 overflow-hidden"
          >
            {/* Optional GIF / image banner */}
            {appearance.alertShowGif && appearance.alertGifUrl && (
              <img
                src={appearance.alertGifUrl}
                alt=""
                className="w-full object-cover"
                style={{ maxHeight: '160px', display: 'block' }}
              />
            )}

            {/* Card body */}
            <div
              className="px-8 py-6"
              style={{
                background:   '#131820',
                borderLeft:   `3px solid ${appearance.alertAccentColor}`,
                borderRight:  '1px solid rgba(255,255,255,0.06)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: appearance.alertAccentColor }} />
                <span className="font-mono text-xs tracking-[0.2em] uppercase"
                  style={{ color: appearance.alertAccentColor, textShadow: TEXT_SHADOW }}>
                  Signal detected
                </span>
              </div>

              <h1 className="text-3xl font-bold uppercase tracking-wide truncate"
                style={{ ...fontFace, color: appearance.alertTextColor, textShadow: TEXT_SHADOW }}>
                {state.active.senderName}
              </h1>

              <p className="font-mono text-2xl mt-1"
                style={{ color: appearance.alertAccentColor, textShadow: TEXT_SHADOW }}>
                ฿{state.active.amount.toLocaleString()}
              </p>

              {state.active.message && (
                <p className="mt-3 text-sm leading-relaxed wrap-break-word"
                  style={{ ...fontFace, color: appearance.alertTextColor, opacity: 0.75, textShadow: TEXT_SHADOW }}>
                  {state.active.message}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
