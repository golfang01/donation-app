import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import {
  LogOut, RefreshCw, Loader2,
  TrendingUp, Users, Repeat2, Zap,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface Donation {
  id: string; senderName: string; message: string | null;
  amount: number; verificationStatus: string; source: string;
  slipImageUrl: string | null; createdAt: string;
}
interface Stats {
  todayTotal: number; todayCount: number;
  topDonators: { senderName: string; total: number }[];
}
interface PaginatedDonations {
  data: Donation[];
  meta: { total: number; page: number; totalPages: number };
}
interface Settings {
  slipOkMode: string; minTtsAmount: number; profanityList: string[] | string;
  goalLabel: string; goalTargetAmount: number; goalCurrentAmount: number;
  goalEndsAt: string | null; goalBarColor: string; goalTextColor: string;
  goalFont: string; goalShowCountdown: boolean; goalShowPercent: boolean;
  topDonatorsLimit: number; topFont: string; topTextColor: string;
  topAccentColor: string; topBarColor: string; topLayout: string; topShowBar: boolean;
  timerEnabled: boolean; timerEndsAt: string | null;
  timerBaseAmount: number; timerBaseMinutes: number;
  timerFont: string; timerTextColor: string; timerExpiredColor: string;
  timerBackgroundColor: string; timerLayout: string; timerAnimation: string;
  alertFont: string; alertTextColor: string; alertAccentColor: string;
  alertGifUrl: string; alertSoundUrl: string; alertAnimation: string;
  alertDuration: number; alertTtsEnabled: boolean; alertShowGif: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────
const PANEL_CLIP    = 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)';
const FRONTEND_BASE = (import.meta.env.VITE_API_BASE_URL as string)?.replace(':4000', ':5173') ?? 'http://localhost:5173';
const TEXT_SHADOW   = '0 0 4px rgba(0,0,0,0.9),1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000';

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: 'text-signal bg-signal/10 border-signal/20',
  FAILED:   'text-live   bg-live/10   border-live/20',
  PENDING:  'text-gold   bg-gold/10   border-gold/20',
  MANUAL:   'text-ink-muted bg-white/5 border-white/10',
};

const FONT_OPTIONS = [
  { value: 'Oswald',         label: 'Oswald',          sample: 'Goal' },
  { value: 'Inter',          label: 'Inter',            sample: 'Goal' },
  { value: 'IBM Plex Mono',  label: 'IBM Plex Mono',    sample: 'Goal' },
  { value: 'Impact',         label: 'Impact',           sample: 'Goal' },
];

const GOAL_PRESETS = [
  { name: 'Teal',   bar: '#38E1C6', text: '#FFFFFF' },
  { name: 'Gold',   bar: '#FFB627', text: '#FFFFFF' },
  { name: 'Pink',   bar: '#FF3B5C', text: '#FFFFFF' },
  { name: 'Purple', bar: '#A855F7', text: '#FFFFFF' },
  { name: 'White',  bar: '#FFFFFF', text: '#FFFFFF' },
];

const TIMER_PRESETS = [
  { name: 'Teal',   text: '#38E1C6', expired: '#FF3B5C' },
  { name: 'Gold',   text: '#FFB627', expired: '#FF3B5C' },
  { name: 'White',  text: '#FFFFFF', expired: '#FF3B5C' },
  { name: 'Purple', text: '#A855F7', expired: '#FF3B5C' },
];

const TOP_PRESETS = [
  { name: 'Teal',   accent: '#FFB627', bar: '#38E1C6', text: '#FFFFFF' },
  { name: 'Gold',   accent: '#FFB627', bar: '#FFB627', text: '#FFFFFF' },
  { name: 'Pink',   accent: '#FF3B5C', bar: '#FF3B5C', text: '#FFFFFF' },
  { name: 'Purple', accent: '#A855F7', bar: '#A855F7', text: '#FFFFFF' },
];
const ALERT_PRESETS = [
  { name: 'Teal',   accent: '#38E1C6', text: '#FFFFFF' },
  { name: 'Gold',   accent: '#FFB627', text: '#FFFFFF' },
  { name: 'Pink',   accent: '#FF3B5C', text: '#FFFFFF' },
  { name: 'Purple', accent: '#A855F7', text: '#FFFFFF' },
];

const ALERT_CARD_CLIP = 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)';



// ── Reusable UI atoms ──────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="bg-panel border border-white/5 px-5 py-4" style={{ clipPath: PANEL_CLIP }}>
      <div className="flex items-center gap-2 mb-3">{icon}
        <p className="font-mono text-xs text-ink-muted uppercase tracking-wide">{label}</p>
      </div>
      <p className="font-display text-2xl text-ink uppercase">{value}</p>
      {sub && <p className="font-body text-xs text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
        {label}{hint && <span className="ml-2 text-white/30 normal-case font-body">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function TInput({ value, onChange, placeholder, type = 'text', min, step, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; min?: string; step?: string; className?: string;
}) {
  return (
    <input type={type} value={value} placeholder={placeholder} min={min} step={step}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-panel-raised border border-white/10 px-3 py-2 text-ink font-body text-sm focus:outline-none focus:border-signal/60 transition-colors ${className}`} />
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-10 h-9 cursor-pointer border border-white/10 bg-panel-raised rounded-none p-0.5" />
        <span className="font-mono text-xs text-ink-muted">{value}</span>
      </div>
    </Field>
  );
}

function ToggleBtn({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-4 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${on ? 'bg-signal/10 border-signal/40 text-signal' : 'border-white/10 text-ink-muted hover:border-white/20'}`}>
      {on ? '✅' : '⬜'} {label}
    </button>
  );
}

function SaveBar({ loading, result }: { loading: boolean; result: string | null }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <button type="submit" disabled={loading}
        className="flex items-center gap-2 bg-signal text-void font-display uppercase tracking-wide text-sm px-6 py-2 hover:bg-signal/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save settings'}
      </button>
      {result && <span className="font-mono text-xs text-ink-muted">{result}</span>}
    </div>
  );
}

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-white/5">
      <span className="text-signal text-sm">{emoji}</span>
      <h2 className="font-display text-lg uppercase tracking-wide">{title}</h2>
    </div>
  );
}

