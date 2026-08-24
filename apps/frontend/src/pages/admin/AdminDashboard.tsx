import { useState, useEffect, useCallback } from 'react';
import type { FormEvent } from 'react';
import {
  LogOut, RefreshCw, Loader2, TrendingUp, Users,
  Repeat2, Zap, Settings, Target, Trophy, Timer, Bell,
  ChevronDown, ChevronUp, ExternalLink,
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
  data: Donation[]; meta: { total: number; page: number; totalPages: number };
}
interface AppSettings {
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

// ── Design tokens ──────────────────────────────────────────────────────────
const FRONTEND_BASE = (import.meta.env.VITE_API_BASE_URL as string)?.replace(':4000', ':5173') ?? 'http://localhost:5173';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  VERIFIED: { label: 'Verified',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  FAILED:   { label: 'Failed',    className: 'bg-red-50    text-red-600    border-red-200'     },
  PENDING:  { label: 'Pending',   className: 'bg-amber-50  text-amber-700  border-amber-200'   },
  MANUAL:   { label: 'Manual',    className: 'bg-[#F3F1ED]  text-[#6B726A]   border-[#E5E3DD]'    },
};

const FONT_OPTIONS = [
  { value: 'Oswald',        label: 'Oswald',        sample: 'Aa' },
  { value: 'Inter',         label: 'Inter',          sample: 'Aa' },
  { value: 'IBM Plex Mono', label: 'IBM Plex Mono',  sample: 'Aa' },
  { value: 'Impact',        label: 'Impact',         sample: 'Aa' },
];

const GOAL_PRESETS   = [{ name: 'Teal', bar: '#38E1C6', text: '#FFF' }, { name: 'Blue', bar: '#3b82f6', text: '#FFF' }, { name: 'Gold', bar: '#FFB627', text: '#FFF' }, { name: 'Pink', bar: '#FF3B5C', text: '#FFF' }];
const TOP_PRESETS    = [{ name: 'Teal', accent: '#FFB627', bar: '#38E1C6', text: '#FFF' }, { name: 'Blue', accent: '#60a5fa', bar: '#3b82f6', text: '#FFF' }, { name: 'Gold', accent: '#FFB627', bar: '#FFB627', text: '#FFF' }];
const TIMER_PRESETS  = [{ name: 'Teal', text: '#38E1C6', expired: '#FF3B5C' }, { name: 'Blue', text: '#60a5fa', expired: '#FF3B5C' }, { name: 'White', text: '#FFFFFF', expired: '#FF3B5C' }];
const ALERT_PRESETS  = [{ name: 'Teal', accent: '#38E1C6', text: '#FFF' }, { name: 'Blue', accent: '#60a5fa', text: '#FFF' }, { name: 'Gold', accent: '#FFB627', text: '#FFF' }, { name: 'Pink', accent: '#FF3B5C', text: '#FFF' }];

// ── Reusable atoms ─────────────────────────────────────────────────────────
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-[#E5E3DD] shadow-sm ${className}`}>{children}</div>;
}

function CardSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="p-6 space-y-4">
      {title && <h3 className="text-sm font-semibold text-[#1A1C1A]">{title}</h3>}
      {children}
    </div>
  );
}

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-xs font-medium text-[#6B726A] mb-1.5">
      {children}{hint && <span className="ml-1.5 font-normal text-zinc-400">{hint}</span>}
    </label>
  );
}

