import { useState, useEffect } from 'react';
import { socket } from '../../lib/socket';
import { api } from '../../lib/api';
import { SOCKET_EVENTS } from '@donation-app/shared-types';
import type { GoalUpdatedPayload } from '@donation-app/shared-types';

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

function useCountdown(endsAt: string | null): string {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!endsAt) { setDisplay(''); return; }
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setDisplay('Ended'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return display;
}

const SHADOW = '0 0 4px rgba(0,0,0,0.9),1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000';

export default function GoalWidget() {
  const [goal, setGoal] = useState<GoalState | null>(null);
  const countdown = useCountdown(goal?.goalEndsAt ?? null);

  useEffect(() => {
    api.get<GoalState>('/api/widget/goal').then(({ data }) => setGoal(data)).catch(console.error);
    socket.connect();
    const handleUpdate = (payload: GoalUpdatedPayload) => {
      setGoal((prev) => prev ? { ...prev, ...payload } : null);
    };
    socket.on(SOCKET_EVENTS.GOAL_UPDATED, handleUpdate);
    return () => { socket.off(SOCKET_EVENTS.GOAL_UPDATED, handleUpdate); socket.disconnect(); };
  }, []);

  if (!goal) return null;

  const percent    = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
  const isComplete = percent >= 100;
  const fontStyle  = { fontFamily: `'${goal.goalFont}', sans-serif`, color: goal.goalTextColor, textShadow: SHADOW };

  return (
    <div className="bg-transparent p-4 min-w-90 max-w-140 select-none">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-4xl font-bold uppercase tracking-wide" style={fontStyle}>{goal.label}</h2>
        {goal.goalShowCountdown && countdown && (
          <span className="text-lg font-mono" style={{ ...fontStyle, color: goal.goalBarColor }}>{countdown}</span>
        )}
      </div>

      <div className="relative h-5 rounded-sm overflow-hidden mb-2" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="h-full transition-all duration-700 ease-out" style={{ width: `${percent}%`, background: isComplete ? '#FFB627' : goal.goalBarColor }} />
        <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent pointer-events-none" />
        {goal.goalShowPercent && (
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white" style={{ textShadow: SHADOW }}>
            {percent.toFixed(1)}%
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-3xl font-bold font-mono" style={{ ...fontStyle, color: goal.goalBarColor }}>฿{goal.currentAmount.toLocaleString()}</span>
        <span className="text-xl font-mono" style={{ ...fontStyle, color: goal.goalTextColor, opacity: 0.7 }}>/ ฿{goal.targetAmount.toLocaleString()}</span>
      </div>

      {isComplete && (
        <div className="mt-3 text-center text-2xl uppercase tracking-widest font-bold" style={{ color: '#FFB627', textShadow: '0 0 20px rgba(255,182,39,0.8)', fontFamily: `'${goal.goalFont}', sans-serif` }}>
          🎉 Goal reached!
        </div>
      )}
    </div>
  );
}