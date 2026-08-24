import { useState, useEffect } from 'react';
import { socket } from '../../lib/socket';
import { api } from '../../lib/api';
import { SOCKET_EVENTS } from '@donation-app/shared-types';
import type { GoalUpdatedPayload } from '@donation-app/shared-types';

// All appearance fields are fetched from /api/widget/goal alongside the data,
// so the OBS widget self-styles from whatever the streamer configured in the
// Admin Dashboard — no separate config file needed.
interface GoalState {
  label:             string;
  currentAmount:     number;
  targetAmount:      number;
  goalEndsAt:        string | null;
  goalBarColor:      string;
  goalTextColor:     string;
  goalFont:          string;
  goalShowCountdown: boolean;
  goalShowPercent:   boolean;
}

// Ticks every second and returns a human-readable remaining-time string.
// Returns '' when endsAt is null (no deadline set).
// Returns 'Ended' when the deadline has passed.
function useCountdown(endsAt: string | null): string {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!endsAt) { setDisplay(''); return; }

    function tick() {
      const diff = new Date(endsAt!).getTime() - Date.now();
      if (diff <= 0) { setDisplay('Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      // Show days when >= 1 day left, otherwise show h/m/s for precision
      setDisplay(d > 0 ? `${d}d ${h}h ${m}m left` : `${h}h ${m}m ${s}s left`);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return display;
}

const TEXT_SHADOW = '0 0 4px rgba(0,0,0,0.9), 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000';

export default function GoalWidget() {
  const [goal, setGoal] = useState<GoalState | null>(null);

  // countdown re-evaluates every second from the stored endsAt timestamp
  const countdown = useCountdown(goal?.goalEndsAt ?? null);

  useEffect(() => {
    api.get<GoalState>('/api/widget/goal')
      .then(({ data }) => setGoal(data))
      .catch(console.error);

    socket.connect();

    const handleGoalUpdate = (payload: GoalUpdatedPayload) => {
      // Socket payload carries data fields only — merge into existing state
      // so appearance settings fetched on mount are preserved.
      setGoal((prev) => prev ? {
        ...prev,
        label:         payload.label,
        currentAmount: payload.currentAmount,
        targetAmount:  payload.targetAmount,
      } : null);
    };

    socket.on(SOCKET_EVENTS.GOAL_UPDATED, handleGoalUpdate);
    return () => {
      socket.off(SOCKET_EVENTS.GOAL_UPDATED, handleGoalUpdate);
      socket.disconnect();
    };
  }, []);

  if (!goal) return null;

  const percent    = goal.targetAmount > 0
    ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100)
    : 0;
  const isComplete = percent >= 100;
  const fontStyle  = {
    fontFamily: `'${goal.goalFont}', sans-serif`,
    color:      goal.goalTextColor,
    textShadow: TEXT_SHADOW,
  };

  return (
    <div className="bg-transparent p-4 min-w-105 max-w-140 select-none">

      {/* Label + countdown row */}
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <h2 className="text-4xl font-bold uppercase tracking-wide truncate" style={fontStyle}>
          {goal.label}
        </h2>

        {/* Only rendered when countdown is enabled AND a deadline is set */}
        {goal.goalShowCountdown && countdown && (
          <span
            className="font-mono text-base shrink-0 leading-none"
            style={{ color: goal.goalBarColor, textShadow: TEXT_SHADOW }}
          >
            ⏰ {countdown}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-5 bg-black/40 rounded-sm overflow-hidden mb-2">
        <div
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${percent}%`, background: isComplete ? '#FFB627' : goal.goalBarColor }}
        />
        <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent pointer-events-none" />

        {goal.goalShowPercent && (
          <span
            className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-white"
            style={{ textShadow: TEXT_SHADOW }}
          >
            {percent.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Amount row */}
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono text-3xl font-bold"
          style={{ color: goal.goalBarColor, textShadow: TEXT_SHADOW }}
        >
          ฿{goal.currentAmount.toLocaleString()}
        </span>
        <span
          className="font-mono text-xl"
          style={{ color: goal.goalTextColor, opacity: 0.7, textShadow: TEXT_SHADOW }}
        >
          / ฿{goal.targetAmount.toLocaleString()}
        </span>
      </div>

      {/* Completion badge */}
      {isComplete && (
        <div
          className="mt-3 text-center text-2xl font-bold uppercase tracking-widest"
          style={{ color: '#FFB627', textShadow: '0 0 20px rgba(255,182,39,0.8)', fontFamily: `'${goal.goalFont}', sans-serif` }}
        >
          🎉 Goal reached!
        </div>
      )}
    </div>
  );
}