function Input({ value, onChange, placeholder, type = 'text', min, step, className = '' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; min?: string; step?: string; className?: string;
}) {
  return (
    <input type={type} value={value} placeholder={placeholder} min={min} step={step}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-xl border border-[#E5E3DD] bg-[#F3F1ED] px-3.5 py-2.5 text-sm text-[#1A1C1A] placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/15 focus:border-[#4B5E53] transition-all ${className}`} />
  );
}

function PrimaryBtn({ children, disabled, className = '' }: { children: React.ReactNode; disabled?: boolean; className?: string }) {
  return (
    <button type="submit" disabled={disabled}
      className={`inline-flex items-center gap-2 bg-[#4B5E53] hover:bg-[#3A4B42] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}>
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick, className = '' }: { children: React.ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-sm text-[#6B726A] hover:text-[#4B5E53] transition-colors ${className}`}>
      {children}
    </button>
  );
}

function SegmentedControl({ options, value, onChange }: {
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex bg-[#F3F1ED] rounded-xl p-1 gap-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${value === o.value ? 'bg-white text-[#1A1C1A] shadow-sm' : 'text-[#6B726A] hover:text-[#1A1C1A]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${on ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-zinc-200 text-zinc-500 hover:border-blue-200 hover:text-blue-500'}`}>
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${on ? 'border-blue-500 bg-[#4B5E53]' : 'border-zinc-300'}`}>
        {on && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  );
}

function ColorSwatch({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-9 h-9 rounded-lg cursor-pointer border border-[#E5E3DD] bg-white p-0.5" />
      <div>
        <p className="text-xs font-medium text-[#6B726A]">{label}</p>
        <p className="text-xs text-zinc-400 font-mono">{value}</p>
      </div>
    </div>
  );
}

function SaveRow({ loading, result }: { loading: boolean; result: string | null }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <PrimaryBtn disabled={loading}>
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save changes'}
      </PrimaryBtn>
      {result && <span className="text-sm text-[#6B726A]">{result}</span>}
    </div>
  );
}

function WidgetLink({ path, label }: { path: string; label: string }) {
  return (
    <a href={`${FRONTEND_BASE}${path}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-[#4B5E53] hover:text-blue-700 font-mono transition-colors">
      {label} <ExternalLink className="w-3 h-3" />
    </a>
  );
}

// Each widget section is collapsible to keep the page scannable
function CollapsibleSection({ icon, title, badge, children }: {
  icon: React.ReactNode; title: string; badge?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button type="button" onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-[#F9F8F6] transition-colors rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#F3F1ED] rounded-xl flex items-center justify-center text-[#6B726A]">{icon}</div>
          <div>
            <p className="text-sm font-semibold text-[#1A1C1A]">{title}</p>
            {badge && <p className="text-xs text-zinc-400 mt-0.5">{badge}</p>}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>
      {open && <div className="border-t border-zinc-100">{children}</div>}
    </Card>
  );
}

// OBS preview frame
function PreviewFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', minHeight: '150px' }}>
      <span className="absolute top-2 right-2 text-xs text-white/25 font-mono uppercase tracking-wider">OBS Preview</span>
      <div className="flex items-center justify-center min-h-37.5">{children}</div>
    </div>
  );
}

// ── Inline widget previews (compact) ───────────────────────────────────────
function formatCountdown(endsAt: string): string {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return d > 0 ? `${d}d ${h}h ${m}m left` : h > 0 ? `${h}h ${m}m left` : `${m}m ${s}s left`;
}

function GoalPreview({ label, current, target, barColor, textColor, font,
                       showPct, showCd, endsAt }: {
  label: string; current: number; target: number;
  barColor: string; textColor: string; font: string;
  showPct: boolean; showCd: boolean; endsAt: string;
}) {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const ff  = { fontFamily: `'${font}', sans-serif` };
  const ts  = '0 0 4px rgba(0,0,0,0.9),1px 1px 0 #000,-1px -1px 0 #000';
  return (
    <div className="p-4 w-full">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <div className="text-xl font-bold uppercase truncate" style={{ ...ff, color: textColor, textShadow: ts }}>
          {label || 'Goal'}
        </div>
        {showCd && endsAt && (
          <div className="text-xs font-mono shrink-0" style={{ color: barColor, textShadow: ts }}>
            ⏰ {formatCountdown(endsAt)}
          </div>
        )}
      </div>
      <div className="relative h-4 rounded-full overflow-hidden mb-1" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
        {showPct && (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="flex justify-between text-sm" style={ff}>
        <span style={{ color: barColor, textShadow: ts }}>฿{current.toLocaleString()}</span>
        <span style={{ color: textColor, opacity: 0.6, textShadow: ts }}>/ ฿{target.toLocaleString()}</span>
      </div>
    </div>
  );
}

function TimerPreview({ textColor, font, layout }: { textColor: string; font: string; layout: string }) {
  const ff  = { fontFamily: `'${font}', monospace` };
  const ts  = '0 0 4px rgba(0,0,0,0.8),1px 1px 0 #000';
  const sample = '00:47:23';
  if (layout === 'circle') return (
    <div className="p-4 flex flex-col items-center gap-1">
      <div className="w-24 h-24 rounded-full border-2 flex items-center justify-center" style={{ borderColor: textColor }}>
        <span className="text-lg font-bold" style={{ ...ff, color: textColor, textShadow: ts }}>{sample}</span>
      </div>
    </div>
  );
  return (
    <div className="p-4 text-center">
      <div className="text-xs mb-1" style={{ ...ff, color: textColor, opacity: 0.4, letterSpacing: '3px', textTransform: 'uppercase' }}>Time remaining</div>
      <span className="text-3xl font-bold tracking-wider" style={{ ...ff, color: textColor, textShadow: ts }}>{sample}</span>
    </div>
  );
}

function TopPreview({ textColor, accentColor, barColor, font, layout, showBar, limit }: {
  textColor: string; accentColor: string; barColor: string;
  font: string; layout: string; showBar: boolean; limit: number;
}) {
  const ALL_SAMPLE = [
    { name: 'Nattapong', total: 3200 }, { name: 'Somchai',  total: 2100 },
    { name: 'Wanida',    total: 1500 }, { name: 'Krit',     total: 900  },
    { name: 'Ploy',      total: 650  }, { name: 'Tawan',    total: 500  },
    { name: 'Pim',       total: 350  }, { name: 'Nont',     total: 200  },
    { name: 'Fah',       total: 150  }, { name: 'Golf',     total: 100  },
  ];
  const sample   = ALL_SAMPLE.slice(0, Math.max(1, Math.min(limit, 10)));
  const maxTotal = sample[0]?.total ?? 1;
  const ff  = { fontFamily: `'${font}', sans-serif` };
  const ts  = '0 0 4px rgba(0,0,0,0.9),1px 1px 0 #000';

  if (layout === 'podium' && sample.length >= 3) {
    const podiumOrder = [
      { d: sample[1], rank: 2, height: '52px', color: textColor    },
      { d: sample[0], rank: 1, height: '72px', color: accentColor  },
      { d: sample[2], rank: 3, height: '40px', color: textColor    },
    ];
    return (
      <div className="p-3 w-full">
        <div className="flex items-end justify-center gap-2 mb-2">
          {podiumOrder.map(({ d, rank, height, color }) => (
            <div key={d.name} className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold" style={{ ...ff, color, textShadow: ts, maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.name}
              </span>
              <div style={{ width: '52px', height, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: rank === 1 ? 1 : 0.7 }}>
                <span style={{ fontFamily: ff.fontFamily, fontSize: '16px', fontWeight: 900, color: '#000', opacity: 0.5 }}>{rank}</span>
              </div>
            </div>
          ))}
        </div>
        {sample.slice(3).map((d, i) => (
          <div key={d.name} className="flex justify-between text-xs py-0.5" style={{ ...ff, color: textColor, textShadow: ts }}>
            <span>#{i + 4} {d.name}</span>
            <span style={{ color: barColor }}>฿{d.total.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-3 w-full space-y-1.5">
      {sample.map((d, i) => (
        <div key={d.name}>
          <div className="flex justify-between text-xs" style={ff}>
            <span style={{ color: i === 0 ? accentColor : textColor, textShadow: ts }}>
              #{i + 1} {d.name}
            </span>
            <span style={{ color: i === 0 ? accentColor : barColor, textShadow: ts }}>
              ฿{d.total.toLocaleString()}
            </span>
          </div>
          {showBar && (
            <div className="h-1 rounded-full mt-0.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full" style={{ width: `${(d.total / maxTotal) * 100}%`, background: i === 0 ? accentColor : barColor, opacity: i === 0 ? 1 : 0.5 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AlertPreview({ font, textColor, accentColor }: { font: string; textColor: string; accentColor: string }) {
  const ff = { fontFamily: `'${font}', sans-serif` };
  const ts = '0 0 4px rgba(0,0,0,0.9),1px 1px 0 #000';
  return (
    <div className="w-full px-4 py-2">
      <div style={{ borderLeft: `3px solid ${accentColor}`, background: '#131820', padding: '12px 16px' }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: accentColor }}>Signal detected</span>
        </div>
        <div className="text-lg font-bold uppercase" style={{ ...ff, color: textColor, textShadow: ts }}>Nattapong</div>
        <div className="text-base font-mono" style={{ color: accentColor, textShadow: ts }}>฿500</div>
        <div className="text-xs mt-1" style={{ ...ff, color: textColor, opacity: 0.6 }}>ขอบคุณครับ 🎉</div>
      </div>
    </div>
  );
}

// ── Main dashboard ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { username, logout } = useAuth();

  const [stats,        setStats]        = useState<Stats | null>(null);
  const [donations,    setDonations]    = useState<Donation[]>([]);
  const [page,         setPage]         = useState(1);
  const [totalPages,   setTotalPages]   = useState(1);
  const [loadingData,  setLoadingData]  = useState(true);
  const [replayingId,  setReplayingId]  = useState<string | null>(null);
  const [replayOk,     setReplayOk]     = useState<string | null>(null);

  const [triggerName,    setTriggerName]    = useState('');
  const [triggerMessage, setTriggerMessage] = useState('');
  const [triggerAmount,  setTriggerAmount]  = useState('');
  const [triggering,     setTriggering]     = useState(false);
  const [triggerResult,  setTriggerResult]  = useState<string | null>(null);

  const [loaded,    setLoaded]    = useState(false);
  const [slipOkMode,     setSlipOkMode]     = useState('mock');
  const [minTtsAmount,   setMinTtsAmount]   = useState('0');
  const [profanityInput, setProfanityInput] = useState('');
  const [savingSystem,   setSavingSystem]   = useState(false);
  const [systemResult,   setSystemResult]   = useState<string | null>(null);

  const [goalLabel,    setGoalLabel]    = useState('');
  const [goalTarget,   setGoalTarget]   = useState('');
  const [goalCurrent,  setGoalCurrent]  = useState('');
  const [goalEndsAt,   setGoalEndsAt]   = useState('');
  const [goalBarColor, setGoalBarColor] = useState('#38E1C6');
  const [goalTextColor,setGoalTextColor]= useState('#FFFFFF');
  const [goalFont,     setGoalFont]     = useState('Oswald');
  const [goalShowCd,   setGoalShowCd]   = useState(true);
  const [goalShowPct,  setGoalShowPct]  = useState(true);
  const [savingGoal,   setSavingGoal]   = useState(false);
  const [goalResult,   setGoalResult]   = useState<string | null>(null);

  const [topLimit,     setTopLimit]     = useState('5');
  const [topFont,      setTopFont]      = useState('Oswald');
  const [topTextColor, setTopTextColor] = useState('#FFFFFF');
  const [topAccent,    setTopAccent]    = useState('#FFB627');
  const [topBarColor,  setTopBarColor]  = useState('#38E1C6');
  const [topLayout,    setTopLayout]    = useState('list');
  const [topShowBar,   setTopShowBar]   = useState(true);
  const [savingTop,    setSavingTop]    = useState(false);
  const [topResult,    setTopResult]    = useState<string | null>(null);

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
    const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function sync(s: AppSettings) {
    setSlipOkMode(s.slipOkMode); setMinTtsAmount(String(s.minTtsAmount));
    setProfanityInput(Array.isArray(s.profanityList) ? s.profanityList.join(', ') : String(s.profanityList ?? ''));
    setGoalLabel(s.goalLabel); setGoalTarget(String(s.goalTargetAmount)); setGoalCurrent(String(s.goalCurrentAmount));
    setGoalEndsAt(toLocal(s.goalEndsAt)); setGoalBarColor(s.goalBarColor ?? '#38E1C6');
    setGoalTextColor(s.goalTextColor ?? '#FFFFFF'); setGoalFont(s.goalFont ?? 'Oswald');
    setGoalShowCd(s.goalShowCountdown ?? true); setGoalShowPct(s.goalShowPercent ?? true);
    setTopLimit(String(s.topDonatorsLimit)); setTopFont(s.topFont ?? 'Oswald');
    setTopTextColor(s.topTextColor ?? '#FFFFFF'); setTopAccent(s.topAccentColor ?? '#FFB627');
    setTopBarColor(s.topBarColor ?? '#38E1C6'); setTopLayout(s.topLayout ?? 'list'); setTopShowBar(s.topShowBar ?? true);
    setTimerEnabled(s.timerEnabled); setTimerEndsAt(s.timerEndsAt);
    setTimerBaseAmt(String(s.timerBaseAmount)); setTimerBaseMins(String(s.timerBaseMinutes));
    setTimerFont(s.timerFont ?? 'IBM Plex Mono'); setTimerText(s.timerTextColor ?? '#38E1C6');
    setTimerExpired(s.timerExpiredColor ?? '#FF3B5C'); setTimerLayout(s.timerLayout ?? 'digital'); setTimerAnim(s.timerAnimation ?? 'pulse');
    setAlertFont(s.alertFont ?? 'Oswald'); setAlertTextColor(s.alertTextColor ?? '#FFFFFF');
    setAlertAccent(s.alertAccentColor ?? '#38E1C6'); setAlertGifUrl(s.alertGifUrl ?? '');
    setAlertSoundUrl(s.alertSoundUrl ?? ''); setAlertAnimation(s.alertAnimation ?? 'slide-up');
    setAlertDuration(String(s.alertDuration ?? 7000)); setAlertTts(s.alertTtsEnabled ?? true); setAlertShowGif(s.alertShowGif ?? false);
  }

  const fetchData = useCallback(async (targetPage = 1) => {
    try {
      const [sR, dR, stR] = await Promise.all([
        api.get<Stats>('/api/admin/donations/stats'),
        api.get<PaginatedDonations>(`/api/admin/donations?page=${targetPage}&size=20`),
        api.get<AppSettings>('/api/admin/settings'),
      ]);
      setStats(sR.data); setDonations(dR.data.data);
      setTotalPages(dR.data.meta.totalPages); setPage(targetPage);
      sync(stR.data); setLoaded(true);
    } catch (err) { console.error(err); } finally { setLoadingData(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
// eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(1); }, [fetchData]);

  async function handleReplay(id: string) {
    setReplayingId(id); setReplayOk(null);
    try { await api.post(`/api/admin/donations/${id}/replay`); setReplayOk(id); setTimeout(() => setReplayOk(null), 3000); }
    catch { alert('Replay failed.'); } finally { setReplayingId(null); }
  }

  async function handleManualTrigger(e: FormEvent) {
    e.preventDefault(); setTriggerResult(null); setTriggering(true);
    try {
      await api.post('/api/admin/donations/manual-trigger', { senderName: triggerName.trim(), message: triggerMessage.trim() || undefined, amount: Number(triggerAmount) });
      setTriggerResult('✓ Alert fired'); setTriggerName(''); setTriggerMessage(''); setTriggerAmount(''); fetchData(page);
    } catch { setTriggerResult('✗ Failed'); } finally { setTriggering(false); }
  }

  async function patch(payload: Record<string, unknown>, setL: (v: boolean) => void, setR: (v: string) => void) {
    setL(true); setR('');
    try { await api.patch('/api/admin/settings', payload); setR('Saved ✓'); fetchData(page); }
    catch { setR('Save failed'); } finally { setL(false); }
  }

  const saveSystem = (e: FormEvent) => { e.preventDefault(); patch({ slipOkMode, minTtsAmount: Number(minTtsAmount), profanityList: profanityInput }, setSavingSystem, setSystemResult); };
  const saveGoal   = (e: FormEvent) => { e.preventDefault(); patch({ goalLabel, goalTargetAmount: Number(goalTarget), goalCurrentAmount: Number(goalCurrent), goalEndsAt: goalEndsAt ? new Date(goalEndsAt).toISOString() : null, goalBarColor, goalTextColor, goalFont, goalShowCountdown: goalShowCd, goalShowPercent: goalShowPct }, setSavingGoal, setGoalResult); };
  const saveTop    = (e: FormEvent) => { e.preventDefault(); patch({ topDonatorsLimit: Number(topLimit), topFont, topTextColor, topAccentColor: topAccent, topBarColor, topLayout, topShowBar }, setSavingTop, setTopResult); };
  const saveTimer  = (e: FormEvent) => { e.preventDefault(); patch({ timerEnabled, timerBaseAmount: Number(timerBaseAmt), timerBaseMinutes: Number(timerBaseMins), timerFont, timerTextColor: timerText, timerExpiredColor: timerExpired, timerLayout, timerAnimation: timerAnim }, setSavingTimer, setTimerResult); };
  const saveAlert  = (e: FormEvent) => { e.preventDefault(); patch({ alertFont, alertTextColor, alertAccentColor: alertAccent, alertGifUrl, alertSoundUrl, alertAnimation, alertDuration: Number(alertDuration), alertTtsEnabled: alertTts, alertShowGif }, setSavingAlert, setAlertResult); };

  async function clearGoalDeadline() { await patch({ goalEndsAt: null }, setSavingGoal, setGoalResult); setGoalEndsAt(''); }
  async function resetTimer() {
    setSavingTimer(true); setTimerResult('');
    try { await api.patch('/api/admin/settings', { timerEndsAt: null }); setTimerEndsAt(null); setTimerResult('Timer reset ✓'); }
    catch { setTimerResult('Reset failed'); } finally { setSavingTimer(false); }
  }

  return (
    <div className="min-h-screen bg-[#F3F1ED]">
      {/* Nav */}
      <header className="bg-white border-b border-[#E5E3DD] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#4B5E53] flex items-center justify-center">
              <span className="text-white text-xs font-bold">D</span>
            </div>
            <span className="text-sm font-semibold text-[#1A1C1A]">Donation Admin</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#6B726A]">{username}</span>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-[#6B726A] hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#6B726A] uppercase tracking-wide">Today's total</span>
              <TrendingUp className="w-4 h-4 text-[#4B5E53]/70" />
            </div>
            <p className="text-2xl font-bold text-[#1A1C1A]">{stats ? `฿${stats.todayTotal.toLocaleString()}` : '—'}</p>
            <p className="text-xs text-zinc-400 mt-1">{stats ? `${stats.todayCount} donation${stats.todayCount !== 1 ? 's' : ''}` : ''}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#6B726A] uppercase tracking-wide">Top donator</span>
              <Users className="w-4 h-4 text-[#4B5E53]/70" />
            </div>
            <p className="text-lg font-bold text-[#1A1C1A] truncate">{stats?.topDonators[0]?.senderName ?? '—'}</p>
            <p className="text-xs text-zinc-400 mt-1">{stats?.topDonators[0] ? `฿${stats.topDonators[0].total.toLocaleString()} total` : 'No donations yet'}</p>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[#6B726A] uppercase tracking-wide">Leaderboard</span>
              <Trophy className="w-4 h-4 text-[#4B5E53]/70" />
            </div>
            {stats?.topDonators.length ? (
              <ol className="space-y-1">
                {stats.topDonators.slice(0, 3).map((d, i) => (
                  <li key={d.senderName} className="flex justify-between text-sm">
                    <span className="text-[#6B726A]">{i + 1}. {d.senderName}</span>
                    <span className="font-medium text-[#1A1C1A]">฿{d.total.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-zinc-400">No data yet</p>}
          </Card>
        </div>

        {/* Manual trigger */}
        <Card>
          <CardSection title="Fire a manual alert">
            <form onSubmit={handleManualTrigger} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <Input value={triggerName}    onChange={setTriggerName}    placeholder="Sender name"         className="w-full" />
              <Input value={triggerMessage} onChange={setTriggerMessage} placeholder="Message (optional)"  className="w-full" />
              <Input value={triggerAmount}  onChange={setTriggerAmount}  placeholder="Amount (THB)" type="number" className="w-full" />
              <button type="submit" disabled={triggering}
                className="flex items-center justify-center gap-2 bg-[#4B5E53] hover:bg-[#3A4B42] text-white text-sm font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50">
                {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {triggering ? 'Sending…' : 'Fire alert'}
              </button>
            </form>
            {triggerResult && <p className="text-sm text-[#6B726A]">{triggerResult}</p>}
          </CardSection>
        </Card>

        {/* System settings */}
        <CollapsibleSection icon={<Settings className="w-4 h-4" />} title="System settings" badge="SlipOK mode, TTS, profanity filter">
          {!loaded ? <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div> : (
            <form onSubmit={saveSystem} className="p-6 space-y-5">
              <div>
                <Label>SlipOK verification mode</Label>
                <SegmentedControl value={slipOkMode} onChange={setSlipOkMode}
                  options={[{ value: 'mock', label: '🟢 Mock' }, { value: 'live', label: '🔴 Live' }]} />
                {slipOkMode === 'live' && <p className="text-xs text-amber-600 mt-1.5">Live mode charges your SlipOK quota on every real verification.</p>}
              </div>
              <div>
                <Label hint="0 = always read aloud">Minimum amount for TTS (THB)</Label>
                <Input value={minTtsAmount} onChange={setMinTtsAmount} type="number" min="0" className="w-36" />
              </div>
              <div>
                <Label hint="comma-separated">Profanity filter</Label>
                <Input value={profanityInput} onChange={setProfanityInput} placeholder="word1, word2, word3" className="w-full max-w-md" />
              </div>
              <SaveRow loading={savingSystem} result={systemResult} />
            </form>
          )}
        </CollapsibleSection>

        {/* Goal widget */}
        <CollapsibleSection icon={<Target className="w-4 h-4" />} title="Donation goal widget" badge={`${FRONTEND_BASE}/widget/goal`}>
          {!loaded ? <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-100">
              <div className="p-6 space-y-3">
                <p className="text-xs font-medium text-[#6B726A] uppercase tracking-wide">Preview</p>
                <PreviewFrame>
                  <GoalPreview label={goalLabel} current={Number(goalCurrent)||0} target={Number(goalTarget)||0}
  barColor={goalBarColor} textColor={goalTextColor} font={goalFont}
  showPct={goalShowPct} showCd={goalShowCd} endsAt={goalEndsAt} />
                </PreviewFrame>
                <WidgetLink path="/widget/goal" label="Open widget ↗" />
              </div>
              <form onSubmit={saveGoal} className="p-6 space-y-4 overflow-y-auto max-h-130">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Label</Label><Input value={goalLabel}  onChange={setGoalLabel}  placeholder="New Mic" className="w-full" /></div>
                  <div><Label>Target (THB)</Label><Input value={goalTarget} onChange={setGoalTarget} type="number" min="0" className="w-full" /></div>
                  <div><Label hint="auto-updates">Current (THB)</Label><Input value={goalCurrent} onChange={setGoalCurrent} type="number" min="0" className="w-full" /></div>
                  <div>
                    <Label>End date</Label>
                    <div className="flex items-center gap-2">
                      <input type="datetime-local" value={goalEndsAt} onChange={(e) => setGoalEndsAt(e.target.value)}
                        className="rounded-xl border border-[#E5E3DD] bg-[#F3F1ED] px-3 py-2 text-sm text-[#1A1C1A] focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/15 focus:border-[#4B5E53] transition-all" />
                      {goalEndsAt && <GhostBtn onClick={clearGoalDeadline} className="text-red-400 hover:text-red-600">Clear</GhostBtn>}
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-xs font-semibold text-[#6B726A] mb-3">Appearance</p>
                  <div className="space-y-3">
                    <div>
                      <Label>Colour preset</Label>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {GOAL_PRESETS.map((t) => (
                          <button key={t.name} type="button" onClick={() => { setGoalBarColor(t.bar); setGoalTextColor(t.text); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${goalBarColor === t.bar ? 'border-[#4B5E53]/40 bg-[#4B5E53]/8 text-blue-700' : 'border-[#E5E3DD] text-[#6B726A] hover:border-[#4B5E53]/40'}`}>
                            <span className="w-3 h-3 rounded-full" style={{ background: t.bar }} />{t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorSwatch label="Bar colour"  value={goalBarColor}  onChange={setGoalBarColor} />
                      <ColorSwatch label="Text colour" value={goalTextColor} onChange={setGoalTextColor} />
                    </div>
                    <div>
                      <Label>Font</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {FONT_OPTIONS.map((f) => (
                          <button key={f.value} type="button" onClick={() => setGoalFont(f.value)}
                            className={`px-3 py-2 rounded-xl border text-left transition-all ${goalFont === f.value ? 'border-[#4B5E53]/40 bg-[#4B5E53]/8' : 'border-[#E5E3DD] hover:border-[#4B5E53]/40'}`}>
                            <span className="block text-xs text-[#6B726A]">{f.label}</span>
                            <span className="block text-base text-[#1A1C1A]" style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.sample}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Toggle on={goalShowCd}  onClick={() => setGoalShowCd(p => !p)}  label="Countdown" />
                      <Toggle on={goalShowPct} onClick={() => setGoalShowPct(p => !p)} label="Percentage" />
                    </div>
                  </div>
                </div>
                <SaveRow loading={savingGoal} result={goalResult} />
              </form>
            </div>
          )}
        </CollapsibleSection>

        {/* Top donators widget */}
        <CollapsibleSection icon={<Trophy className="w-4 h-4" />} title="Top donators widget" badge={`${FRONTEND_BASE}/widget/top-donators`}>
          {!loaded ? <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-100">
              <div className="p-6 space-y-3">
                <p className="text-xs font-medium text-[#6B726A] uppercase tracking-wide">Preview</p>
                <PreviewFrame>
                 <TopPreview textColor={topTextColor} accentColor={topAccent} barColor={topBarColor}
  font={topFont} layout={topLayout} showBar={topShowBar} limit={Number(topLimit)} />
                </PreviewFrame>
                <WidgetLink path="/widget/top-donators" label="Open widget ↗" />
              </div>
              <form onSubmit={saveTop} className="p-6 space-y-4 overflow-y-auto max-h-130">
                <div>
                  <Label>Number to show</Label>
                  <SegmentedControl value={topLimit} onChange={setTopLimit} options={[{ value: '5', label: 'Top 5' }, { value: '10', label: 'Top 10' }]} />
                </div>
                <div>
                  <Label>Layout</Label>
                  <SegmentedControl value={topLayout} onChange={setTopLayout} options={[{ value: 'list', label: '≡ List' }, { value: 'podium', label: '🥇 Podium' }]} />
                </div>
                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-xs font-semibold text-[#6B726A] mb-3">Appearance</p>
                  <div className="space-y-3">
                    <div>
                      <Label>Colour preset</Label>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {TOP_PRESETS.map((t) => (
                          <button key={t.name} type="button" onClick={() => { setTopAccent(t.accent); setTopBarColor(t.bar); setTopTextColor(t.text); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${topAccent === t.accent ? 'border-[#4B5E53]/40 bg-[#4B5E53]/8 text-blue-700' : 'border-[#E5E3DD] text-[#6B726A] hover:border-[#4B5E53]/40'}`}>
                            <span className="w-3 h-3 rounded-full" style={{ background: t.accent }} />{t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorSwatch label="Accent / #1"  value={topAccent}    onChange={setTopAccent} />
                      <ColorSwatch label="Bar fill"     value={topBarColor}  onChange={setTopBarColor} />
                      <ColorSwatch label="Text colour"  value={topTextColor} onChange={setTopTextColor} />
                    </div>
                    <div>
                      <Label>Font</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {FONT_OPTIONS.map((f) => (
                          <button key={f.value} type="button" onClick={() => setTopFont(f.value)}
                            className={`px-3 py-2 rounded-xl border text-left transition-all ${topFont === f.value ? 'border-[#4B5E53]/40 bg-[#4B5E53]/8' : 'border-[#E5E3DD] hover:border-[#4B5E53]/40'}`}>
                            <span className="block text-xs text-[#6B726A]">{f.label}</span>
                            <span className="block text-base text-[#1A1C1A]" style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.sample}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <Toggle on={topShowBar} onClick={() => setTopShowBar(p => !p)} label="Show relative bar" />
                  </div>
                </div>
                <SaveRow loading={savingTop} result={topResult} />
              </form>
            </div>
          )}
        </CollapsibleSection>

        {/* Timer widget */}
        <CollapsibleSection icon={<Timer className="w-4 h-4" />} title="Subathon timer widget" badge={`${FRONTEND_BASE}/widget/timer`}>
          {timerEndsAt && (
            <div className="mx-6 mt-4 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-sm text-emerald-700">Ends: {new Date(timerEndsAt).toLocaleString()}</span>
              <button type="button" onClick={resetTimer} disabled={savingTimer} className="ml-auto text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-40">Reset</button>
            </div>
          )}
          {!loaded ? <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-100">
              <div className="p-6 space-y-3">
                <p className="text-xs font-medium text-[#6B726A] uppercase tracking-wide">Preview</p>
                <PreviewFrame>
                  <TimerPreview textColor={timerText} font={timerFont} layout={timerLayout} />
                </PreviewFrame>
                <WidgetLink path="/widget/timer" label="Open widget ↗" />
              </div>
              <form onSubmit={saveTimer} className="p-6 space-y-4 overflow-y-auto max-h-130">
                <Toggle on={timerEnabled} onClick={() => setTimerEnabled(p => !p)} label="Enable subathon timer" />
                <div>
                  <Label hint="e.g. 30 mins per 100 THB">Time added per donation</Label>
                  <div className="flex items-center gap-3 mt-1">
                    <div><p className="text-xs text-zinc-400 mb-1">THB</p><Input value={timerBaseAmt}  onChange={setTimerBaseAmt}  type="number" min="1" step="1"    className="w-24" /></div>
                    <span className="text-zinc-400 mt-4">→</span>
                    <div><p className="text-xs text-zinc-400 mb-1">Minutes</p><Input value={timerBaseMins} onChange={setTimerBaseMins} type="number" min="0.01" step="0.01" className="w-24" /></div>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1.5">฿{timerBaseAmt} = {Number(timerBaseMins) >= 1 ? `${timerBaseMins} min` : `${Math.round(Number(timerBaseMins)*60)} sec`}</p>
                </div>
                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-xs font-semibold text-[#6B726A] mb-3">Appearance</p>
                  <div className="space-y-3">
                    <div>
                      <Label>Colour preset</Label>
                      <div className="flex gap-2 flex-wrap mt-1">
                        {TIMER_PRESETS.map((t) => (
                          <button key={t.name} type="button" onClick={() => { setTimerText(t.text); setTimerExpired(t.expired); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${timerText === t.text ? 'border-[#4B5E53]/40 bg-[#4B5E53]/8 text-blue-700' : 'border-[#E5E3DD] text-[#6B726A] hover:border-[#4B5E53]/40'}`}>
                            <span className="w-3 h-3 rounded-full" style={{ background: t.text }} />{t.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorSwatch label="Timer colour"   value={timerText}    onChange={setTimerText} />
                      <ColorSwatch label="Expired colour" value={timerExpired} onChange={setTimerExpired} />
                    </div>
                    <div>
                      <Label>Font</Label>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {FONT_OPTIONS.map((f) => (
                          <button key={f.value} type="button" onClick={() => setTimerFont(f.value)}
                            className={`px-3 py-2 rounded-xl border text-left transition-all ${timerFont === f.value ? 'border-[#4B5E53]/40 bg-[#4B5E53]/8' : 'border-[#E5E3DD] hover:border-[#4B5E53]/40'}`}>
                            <span className="block text-xs text-[#6B726A]">{f.label}</span>
                            <span className="block text-base text-[#1A1C1A]" style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.sample}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Layout</Label>
                      <SegmentedControl value={timerLayout} onChange={setTimerLayout} options={[{ value: 'digital', label: 'Digital' }, { value: 'minimal', label: 'Minimal' }, { value: 'circle', label: 'Circle' }]} />
                    </div>
                    <div>
                      <Label>Animation</Label>
                      <SegmentedControl value={timerAnim} onChange={setTimerAnim} options={[{ value: 'pulse', label: 'Pulse' }, { value: 'glow', label: 'Glow' }, { value: 'none', label: 'None' }]} />
                    </div>
                  </div>
                </div>
                <SaveRow loading={savingTimer} result={timerResult} />
              </form>
            </div>
          )}
        </CollapsibleSection>

        {/* Alert overlay widget */}
        <CollapsibleSection icon={<Bell className="w-4 h-4" />} title="Donation alert overlay" badge={`${FRONTEND_BASE}/widget/alert`}>
          {!loaded ? <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-100">
              <div className="p-6 space-y-3">
                <p className="text-xs font-medium text-[#6B726A] uppercase tracking-wide">Preview</p>
                <PreviewFrame>
                  <AlertPreview font={alertFont} textColor={alertTextColor} accentColor={alertAccent} />
                </PreviewFrame>
                <div className="flex gap-3">
                  <WidgetLink path="/widget/alert" label="Open widget ↗" />
                  <WidgetLink path="/overlay" label="Legacy overlay ↗" />
                </div>
              </div>
              <form onSubmit={saveAlert} className="p-6 space-y-4 overflow-y-auto max-h-130">
                <div>
                  <Label>Colour preset</Label>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {ALERT_PRESETS.map((t) => (
                      <button key={t.name} type="button" onClick={() => { setAlertAccent(t.accent); setAlertTextColor(t.text); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${alertAccent === t.accent ? 'border-[#4B5E53]/40 bg-[#4B5E53]/8 text-blue-700' : 'border-[#E5E3DD] text-[#6B726A] hover:border-[#4B5E53]/40'}`}>
                        <span className="w-3 h-3 rounded-full" style={{ background: t.accent }} />{t.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ColorSwatch label="Accent colour" value={alertAccent}    onChange={setAlertAccent} />
                  <ColorSwatch label="Text colour"   value={alertTextColor} onChange={setAlertTextColor} />
                </div>
                <div>
                  <Label>Font</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {FONT_OPTIONS.map((f) => (
                      <button key={f.value} type="button" onClick={() => setAlertFont(f.value)}
                        className={`px-3 py-2 rounded-xl border text-left transition-all ${alertFont === f.value ? 'border-[#4B5E53]/40 bg-[#4B5E53]/8' : 'border-[#E5E3DD] hover:border-[#4B5E53]/40'}`}>
                        <span className="block text-xs text-[#6B726A]">{f.label}</span>
                        <span className="block text-base text-[#1A1C1A]" style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.sample}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Entrance animation</Label>
                  <SegmentedControl value={alertAnimation} onChange={setAlertAnimation} options={[{ value: 'slide-up', label: '↑ Slide' }, { value: 'fade', label: '◎ Fade' }, { value: 'bounce', label: '⟳ Bounce' }]} />
                </div>
                <div>
                  <Label hint="7000 = 7 seconds">Display duration (ms)</Label>
                  <Input value={alertDuration} onChange={setAlertDuration} type="number" min="2000" step="500" className="w-36" />
                </div>
                <div>
                  <Label hint="optional">Custom GIF / image URL</Label>
                  <Input value={alertGifUrl} onChange={setAlertGifUrl} placeholder="https://…/alert.gif" className="w-full" />
                </div>
                <div>
                  <Label hint="leave blank for default sound">Custom sound URL</Label>
                  <Input value={alertSoundUrl} onChange={setAlertSoundUrl} placeholder="https://…/sound.mp3" className="w-full" />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Toggle on={alertTts}     onClick={() => setAlertTts(p => !p)}     label="TTS" />
                  <Toggle on={alertShowGif} onClick={() => setAlertShowGif(p => !p)} label="Show GIF/image" />
                </div>
                <SaveRow loading={savingAlert} result={alertResult} />
              </form>
            </div>
          )}
        </CollapsibleSection>

        {/* Donation history */}
        <Card>
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-[#1A1C1A]">Donation history</h2>
            <GhostBtn onClick={() => { setLoadingData(true); fetchData(page); }}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </GhostBtn>
          </div>

          {loadingData ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-[#6B726A]/50" /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      {['Name', 'Message', 'Amount', 'Status', 'Source', 'Date', ''].map((h) => (
                        <th key={h} className="text-left text-xs font-medium text-zinc-400 uppercase tracking-wide px-4 py-3 first:pl-6 last:pr-6">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {donations.map((d) => {
                      const st = STATUS_CONFIG[d.verificationStatus] ?? STATUS_CONFIG['MANUAL'];
                      return (
                        <tr key={d.id} className="hover:bg-[#F9F8F6] transition-colors">
                          <td className="px-4 py-3 pl-6 font-medium text-[#1A1C1A] whitespace-nowrap">{d.senderName}</td>
                          <td className="px-4 py-3 text-[#6B726A] max-w-45 truncate">{d.message ?? <span className="text-[#6B726A]/50">—</span>}</td>
                          <td className="px-4 py-3 font-semibold text-[#1A1C1A] whitespace-nowrap">฿{d.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${st.className}`}>{st.label}</span>
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-xs">{d.source}</td>
                          <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">{new Date(d.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}</td>
                          <td className="px-4 py-3 pr-6">
                            <div className="flex items-center gap-3">
                              <button onClick={() => handleReplay(d.id)} disabled={replayingId === d.id}
                                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-[#4B5E53] disabled:opacity-40 transition-colors">
                                {replayingId === d.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Repeat2 className="w-3.5 h-3.5" />}
                                {replayOk === d.id ? 'Sent!' : 'Replay'}
                              </button>
                              {d.slipImageUrl && (
                                <a href={`${import.meta.env.VITE_API_BASE_URL}${d.slipImageUrl}`} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-zinc-400 hover:text-[#4B5E53] transition-colors">
                                  Slip ↗
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 px-6 py-4 border-t border-zinc-100">
                  <button onClick={() => { setLoadingData(true); fetchData(page - 1); }} disabled={page <= 1}
                    className="text-sm text-[#6B726A] hover:text-[#4B5E53] disabled:opacity-30 transition-colors">← Previous</button>
                  <span className="text-sm text-zinc-400">{page} of {totalPages}</span>
                  <button onClick={() => { setLoadingData(true); fetchData(page + 1); }} disabled={page >= totalPages}
                    className="text-sm text-[#6B726A] hover:text-[#4B5E53] disabled:opacity-30 transition-colors">Next →</button>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
