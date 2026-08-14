import { useState, useEffect, useRef } from 'react';
import { socket } from '../../lib/socket';
import { api } from '../../lib/api';
import { SOCKET_EVENTS } from '@donation-app/shared-types';
import type { TimerUpdatedPayload } from '@donation-app/shared-types';

interface TimerState {
  endsAt:  string | null;
  enabled: boolean;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function TimerWidget() {
  const [timerState, setTimerState] = useState<TimerState | null>(null);
  const [display,    setDisplay]    = useState('00:00:00');
  const [expired,    setExpired]    = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startTick(endsAt: string | null) {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!endsAt) { setDisplay('00:00:00'); setExpired(false); return; }

    function tick() {
      const remaining = new Date(endsAt!).getTime() - Date.now();
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
    intervalRef.current = setInterval(tick, 250); // 250ms for smooth seconds
  }

  useEffect(() => {
    api.get<TimerState>('/api/widget/timer')
      .then(({ data }) => {
        setTimerState(data);
        startTick(data.endsAt);
      })
      .catch(console.error);

    socket.connect();

    const handleTimerUpdate = (payload: TimerUpdatedPayload) => {
      setTimerState({ endsAt: payload.endsAt, enabled: payload.enabled });
      startTick(payload.endsAt);
    };

    socket.on(SOCKET_EVENTS.TIMER_UPDATED, handleTimerUpdate);

    return () => {
      socket.off(SOCKET_EVENTS.TIMER_UPDATED, handleTimerUpdate);
      socket.disconnect();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // startTick is stable (ref-based), safe to omit from deps
  }, []);

  if (!timerState?.enabled) return null;

  return (
    <div style={{ background: 'transparent', padding: '16px', fontFamily: 'monospace', color: '#fff', textAlign: 'center' }}>
      <div style={{
        fontSize: '48px',
        fontWeight: 700,
        letterSpacing: '4px',
        color: expired ? '#FF3B5C' : '#38E1C6',
        textShadow: '0 0 20px currentColor',
      }}>
        {display}
      </div>
      {expired && (
        <div style={{ fontSize: '14px', marginTop: '8px', color: '#FF3B5C', opacity: 0.8 }}>
          Time's up!
        </div>
      )}
    </div>
  );
}
