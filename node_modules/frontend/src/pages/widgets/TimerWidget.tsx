import { useState, useEffect, useRef } from 'react';
import { socket } from '../../lib/socket';
import { api } from '../../lib/api';
import { SOCKET_EVENTS } from '@donation-app/shared-types';
import type { TimerUpdatedPayload } from '@donation-app/shared-types';

interface TimerState {
  endsAt?:             string | null;
  timerEndsAt?:        string | null;
  enabled?:            boolean;
  timerEnabled?:       boolean;
  timerFont:           string;
  timerTextColor:      string;
  timerExpiredColor:   string;
  timerBackgroundColor: string;
  timerLayout:         string;
  timerAnimation:      string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h   = Math.floor(ms / 3600000);
  const m   = Math.floor((ms % 3600000) / 60000);
  const s   = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function TimerWidget() {
  const [state,   setState]   = useState<TimerState | null>(null);
  const [display, setDisplay] = useState('00:00:00');
  const [expired, setExpired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTick(targetTime: string | null | undefined) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!targetTime) { setDisplay('00:00:00'); setExpired(false); return; }

    function tick() {
      const remaining = new Date(targetTime!).getTime() - Date.now();
      if (remaining <= 0) {
        setDisplay('00:00:00');
        setExpired(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      setExpired(false);
      setDisplay(formatDuration(remaining));
    }

    tick();
    intervalRef.current = setInterval(tick, 250);
  }

  useEffect(() => {
    api.get<TimerState>('/api/widget/timer')
      .then(({ data }) => { 
        setState(data); 
        // รองรับชื่อตัวแปรทั้งจาก API ดั้งเดิม และเผื่อชื่อใหม่
        startTick(data.endsAt ?? data.timerEndsAt); 
      })
      .catch(console.error);

    socket.connect();

    const handleUpdate = (payload: TimerUpdatedPayload) => {
      setState((prev) => prev ? { ...prev, endsAt: payload.endsAt, enabled: payload.enabled } : null);
      startTick(payload.endsAt);
    };

    socket.on(SOCKET_EVENTS.TIMER_UPDATED, handleUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.TIMER_UPDATED, handleUpdate);
      socket.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

if (!state) return null;
  const isWidgetEnabled = state?.enabled ?? state?.timerEnabled;
  if (!isWidgetEnabled) return null;

  const activeColor = expired ? state.timerExpiredColor : state.timerTextColor;
  const fontFace    = { fontFamily: `'${state.timerFont}', monospace` };
  const glowFilter  = state.timerAnimation === 'glow'
    ? { filter: `drop-shadow(0 0 12px ${activeColor}) drop-shadow(0 0 4px ${activeColor})` }
    : {};
  const pulseClass  = state.timerAnimation === 'pulse' && !expired ? 'animate-pulse' : '';
  const textShadow  = '0 0 4px rgba(0,0,0,0.8), 1px 1px 0 #000, -1px -1px 0 #000';

  const bg = state.timerBackgroundColor === 'transparent'
    ? 'transparent'
    : state.timerBackgroundColor;

  // ── Circle layout ────────────────────────────────────────────────────────
  if (state.timerLayout === 'circle') {
    return (
      <div style={{ background: bg, padding: '16px', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '180px', height: '180px', borderRadius: '50%', border: `3px solid ${activeColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', ...glowFilter }}>
          <span className={pulseClass} style={{ ...fontFace, fontSize: '36px', fontWeight: 700, letterSpacing: '2px', color: activeColor, textShadow }}>
            {display}
          </span>
          <span style={{ ...fontFace, fontSize: '11px', color: activeColor, opacity: 0.5, letterSpacing: '3px', textTransform: 'uppercase', marginTop: '4px' }}>
            {expired ? "Time's up!" : 'Remaining'}
          </span>
        </div>
      </div>
    );
  }

  // ── Minimal layout ───────────────────────────────────────────────────────
  if (state.timerLayout === 'minimal') {
    return (
      <div style={{ background: bg, padding: '12px', display: 'inline-block' }}>
        <span className={pulseClass} style={{ ...fontFace, ...glowFilter, fontSize: '56px', fontWeight: 700, letterSpacing: '6px', color: activeColor, textShadow, display: 'block' }}>
          {display}
        </span>
        {expired && (
          <span style={{ ...fontFace, fontSize: '13px', color: activeColor, opacity: 0.7, letterSpacing: '2px', textTransform: 'uppercase', display: 'block', textAlign: 'center', marginTop: '4px' }}>
            Time's up!
          </span>
        )}
      </div>
    );
  }

  // ── Digital layout (default) ─────────────────────────────────────────────
  return (
    <div style={{ background: bg, padding: '16px', display: 'inline-block', textAlign: 'center' }}>
      <div style={{ ...fontFace, fontSize: '11px', color: activeColor, opacity: 0.45, letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '4px' }}>
        {expired ? "Time's up!" : 'Time remaining'}
      </div>
      <span className={pulseClass} style={{ ...fontFace, ...glowFilter, fontSize: '58px', fontWeight: 700, letterSpacing: '6px', color: activeColor, textShadow, display: 'block', lineHeight: 1 }}>
        {display}
      </span>
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '6px' }}>
        {['HH', 'MM', 'SS'].map((u) => (
          <span key={u} style={{ ...fontFace, fontSize: '10px', color: activeColor, opacity: 0.4, letterSpacing: '2px' }}>{u}</span>
        ))}
      </div>
    </div>
  );
}