function PreviewFrame({ children, label = 'OBS' }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="relative rounded-sm overflow-hidden" style={{ background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)', minHeight: '160px' }}>
      <span className="absolute top-2 right-2 font-mono text-xs text-white/20 uppercase tracking-widest pointer-events-none">{label}</span>
      <div className="flex items-center justify-center min-h-40">{children}</div>
    </div>
  );
}

function WidgetUrl({ path }: { path: string }) {
  return (
    <p className="font-mono text-xs text-ink-muted mt-3">
      OBS URL: <code className="text-signal select-all">{FRONTEND_BASE}{path}</code>
    </p>
  );
}


// ── Live Preview: Alert ────────────────────────────────────────────────────
function AlertPreview({ font, textColor, accentColor, gifUrl, showGif, animation }: {
  font: string; textColor: string; accentColor: string;
  gifUrl: string; showGif: boolean; animation: string;
}) {
  const fontFace = { fontFamily: `'${font}', sans-serif` };
  const ts = '0 0 4px rgba(0,0,0,0.9),1px 1px 0 #000,-1px -1px 0 #000';
  const animLabel: Record<string,string> = { 'slide-up': '↑ slide-up', 'fade': '◎ fade', 'bounce': '⟳ bounce' };
  return (
    <div style={{ width: '100%', padding: '0 8px' }}>
      <div style={{ clipPath: ALERT_CARD_CLIP, overflow: 'hidden' }}>
        {showGif && gifUrl && (
          <img src={gifUrl} alt="" style={{ width: '100%', maxHeight: '90px', objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ background: '#131820', borderLeft: `3px solid ${accentColor}`, borderRight: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: accentColor, display: 'inline-block' }} />
            <span style={{ fontFamily: 'monospace', fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', color: accentColor, textShadow: ts }}>Signal detected</span>
          </div>
          <div style={{ ...fontFace, fontSize: '20px', fontWeight: 700, textTransform: 'uppercase', color: textColor, textShadow: ts }}>Nattapong</div>
          <div style={{ fontFamily: 'monospace', fontSize: '16px', color: accentColor, margin: '2px 0 6px', textShadow: ts }}>฿500</div>
          <div style={{ ...fontFace, fontSize: '11px', color: textColor, opacity: 0.7, textShadow: ts }}>ขอบคุณมากครับ! 🎉</div>
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: accentColor, opacity: 0.4, marginTop: '8px' }}>anim: {animLabel[animation] ?? animation}</div>
        </div>
      </div>
    </div>
  );
}

// ── Live Preview: Goal ─────────────────────────────────────────────────────
function GoalPreview({ label, current, target, endsAt, barColor, textColor, font, showCd, showPct }: {
  label: string; current: number; target: number; endsAt: string;
  barColor: string; textColor: string; font: string; showCd: boolean; showPct: boolean;
}) {
  const pct        = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const isComplete = pct >= 100;
  const fs         = { fontFamily: `'${font}', sans-serif`, color: textColor, textShadow: TEXT_SHADOW };
  let cd = '';
  if (showCd && endsAt) {
    // eslint-disable-next-line react-hooks/purity
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff > 0) { const h = Math.floor(diff / 3600000); const m = Math.floor((diff % 3600000) / 60000); cd = `${h}h ${m}m`; }
  }
  return (
    <div className="p-4 select-none w-full">
      <div className="flex items-baseline justify-between mb-2 gap-2">
        <span className="text-3xl font-bold uppercase tracking-wide truncate" style={fs}>{label || 'Goal Label'}</span>
        {cd && <span className="text-sm font-mono shrink-0" style={{ ...fs, color: barColor }}>⏰ {cd}</span>}
      </div>
      <div className="relative h-5 rounded-sm overflow-hidden mb-2" style={{ background: 'rgba(0,0,0,0.5)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: isComplete ? '#FFB627' : barColor }} />
        <div className="absolute inset-0 bg-linear-to-b from-white/10 to-transparent pointer-events-none" />
        {showPct && <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white" style={{ textShadow: TEXT_SHADOW }}>{pct.toFixed(1)}%</span>}
      </div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-bold font-mono" style={{ ...fs, color: barColor }}>฿{current.toLocaleString()}</span>
        <span className="text-base font-mono" style={{ ...fs, opacity: 0.6 }}>/ ฿{target.toLocaleString()}</span>
      </div>
      {isComplete && <div className="mt-2 text-center text-xl font-bold uppercase tracking-widest" style={{ color: '#FFB627', textShadow: '0 0 20px rgba(255,182,39,0.7)', fontFamily: `'${font}', sans-serif` }}>🎉 Goal reached!</div>}
    </div>
  );
}

// ── Live Preview: Timer ────────────────────────────────────────────────────
function TimerPreview({ font, textColor, layout, animation }: {
  font: string; textColor: string; expiredColor: string; layout: string; animation: string;
}) {
  // Static display representing ~47 mins remaining for preview purposes
  const display  = '00:47:23';
  const fontFace = { fontFamily: `'${font}', monospace`, textShadow: TEXT_SHADOW };
  const glow     = animation === 'glow' ? { filter: `drop-shadow(0 0 8px ${textColor})` } : {};
  const pulse    = animation === 'pulse' ? 'animate-pulse' : '';

  if (layout === 'minimal') {
    return (
      <div className="p-4 select-none text-center">
        <span className={`text-5xl font-bold tracking-widest ${pulse}`}
          style={{ ...fontFace, color: textColor, ...glow }}>{display}</span>
      </div>
    );
  }

  if (layout === 'circle') {
    return (
      <div className="p-4 select-none flex flex-col items-center gap-2">
        <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center" style={{ borderColor: textColor }}>
          <span className={`text-2xl font-bold ${pulse}`} style={{ ...fontFace, color: textColor, ...glow }}>{display}</span>
        </div>
        <span className="font-mono text-xs uppercase tracking-widest" style={{ color: textColor, opacity: 0.6 }}>Remaining</span>
      </div>
    );
  }

  // Default: digital
  return (
    <div className="p-4 select-none">
      <div className="font-mono text-xs uppercase tracking-widest mb-1 text-center" style={{ color: textColor, opacity: 0.5 }}>Time remaining</div>
      <span className={`text-5xl font-bold tracking-widest block text-center ${pulse}`}
        style={{ ...fontFace, color: textColor, ...glow }}>{display}</span>
      <div className="flex justify-center gap-6 mt-1">
        {['HH', 'MM', 'SS'].map((u) => (
          <span key={u} className="font-mono text-xs uppercase" style={{ color: textColor, opacity: 0.4 }}>{u}</span>
        ))}
      </div>
    </div>
  );
}

// ── Live Preview: Top Donators ─────────────────────────────────────────────
function TopDonatorsPreview({ font, textColor, accentColor, barColor, layout, showBar, limit }: {
  font: string; textColor: string; accentColor: string; barColor: string;
  layout: string; showBar: boolean; limit: number;
}) {
  const SAMPLE = [
    { name: 'Nattapong', total: 3200 },
    { name: 'Somchai',   total: 2100 },
    { name: 'Wanida',    total: 1500 },
    { name: 'Krit',      total: 900  },
    { name: 'Ploy',      total: 650  },
  ].slice(0, Math.min(limit, 5));

  const maxTotal = SAMPLE[0]?.total ?? 1;
  const fontFace = { fontFamily: `'${font}', sans-serif` };

  if (layout === 'podium' && SAMPLE.length >= 3) {
    const [first, second, third, ...rest] = SAMPLE;
    const heights = ['h-20', 'h-14', 'h-10'];
    const podium  = [second, first, third];
    const pColors = [textColor, accentColor, textColor];
    return (
      <div className="p-4 select-none w-full">
        <div className="flex items-end justify-center gap-2 mb-3">
          {podium.map((d, i) => (
            <div key={d.name} className={`flex flex-col items-center gap-1 ${heights[i]} justify-end`}>
              <span className="text-xs font-bold truncate max-w-15" style={{ ...fontFace, color: pColors[i], textShadow: TEXT_SHADOW }}>{d.name}</span>
              <span className="text-xs font-mono" style={{ color: pColors[i], opacity: 0.8, textShadow: TEXT_SHADOW }}>฿{d.total.toLocaleString()}</span>
              <div className="w-14 flex items-center justify-center py-1 text-void font-bold text-sm" style={{ background: pColors[i] }}>{i === 1 ? '1' : i === 0 ? '2' : '3'}</div>
            </div>
          ))}
        </div>
        {rest.map((d, i) => (
          <div key={d.name} className="flex justify-between text-xs py-0.5" style={{ ...fontFace, color: textColor, textShadow: TEXT_SHADOW }}>
            <span>{i + 4}. {d.name}</span>
            <span style={{ color: barColor }}>฿{d.total.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 select-none w-full space-y-2">
      <div className="font-mono text-xs uppercase tracking-widest mb-2" style={{ color: textColor, opacity: 0.5, ...fontFace }}>Top {limit} Donators</div>
      {SAMPLE.map((d, i) => (
        <div key={d.name} className="space-y-1">
          <div className="flex justify-between text-sm" style={fontFace}>
            <span style={{ color: textColor, textShadow: TEXT_SHADOW }}>
              <span style={{ color: accentColor, marginRight: '6px' }}>#{i + 1}</span>{d.name}
            </span>
            <span className="font-mono font-bold" style={{ color: accentColor, textShadow: TEXT_SHADOW }}>฿{d.total.toLocaleString()}</span>
          </div>
          {showBar && (
            <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(d.total / maxTotal) * 100}%`, background: i === 0 ? accentColor : barColor, opacity: i === 0 ? 1 : 0.6 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { username, logout } = useAuth();

  const [stats,        setStats]        = useState<Stats | null>(null);
  const [donations,    setDonations]    = useState<Donation[]>([]);
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [loadingData,  setLoadingData]  = useState(true);
  const [replayingId,  setReplayingId]  = useState<string | null>(null);
  const [replaySuccess,setReplaySuccess]= useState<string | null>(null);

  const [triggerName,    setTriggerName]    = useState('');
  const [triggerMessage, setTriggerMessage] = useState('');
  const [triggerAmount,  setTriggerAmount]  = useState('');
  const [triggering,     setTriggering]     = useState(false);
  const [triggerResult,  setTriggerResult]  = useState<string | null>(null);

  const [loaded, setLoaded] = useState(false);

  // System
  const [slipOkMode,     setSlipOkMode]     = useState('mock');
  const [minTtsAmount,   setMinTtsAmount]   = useState('0');
  const [profanityInput, setProfanityInput] = useState('');
  const [savingSystem,   setSavingSystem]   = useState(false);
  const [systemResult,   setSystemResult]   = useState<string | null>(null);

  // Goal
  const [goalLabel,     setGoalLabel]     = useState('');
  const [goalTarget,    setGoalTarget]    = useState('');
  const [goalCurrent,   setGoalCurrent]   = useState('');
  const [goalEndsAt,    setGoalEndsAt]    = useState('');
  const [goalBarColor,  setGoalBarColor]  = useState('#38E1C6');
  const [goalTextColor, setGoalTextColor] = useState('#FFFFFF');
  const [goalFont,      setGoalFont]      = useState('Oswald');
  const [goalShowCd,    setGoalShowCd]    = useState(true);
  const [goalShowPct,   setGoalShowPct]   = useState(true);
  const [savingGoal,    setSavingGoal]    = useState(false);
  const [goalResult,    setGoalResult]    = useState<string | null>(null);

  // Top donators
  const [topLimit,      setTopLimit]      = useState('5');
  const [topFont,       setTopFont]       = useState('Oswald');
  const [topTextColor,  setTopTextColor]  = useState('#FFFFFF');
  const [topAccent,     setTopAccent]     = useState('#FFB627');
  const [topBarColor,   setTopBarColor]   = useState('#38E1C6');
  const [topLayout,     setTopLayout]     = useState('list');
  const [topShowBar,    setTopShowBar]    = useState(true);
  const [savingTop,     setSavingTop]     = useState(false);
  const [topResult,     setTopResult]     = useState<string | null>(null);

  // Timer
  const [timerEnabled,  setTimerEnabled]  = useState(false);
  const [timerEndsAt,   setTimerEndsAt]   = useState<string | null>(null);
  const [timerBaseAmt,  setTimerBaseAmt]  = useState('100');
  const [timerBaseMins, setTimerBaseMins] = useState('1');
  const [timerFont,     setTimerFont]     = useState('IBM Plex Mono');
  const [timerText,     setTimerText]     = useState('#38E1C6');
  const [timerExpired,  setTimerExpired]  = useState('#FF3B5C');
  const [timerLayout,   setTimerLayout]   = useState('digital');
  const [timerAnim,     setTimerAnim]     = useState('pulse');
  const [savingTimer,   setSavingTimer]   = useState(false);
  const [timerResult,   setTimerResult]   = useState<string | null>(null);
  // Alert overlay appearance
  const [alertFont,      setAlertFont]      = useState('Oswald');
  const [alertTextColor, setAlertTextColor] = useState('#FFFFFF');
  const [alertAccent,    setAlertAccent]    = useState('#38E1C6');
  const [alertGifUrl,    setAlertGifUrl]    = useState('');
  const [alertSoundUrl,  setAlertSoundUrl]  = useState('');
  const [alertAnimation, setAlertAnimation] = useState('slide-up');
  const [alertDuration,  setAlertDuration]  = useState('7000');
  const [alertTts,       setAlertTts]       = useState(true);
  const [alertShowGif,   setAlertShowGif]   = useState(false);
  const [savingAlert,    setSavingAlert]    = useState(false);
  const [alertResult,    setAlertResult]    = useState<string | null>(null);

  function toLocal(iso: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function sync(s: Settings) {
    setSlipOkMode(s.slipOkMode); setMinTtsAmount(String(s.minTtsAmount));
    setProfanityInput(Array.isArray(s.profanityList) ? s.profanityList.join(', ') : String(s.profanityList ?? ''));
    setGoalLabel(s.goalLabel); setGoalTarget(String(s.goalTargetAmount)); setGoalCurrent(String(s.goalCurrentAmount));
    setGoalEndsAt(toLocal(s.goalEndsAt)); setGoalBarColor(s.goalBarColor ?? '#38E1C6');
    setGoalTextColor(s.goalTextColor ?? '#FFFFFF'); setGoalFont(s.goalFont ?? 'Oswald');
    setGoalShowCd(s.goalShowCountdown ?? true); setGoalShowPct(s.goalShowPercent ?? true);
    setTopLimit(String(s.topDonatorsLimit)); setTopFont(s.topFont ?? 'Oswald');
    setTopTextColor(s.topTextColor ?? '#FFFFFF'); setTopAccent(s.topAccentColor ?? '#FFB627');
    setTopBarColor(s.topBarColor ?? '#38E1C6'); setTopLayout(s.topLayout ?? 'list');
    setTopShowBar(s.topShowBar ?? true);
    setTimerEnabled(s.timerEnabled); setTimerEndsAt(s.timerEndsAt);
    setTimerBaseAmt(String(s.timerBaseAmount)); setTimerBaseMins(String(s.timerBaseMinutes));
    setTimerFont(s.timerFont ?? 'IBM Plex Mono'); setTimerText(s.timerTextColor ?? '#38E1C6');
    setTimerExpired(s.timerExpiredColor ?? '#FF3B5C'); setTimerLayout(s.timerLayout ?? 'digital');
    setTimerAnim(s.timerAnimation ?? 'pulse');
    setAlertFont(s.alertFont ?? 'Oswald');
    setAlertTextColor(s.alertTextColor ?? '#FFFFFF');
    setAlertAccent(s.alertAccentColor ?? '#38E1C6');
    setAlertGifUrl(s.alertGifUrl ?? '');
    setAlertSoundUrl(s.alertSoundUrl ?? '');
    setAlertAnimation(s.alertAnimation ?? 'slide-up');
    setAlertDuration(String(s.alertDuration ?? 7000));
    setAlertTts(s.alertTtsEnabled ?? true);
    setAlertShowGif(s.alertShowGif ?? false);
  }

  const fetchData = useCallback(async (targetPage = 1) => {
    try {
      const [sR, dR, stR] = await Promise.all([
        api.get<Stats>('/api/admin/donations/stats'),
        api.get<PaginatedDonations>(`/api/admin/donations?page=${targetPage}&size=15`),
        api.get<Settings>('/api/admin/settings'),
      ]);
      setStats(sR.data); setDonations(dR.data.data);
      setTotalPages(dR.data.meta.totalPages); setPage(targetPage);
      sync(stR.data); setLoaded(true);
    } catch (err) { console.error('[dashboard]', err); }
    finally { setLoadingData(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
// eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(1); }, [fetchData]);

  async function handleReplay(id: string) {
    setReplayingId(id); setReplaySuccess(null);
    try { await api.post(`/api/admin/donations/${id}/replay`); setReplaySuccess(id); setTimeout(() => setReplaySuccess(null), 3000); }
    catch { alert('Replay failed.'); } finally { setReplayingId(null); }
  }

  async function handleManualTrigger(e: FormEvent) {
    e.preventDefault(); setTriggerResult(null); setTriggering(true);
    try {
      await api.post('/api/admin/donations/manual-trigger', { senderName: triggerName.trim(), message: triggerMessage.trim() || undefined, amount: Number(triggerAmount) });
      setTriggerResult('✅ Alert sent.'); setTriggerName(''); setTriggerMessage(''); setTriggerAmount(''); fetchData(page);
    } catch { setTriggerResult('❌ Trigger failed.'); } finally { setTriggering(false); }
  }

  async function patch(payload: Record<string, unknown>, setL: (v: boolean) => void, setR: (v: string) => void) {
    setL(true); setR('');
    try { await api.patch('/api/admin/settings', payload); setR('✅ Saved.'); fetchData(page); }
    catch { setR('❌ Failed.'); } finally { setL(false); }
  }

  const handleSaveSystem = (e: FormEvent) => { e.preventDefault(); patch({ slipOkMode, minTtsAmount: Number(minTtsAmount), profanityList: profanityInput }, setSavingSystem, setSystemResult); };
  const handleSaveGoal   = (e: FormEvent) => { e.preventDefault(); patch({ goalLabel, goalTargetAmount: Number(goalTarget), goalCurrentAmount: Number(goalCurrent), goalEndsAt: goalEndsAt ? new Date(goalEndsAt).toISOString() : null, goalBarColor, goalTextColor, goalFont, goalShowCountdown: goalShowCd, goalShowPercent: goalShowPct }, setSavingGoal, setGoalResult); };
  const handleSaveTop    = (e: FormEvent) => { e.preventDefault(); patch({ topDonatorsLimit: Number(topLimit), topFont, topTextColor, topAccentColor: topAccent, topBarColor, topLayout, topShowBar }, setSavingTop, setTopResult); };
  const handleSaveTimer  = (e: FormEvent) => { e.preventDefault(); patch({ timerEnabled, timerBaseAmount: Number(timerBaseAmt), timerBaseMinutes: Number(timerBaseMins), timerFont, timerTextColor: timerText, timerExpiredColor: timerExpired, timerLayout, timerAnimation: timerAnim }, setSavingTimer, setTimerResult); };
  const handleSaveAlert  = (e: FormEvent) => { e.preventDefault(); patch({ alertFont, alertTextColor, alertAccentColor: alertAccent, alertGifUrl, alertSoundUrl, alertAnimation, alertDuration: Number(alertDuration), alertTtsEnabled: alertTts, alertShowGif }, setSavingAlert, setAlertResult); };

  async function handleClearGoalDeadline() { await patch({ goalEndsAt: null }, setSavingGoal, setGoalResult); setGoalEndsAt(''); }
  async function handleResetTimer() {
    setSavingTimer(true); setTimerResult('');
    try { await api.patch('/api/admin/settings', { timerEndsAt: null }); setTimerEndsAt(null); setTimerResult('✅ Timer reset.'); }
    catch { setTimerResult('❌ Reset failed.'); } finally { setSavingTimer(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-void text-ink">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
          <span className="font-display text-xl uppercase tracking-wide">Donation Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-ink-muted">{username}</span>
          <button onClick={logout} className="flex items-center gap-1.5 font-mono text-xs text-ink-muted hover:text-live transition-colors uppercase tracking-wide">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={<TrendingUp className="w-5 h-5 text-signal" />} label="Today's total"
            value={stats ? `฿${stats.todayTotal.toLocaleString()}` : '—'}
            sub={stats ? `${stats.todayCount} donation${stats.todayCount !== 1 ? 's' : ''}` : ''} />
          <StatCard icon={<Users className="w-5 h-5 text-gold" />} label="Top donator"
            value={stats?.topDonators[0]?.senderName ?? '—'}
            sub={stats?.topDonators[0] ? `฿${stats.topDonators[0].total.toLocaleString()} total` : ''} />
          <div className="bg-panel border border-white/5 px-5 py-4" style={{ clipPath: PANEL_CLIP }}>
            <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-2">Top donators</p>
            {stats?.topDonators.length
              ? <ol className="space-y-1">{stats.topDonators.map((d, i) => (
                  <li key={d.senderName} className="flex justify-between font-body text-sm">
                    <span className="text-ink-muted">{i + 1}. {d.senderName}</span>
                    <span className="font-mono text-gold">฿{d.total.toLocaleString()}</span>
                  </li>))}</ol>
              : <p className="font-body text-xs text-ink-muted">No donations yet.</p>}
          </div>
        </section>

        {/* Manual trigger */}
        <section className="bg-panel border border-white/5 px-6 py-5" style={{ clipPath: PANEL_CLIP }}>
          <div className="flex items-center gap-2 mb-4"><Zap className="w-4 h-4 text-gold" /><h2 className="font-display text-lg uppercase tracking-wide">Manual alert trigger</h2></div>
          <form onSubmit={handleManualTrigger} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <TInput value={triggerName}    onChange={setTriggerName}    placeholder="Sender name"         className="w-full" />
            <TInput value={triggerMessage} onChange={setTriggerMessage} placeholder="Message (optional)"  className="w-full" />
            <TInput value={triggerAmount}  onChange={setTriggerAmount}  placeholder="Amount (THB)" type="number" className="w-full" />
            <button type="submit" disabled={triggering}
              className="bg-gold text-void font-display uppercase tracking-wide text-sm py-2 flex items-center justify-center gap-2 hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {triggering ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Zap className="w-4 h-4" /> Fire alert</>}
            </button>
          </form>
          {triggerResult && <p className="font-mono text-xs mt-3 text-ink-muted">{triggerResult}</p>}
        </section>

        {/* System settings */}
        <section className="bg-panel border border-white/5 px-6 py-5" style={{ clipPath: PANEL_CLIP }}>
          <div className="flex items-center gap-2 mb-4"><span className="text-signal text-sm">⚙</span><h2 className="font-display text-lg uppercase tracking-wide">System settings</h2></div>
          {!loaded ? <p className="font-mono text-xs text-ink-muted">Loading…</p> : (
            <form onSubmit={handleSaveSystem} className="space-y-4">
              <Field label="SlipOK mode">
                <div className="flex gap-3 mt-1">
                  {(['mock', 'live'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setSlipOkMode(m)}
                      className={`flex-1 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${slipOkMode === m ? (m === 'live' ? 'bg-live/10 border-live/40 text-live' : 'bg-signal/10 border-signal/40 text-signal') : 'border-white/10 text-ink-muted hover:border-white/20'}`}>
                      {m === 'live' ? '🔴 Live' : '🟢 Mock'}
                    </button>
                  ))}
                </div>
                {slipOkMode === 'live' && <p className="font-mono text-xs text-live mt-1">⚠ Charges SlipOK quota on every verification.</p>}
              </Field>
              <Field label="Min TTS amount (THB)" hint="0 = always read">
                <TInput value={minTtsAmount} onChange={setMinTtsAmount} type="number" min="0" className="w-40" />
              </Field>
              <Field label="Profanity filter" hint="comma-separated">
                <TInput value={profanityInput} onChange={setProfanityInput} placeholder="word1, word2" className="w-full" />
              </Field>
              <SaveBar loading={savingSystem} result={systemResult} />
            </form>
          )}
        </section>

        {/* ── Goal Widget Builder ─────────────────────────────────────────── */}
        <section className="bg-panel border border-white/5 overflow-hidden" style={{ clipPath: PANEL_CLIP }}>
          <SectionHeader emoji="🎯" title="Donation goal widget" />
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
            <div className="px-6 py-5">
              <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-3">Live preview</p>
              <PreviewFrame>
                <GoalPreview label={goalLabel} current={Number(goalCurrent)||0} target={Number(goalTarget)||0}
                  endsAt={goalEndsAt} barColor={goalBarColor} textColor={goalTextColor}
                  font={goalFont} showCd={goalShowCd} showPct={goalShowPct} />
              </PreviewFrame>
              <WidgetUrl path="/widget/goal" />
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-160">
              <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-4">Configuration</p>
              {!loaded ? <p className="font-mono text-xs text-ink-muted">Loading…</p> : (
                <form onSubmit={handleSaveGoal} className="space-y-5">
                  <Field label="Goal label"><TInput value={goalLabel} onChange={setGoalLabel} placeholder="e.g. New Mic" className="w-full" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Target (THB)"><TInput value={goalTarget}  onChange={setGoalTarget}  type="number" min="0" className="w-full" /></Field>
                    <Field label="Current (THB)"><TInput value={goalCurrent} onChange={setGoalCurrent} type="number" min="0" className="w-full" /></Field>
                  </div>
                  <Field label="End date" hint="optional">
                    <div className="flex items-center gap-2">
                      <input type="datetime-local" value={goalEndsAt} onChange={(e) => setGoalEndsAt(e.target.value)}
                        className="bg-panel-raised border border-white/10 px-3 py-2 text-ink font-body text-sm focus:outline-none focus:border-signal/60 transition-colors" />
                      {goalEndsAt && <button type="button" onClick={handleClearGoalDeadline} className="font-mono text-xs text-live hover:underline whitespace-nowrap">Clear</button>}
                    </div>
                  </Field>
                  <div className="border-t border-white/5 pt-4">
                    <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-3">Appearance</p>
                    <Field label="Colour preset">
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {GOAL_PRESETS.map((t) => (
                          <button key={t.name} type="button" onClick={() => { setGoalBarColor(t.bar); setGoalTextColor(t.text); }}
                            className={`flex flex-col items-center gap-1 px-3 py-2 border text-xs font-mono transition-colors ${goalBarColor === t.bar ? 'border-signal/60 bg-signal/10' : 'border-white/10 hover:border-white/20'}`}>
                            <span className="w-5 h-5 rounded-full border border-white/20" style={{ background: t.bar }} />{t.name}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <ColorPicker label="Bar colour"  value={goalBarColor}  onChange={setGoalBarColor} />
                      <ColorPicker label="Text colour" value={goalTextColor} onChange={setGoalTextColor} />
                    </div>
                    <Field label="Font family">
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {FONT_OPTIONS.map((f) => (
                          <button key={f.value} type="button" onClick={() => setGoalFont(f.value)}
                            className={`px-3 py-2 border text-left transition-colors ${goalFont === f.value ? 'border-signal/60 bg-signal/10' : 'border-white/10 hover:border-white/20'}`}>
                            <span className="block font-mono text-xs text-ink-muted">{f.label}</span>
                            <span className="block text-xl text-ink" style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.sample}</span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Display options">
                      <div className="flex gap-3 mt-1">
                        <ToggleBtn on={goalShowCd}  onClick={() => setGoalShowCd(p => !p)}  label="Countdown" />
                        <ToggleBtn on={goalShowPct} onClick={() => setGoalShowPct(p => !p)} label="Percentage" />
                      </div>
                    </Field>
                  </div>
                  <SaveBar loading={savingGoal} result={goalResult} />
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ── Top Donators Widget Builder ─────────────────────────────────── */}
        <section className="bg-panel border border-white/5 overflow-hidden" style={{ clipPath: PANEL_CLIP }}>
          <SectionHeader emoji="🏆" title="Top donators widget" />
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
            <div className="px-6 py-5">
              <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-3">Live preview</p>
              <PreviewFrame>
                <TopDonatorsPreview font={topFont} textColor={topTextColor} accentColor={topAccent}
                  barColor={topBarColor} layout={topLayout} showBar={topShowBar} limit={Number(topLimit)} />
              </PreviewFrame>
              <WidgetUrl path="/widget/top-donators" />
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-160">
              <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-4">Configuration</p>
              {!loaded ? <p className="font-mono text-xs text-ink-muted">Loading…</p> : (
                <form onSubmit={handleSaveTop} className="space-y-5">
                  <Field label="Number of donators to show">
                    <div className="flex gap-3 mt-1">
                      {[5, 10].map((n) => (
                        <button key={n} type="button" onClick={() => setTopLimit(String(n))}
                          className={`px-6 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${topLimit === String(n) ? 'bg-signal/10 border-signal/40 text-signal' : 'border-white/10 text-ink-muted hover:border-white/20'}`}>
                          Top {n}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Layout style">
                    <div className="flex gap-3 mt-1">
                      {[{ v: 'list', l: '≡ List' }, { v: 'podium', l: '🥇 Podium' }].map(({ v, l }) => (
                        <button key={v} type="button" onClick={() => setTopLayout(v)}
                          className={`flex-1 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${topLayout === v ? 'bg-signal/10 border-signal/40 text-signal' : 'border-white/10 text-ink-muted hover:border-white/20'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="border-t border-white/5 pt-4">
                    <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-3">Appearance</p>
                    <Field label="Colour preset">
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {TOP_PRESETS.map((t) => (
                          <button key={t.name} type="button" onClick={() => { setTopAccent(t.accent); setTopBarColor(t.bar); setTopTextColor(t.text); }}
                            className={`flex flex-col items-center gap-1 px-3 py-2 border text-xs font-mono transition-colors ${topAccent === t.accent ? 'border-signal/60 bg-signal/10' : 'border-white/10 hover:border-white/20'}`}>
                            <span className="w-5 h-5 rounded-full border border-white/20" style={{ background: t.accent }} />{t.name}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <ColorPicker label="Accent / #1 colour" value={topAccent}    onChange={setTopAccent} />
                      <ColorPicker label="Bar colour"         value={topBarColor}  onChange={setTopBarColor} />
                      <ColorPicker label="Text colour"        value={topTextColor} onChange={setTopTextColor} />
                    </div>
                    <Field label="Font family">
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {FONT_OPTIONS.map((f) => (
                          <button key={f.value} type="button" onClick={() => setTopFont(f.value)}
                            className={`px-3 py-2 border text-left transition-colors ${topFont === f.value ? 'border-signal/60 bg-signal/10' : 'border-white/10 hover:border-white/20'}`}>
                            <span className="block font-mono text-xs text-ink-muted">{f.label}</span>
                            <span className="block text-xl text-ink" style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.sample}</span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Display options">
                      <div className="flex gap-3 mt-1">
                        <ToggleBtn on={topShowBar} onClick={() => setTopShowBar(p => !p)} label="Relative bar" />
                      </div>
                    </Field>
                  </div>
                  <SaveBar loading={savingTop} result={topResult} />
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ── Timer Widget Builder ────────────────────────────────────────── */}
        <section className="bg-panel border border-white/5 overflow-hidden" style={{ clipPath: PANEL_CLIP }}>
          <SectionHeader emoji="⏱" title="Subathon timer widget" />
          {timerEndsAt && (
            <div className="mx-6 mt-4 flex items-center gap-3 border border-signal/20 bg-signal/5 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-signal animate-pulse shrink-0" />
              <span className="font-mono text-xs text-signal">Ends: {new Date(timerEndsAt).toLocaleString()}</span>
              <button type="button" onClick={handleResetTimer} disabled={savingTimer} className="ml-auto font-mono text-xs text-live hover:underline disabled:opacity-40">Reset timer</button>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
            <div className="px-6 py-5">
              <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-3">Live preview</p>
              <PreviewFrame>
                <TimerPreview font={timerFont} textColor={timerText} expiredColor={timerExpired} layout={timerLayout} animation={timerAnim} />
              </PreviewFrame>
              <WidgetUrl path="/widget/timer" />
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-160">
              <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-4">Configuration</p>
              {!loaded ? <p className="font-mono text-xs text-ink-muted">Loading…</p> : (
                <form onSubmit={handleSaveTimer} className="space-y-5">
                  <Field label="Enable subathon timer">
                    <button type="button" onClick={() => setTimerEnabled(p => !p)}
                      className={`mt-1 px-6 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${timerEnabled ? 'bg-signal/10 border-signal/40 text-signal' : 'border-white/10 text-ink-muted hover:border-white/20'}`}>
                      {timerEnabled ? '✅ Enabled' : '⬜ Disabled'}
                    </button>
                  </Field>
                  <Field label="Time added per donation" hint="e.g. 30 mins per 100 THB">
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-ink-muted">THB</span>
                        <TInput value={timerBaseAmt}  onChange={setTimerBaseAmt}  type="number" min="1" step="1"    className="w-28" />
                      </div>
                      <span className="font-mono text-sm text-ink-muted mt-4">→</span>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-ink-muted">Minutes</span>
                        <TInput value={timerBaseMins} onChange={setTimerBaseMins} type="number" min="0.01" step="0.01" className="w-28" />
                      </div>
                    </div>
                    <p className="font-mono text-xs text-ink-muted mt-1">
                      ฿{timerBaseAmt} → {Number(timerBaseMins) >= 1 ? `${timerBaseMins} min` : `${Math.round(Number(timerBaseMins)*60)} sec`}
                    </p>
                  </Field>
                  <div className="border-t border-white/5 pt-4">
                    <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-3">Appearance</p>
                    <Field label="Colour preset">
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {TIMER_PRESETS.map((t) => (
                          <button key={t.name} type="button" onClick={() => { setTimerText(t.text); setTimerExpired(t.expired); }}
                            className={`flex flex-col items-center gap-1 px-3 py-2 border text-xs font-mono transition-colors ${timerText === t.text ? 'border-signal/60 bg-signal/10' : 'border-white/10 hover:border-white/20'}`}>
                            <span className="w-5 h-5 rounded-full border border-white/20" style={{ background: t.text }} />{t.name}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <ColorPicker label="Timer colour"   value={timerText}    onChange={setTimerText} />
                      <ColorPicker label="Expired colour" value={timerExpired} onChange={setTimerExpired} />
                    </div>
                    <Field label="Font family">
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {FONT_OPTIONS.map((f) => (
                          <button key={f.value} type="button" onClick={() => setTimerFont(f.value)}
                            className={`px-3 py-2 border text-left transition-colors ${timerFont === f.value ? 'border-signal/60 bg-signal/10' : 'border-white/10 hover:border-white/20'}`}>
                            <span className="block font-mono text-xs text-ink-muted">{f.label}</span>
                            <span className="block text-xl text-ink" style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.sample}</span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Layout style">
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {[{ v: 'digital', l: '⌨ Digital' }, { v: 'minimal', l: '— Minimal' }, { v: 'circle', l: '○ Circle' }].map(({ v, l }) => (
                          <button key={v} type="button" onClick={() => setTimerLayout(v)}
                            className={`flex-1 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${timerLayout === v ? 'bg-signal/10 border-signal/40 text-signal' : 'border-white/10 text-ink-muted hover:border-white/20'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Animation">
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {[{ v: 'pulse', l: '💓 Pulse' }, { v: 'glow', l: '✨ Glow' }, { v: 'none', l: '— None' }].map(({ v, l }) => (
                          <button key={v} type="button" onClick={() => setTimerAnim(v)}
                            className={`flex-1 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${timerAnim === v ? 'bg-signal/10 border-signal/40 text-signal' : 'border-white/10 text-ink-muted hover:border-white/20'}`}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                  <SaveBar loading={savingTimer} result={timerResult} />
                </form>
              )}
            </div>
          </div>
        </section>


        {/* ── Alert Overlay Widget Builder ──────────────────────────────── */}
        <section className="bg-panel border border-white/5 overflow-hidden" style={{ clipPath: PANEL_CLIP }}>
          <SectionHeader emoji="🔔" title="Donation alert overlay" />
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/5">
            <div className="px-6 py-5">
              <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-3">Live preview</p>
              <PreviewFrame>
                <AlertPreview font={alertFont} textColor={alertTextColor} accentColor={alertAccent}
                  gifUrl={alertGifUrl} showGif={alertShowGif} animation={alertAnimation} />
              </PreviewFrame>
              <WidgetUrl path="/widget/alert" />
              <p className="font-mono text-xs text-ink-muted mt-1">
                Also works at <code className="text-signal">/overlay</code> — both listen on the same socket event.
              </p>
            </div>
            <div className="px-6 py-5 overflow-y-auto max-h-160">
              <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-4">Configuration</p>
              {!loaded ? <p className="font-mono text-xs text-ink-muted">Loading…</p> : (
                <form onSubmit={handleSaveAlert} className="space-y-5">
                  <Field label="Colour preset">
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {ALERT_PRESETS.map((t) => (
                        <button key={t.name} type="button"
                          onClick={() => { setAlertAccent(t.accent); setAlertTextColor(t.text); }}
                          className={`flex flex-col items-center gap-1 px-3 py-2 border text-xs font-mono transition-colors ${alertAccent === t.accent ? 'border-signal/60 bg-signal/10' : 'border-white/10 hover:border-white/20'}`}>
                          <span className="w-5 h-5 rounded-full border border-white/20" style={{ background: t.accent }} />{t.name}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <ColorPicker label="Accent colour" value={alertAccent}    onChange={setAlertAccent} />
                    <ColorPicker label="Text colour"   value={alertTextColor} onChange={setAlertTextColor} />
                  </div>
                  <Field label="Font family">
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {FONT_OPTIONS.map((f) => (
                        <button key={f.value} type="button" onClick={() => setAlertFont(f.value)}
                          className={`px-3 py-2 border text-left transition-colors ${alertFont === f.value ? 'border-signal/60 bg-signal/10' : 'border-white/10 hover:border-white/20'}`}>
                          <span className="block font-mono text-xs text-ink-muted">{f.label}</span>
                          <span className="block text-xl text-ink" style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.sample}</span>
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Entrance animation">
                    <div className="flex gap-2 mt-1">
                      {[{ v: 'slide-up', l: '↑ Slide up' }, { v: 'fade', l: '◎ Fade' }, { v: 'bounce', l: '⟳ Bounce' }].map(({ v, l }) => (
                        <button key={v} type="button" onClick={() => setAlertAnimation(v)}
                          className={`flex-1 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${alertAnimation === v ? 'bg-signal/10 border-signal/40 text-signal' : 'border-white/10 text-ink-muted hover:border-white/20'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Display duration (ms)" hint="7000 = 7 seconds">
                    <TInput value={alertDuration} onChange={setAlertDuration} type="number" min="2000" step="500" className="w-40" />
                  </Field>
                  <Field label="Custom GIF / image URL" hint="optional">
                    <TInput value={alertGifUrl} onChange={setAlertGifUrl} placeholder="https://example.com/alert.gif" className="w-full" />
                  </Field>
                  <Field label="Custom sound URL" hint="leave blank to use default">
                    <TInput value={alertSoundUrl} onChange={setAlertSoundUrl} placeholder="https://example.com/sound.mp3" className="w-full" />
                  </Field>
                  <Field label="Options">
                    <div className="flex gap-3 mt-1 flex-wrap">
                      <ToggleBtn on={alertTts}     onClick={() => setAlertTts(p => !p)}     label="TTS" />
                      <ToggleBtn on={alertShowGif} onClick={() => setAlertShowGif(p => !p)} label="Show GIF" />
                    </div>
                  </Field>
                  <SaveBar loading={savingAlert} result={alertResult} />
                </form>
              )}
            </div>
          </div>
        </section>

        {/* Donation history */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg uppercase tracking-wide">Donation history</h2>
            <button onClick={() => { setLoadingData(true); fetchData(page); }}
              className="flex items-center gap-1.5 font-mono text-xs text-ink-muted hover:text-signal transition-colors uppercase tracking-wide">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
          {loadingData ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-signal animate-spin" /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Name','Message','Amount','Status','Source','Date','Actions'].map((h) => (
                        <th key={h} className="text-left font-mono text-xs text-ink-muted uppercase tracking-wide px-3 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {donations.map((d) => (
                      <tr key={d.id} className="border-b border-white/5 hover:bg-panel-raised transition-colors">
                        <td className="px-3 py-3 font-body text-ink">{d.senderName}</td>
                        <td className="px-3 py-3 font-body text-ink-muted max-w-50 truncate">
                          {d.message ?? <span className="text-white/20 italic">—</span>}
                        </td>
                        <td className="px-3 py-3 font-mono text-gold">฿{d.amount.toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <span className={`font-mono text-xs border px-2 py-0.5 ${STATUS_STYLES[d.verificationStatus] ?? ''}`}>{d.verificationStatus}</span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-ink-muted">{d.source}</td>
                        <td className="px-3 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => handleReplay(d.id)} disabled={replayingId === d.id}
                              className="flex items-center gap-1 font-mono text-xs text-ink-muted hover:text-signal disabled:opacity-40 transition-colors uppercase tracking-wide">
                              {replayingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat2 className="w-3.5 h-3.5" />}
                              {replaySuccess === d.id ? 'Sent!' : 'Replay'}
                            </button>
                            {d.slipImageUrl && (
                              <a href={`${import.meta.env.VITE_API_BASE_URL}${d.slipImageUrl}`} target="_blank" rel="noopener noreferrer"
                                className="font-mono text-xs text-ink-muted hover:text-gold transition-colors uppercase tracking-wide">
                                Slip ↗
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6">
                  <button onClick={() => { setLoadingData(true); fetchData(page - 1); }} disabled={page <= 1}
                    className="font-mono text-xs text-ink-muted hover:text-signal disabled:opacity-30 transition-colors uppercase tracking-wide">← Prev</button>
                  <span className="font-mono text-xs text-ink-muted">{page} / {totalPages}</span>
                  <button onClick={() => { setLoadingData(true); fetchData(page + 1); }} disabled={page >= totalPages}
                    className="font-mono text-xs text-ink-muted hover:text-signal disabled:opacity-30 transition-colors uppercase tracking-wide">Next →</button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
