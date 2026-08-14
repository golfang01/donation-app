
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
  id:                 string;
  senderName:         string;
  message:            string | null;
  amount:             number;
  verificationStatus: string;
  source:             string;
  slipImageUrl:       string | null;
  createdAt:          string;
}

interface Stats {
  todayTotal:  number;
  todayCount:  number;
  topDonators: { senderName: string; total: number }[];
}

interface PaginatedDonations {
  data: Donation[];
  meta: { total: number; page: number; totalPages: number };
}

interface Settings {
  slipOkMode:         string;
  minTtsAmount:       number;
  profanityList:      string[] | string;
  goalLabel:          string;
  goalTargetAmount:   number;
  goalCurrentAmount:  number;
  goalEndsAt:         string | null;
  topDonatorsLimit:   number;
  timerEnabled:       boolean;
  timerEndsAt:        string | null;
  timerBaseAmount:    number;
  timerBaseMinutes:   number;
}

// ── Constants ──────────────────────────────────────────────────────────────
const PANEL_CLIP = 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)';
const FRONTEND_BASE = import.meta.env.VITE_API_BASE_URL?.replace(':4000', ':5173') ?? 'http://localhost:5173';

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: 'text-signal  bg-signal/10  border-signal/20',
  FAILED:   'text-live    bg-live/10    border-live/20',
  PENDING:  'text-gold    bg-gold/10    border-gold/20',
  MANUAL:   'text-ink-muted bg-white/5  border-white/10',
};

// ── Shared small components ────────────────────────────────────────────────
function SectionCard({ title, icon, children }: {
  title:    string;
  icon:     React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-panel border border-white/5 px-6 py-5" style={{ clipPath: PANEL_CLIP }}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="font-display text-lg uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatCard({ icon, label, value, sub }: {
  icon:  React.ReactNode;
  label: string;
  value: string;
  sub:   string;
}) {
  return (
    <div className="bg-panel border border-white/5 px-5 py-4" style={{ clipPath: PANEL_CLIP }}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <p className="font-mono text-xs text-ink-muted uppercase tracking-wide">{label}</p>
      </div>
      <p className="font-display text-2xl text-ink uppercase">{value}</p>
      {sub && <p className="font-body text-xs text-ink-muted mt-1">{sub}</p>}
    </div>
  );
}

function Field({ label, hint, children }: {
  label:    string;
  hint?:    string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
        {label}
        {hint && <span className="ml-2 text-white/30 normal-case font-body">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', min, step, className = '' }: {
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
  type?:       string;
  min?:        string;
  step?:       string;
  className?:  string;
}) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      min={min}
      step={step}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-panel-raised border border-white/10 px-3 py-2 text-ink font-body text-sm focus:outline-none focus:border-signal/60 transition-colors ${className}`}
    />
  );
}

function SaveBar({ loading, result }: { loading: boolean; result: string | null }) {
  return (
    <div className="flex items-center gap-4 pt-2">
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 bg-signal text-void font-display uppercase tracking-wide text-sm px-6 py-2 hover:bg-signal/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          : 'Save settings'}
      </button>
      {result && <span className="font-mono text-xs text-ink-muted">{result}</span>}
    </div>
  );
}

function WidgetUrl({ path }: { path: string }) {
  return (
    <p className="font-body text-xs text-ink-muted mb-4">
      OBS URL:{' '}
      <code className="text-signal select-all">{FRONTEND_BASE}{path}</code>
    </p>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { username, logout } = useAuth();

  // ── Data state ──────────────────────────────────────────────────────────
  const [stats,       setStats]       = useState<Stats | null>(null);
  const [donations,   setDonations]   = useState<Donation[]>([]);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [loadingData, setLoadingData] = useState(true);

  // ── Action state ────────────────────────────────────────────────────────
  const [replayingId,   setReplayingId]   = useState<string | null>(null);
  const [replaySuccess, setReplaySuccess] = useState<string | null>(null);

  // ── Manual trigger ──────────────────────────────────────────────────────
  const [triggerName,    setTriggerName]    = useState('');
  const [triggerMessage, setTriggerMessage] = useState('');
  const [triggerAmount,  setTriggerAmount]  = useState('');
  const [triggering,     setTriggering]     = useState(false);
  const [triggerResult,  setTriggerResult]  = useState<string | null>(null);

  // ── Settings loaded flag ────────────────────────────────────────────────
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // ── System settings form ────────────────────────────────────────────────
  const [slipOkMode,     setSlipOkMode]     = useState('mock');
  const [minTtsAmount,   setMinTtsAmount]   = useState('0');
  const [profanityInput, setProfanityInput] = useState('');
  const [savingSystem,   setSavingSystem]   = useState(false);
  const [systemResult,   setSystemResult]   = useState<string | null>(null);

  // ── Goal widget form ────────────────────────────────────────────────────
  const [goalLabel,      setGoalLabel]      = useState('');
  const [goalTarget,     setGoalTarget]     = useState('');
  const [goalCurrent,    setGoalCurrent]    = useState('');
  const [goalEndsAt,     setGoalEndsAt]     = useState('');   // datetime-local string
  const [savingGoal,     setSavingGoal]     = useState(false);
  const [goalResult,     setGoalResult]     = useState<string | null>(null);

  // ── Top donators form ───────────────────────────────────────────────────
  const [topLimit,       setTopLimit]       = useState('5');
  const [savingTop,      setSavingTop]      = useState(false);
  const [topResult,      setTopResult]      = useState<string | null>(null);

  // ── Timer form ──────────────────────────────────────────────────────────
  const [timerEnabled,   setTimerEnabled]   = useState(false);
  const [timerEndsAt,    setTimerEndsAt]    = useState<string | null>(null);
  const [timerBaseAmt,   setTimerBaseAmt]   = useState('100'); // THB
  const [timerBaseMins,  setTimerBaseMins]  = useState('1');   // minutes
  const [savingTimer,    setSavingTimer]    = useState(false);
  const [timerResult,    setTimerResult]    = useState<string | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────

  // Convert a UTC date string to the value format datetime-local expects.
  function toDatetimeLocal(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    // datetime-local needs "YYYY-MM-DDTHH:mm" in local time
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function syncSettingsToForm(s: Settings) {
    setSlipOkMode(s.slipOkMode);
    setMinTtsAmount(String(s.minTtsAmount));
    setProfanityInput(
      Array.isArray(s.profanityList)
        ? s.profanityList.join(', ')
        : String(s.profanityList ?? '')
    );
    setGoalLabel(s.goalLabel);
    setGoalTarget(String(s.goalTargetAmount));
    setGoalCurrent(String(s.goalCurrentAmount));
    setGoalEndsAt(toDatetimeLocal(s.goalEndsAt));
    setTopLimit(String(s.topDonatorsLimit));
    setTimerEnabled(s.timerEnabled);
    setTimerEndsAt(s.timerEndsAt);
    setTimerBaseAmt(String(s.timerBaseAmount));
    setTimerBaseMins(String(s.timerBaseMinutes));
  }

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchData = useCallback(async (targetPage = 1) => {
    try {
      const [statsRes, donationsRes, settingsRes] = await Promise.all([
        api.get<Stats>('/api/admin/donations/stats'),
        api.get<PaginatedDonations>(`/api/admin/donations?page=${targetPage}&size=15`),
        api.get<Settings>('/api/admin/settings'),
      ]);
      setStats(statsRes.data);
      setDonations(donationsRes.data.data);
      setTotalPages(donationsRes.data.meta.totalPages);
      setPage(targetPage);
      syncSettingsToForm(settingsRes.data);
      setSettingsLoaded(true);
    } catch (err) {
      console.error('[dashboard] fetch error:', err);
    } finally {
      setLoadingData(false);
    }
  // syncSettingsToForm is stable (no deps) so safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
// eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchData(1); }, [fetchData]);

  // ── Action handlers ──────────────────────────────────────────────────────
  async function handleReplay(id: string) {
    setReplayingId(id);
    setReplaySuccess(null);
    try {
      await api.post(`/api/admin/donations/${id}/replay`);
      setReplaySuccess(id);
      setTimeout(() => setReplaySuccess(null), 3000);
    } catch {
      alert('Replay failed. Check the backend console.');
    } finally {
      setReplayingId(null);
    }
  }

  async function handleManualTrigger(e: FormEvent) {
    e.preventDefault();
    setTriggerResult(null);
    setTriggering(true);
    try {
      await api.post('/api/admin/donations/manual-trigger', {
        senderName: triggerName.trim(),
        message:    triggerMessage.trim() || undefined,
        amount:     Number(triggerAmount),
      });
      setTriggerResult('✅ Alert sent to OBS overlay.');
      setTriggerName('');
      setTriggerMessage('');
      setTriggerAmount('');
      fetchData(page);
    } catch {
      setTriggerResult('❌ Trigger failed. Check the backend console.');
    } finally {
      setTriggering(false);
    }
  }

  // Generic patch — keeps each form's submit handler to one call
  async function patch(
    payload:    Record<string, unknown>,
    setLoading: (v: boolean) => void,
    setResult:  (v: string)  => void,
  ) {
    setLoading(true);
    setResult('');
    try {
      await api.patch('/api/admin/settings', payload);
      setResult('✅ Saved.');
      fetchData(page);
    } catch {
      setResult('❌ Failed to save.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSystem(e: FormEvent) {
    e.preventDefault();
    await patch(
      { slipOkMode, minTtsAmount: Number(minTtsAmount), profanityList: profanityInput },
      setSavingSystem, setSystemResult,
    );
  }

  async function handleSaveGoal(e: FormEvent) {
    e.preventDefault();
    // goalEndsAt: send null if the field is empty, otherwise an ISO string.
    const endsAt = goalEndsAt ? new Date(goalEndsAt).toISOString() : null;
    await patch(
      {
        goalLabel,
        goalTargetAmount:  Number(goalTarget),
        goalCurrentAmount: Number(goalCurrent),
        goalEndsAt:        endsAt,
      },
      setSavingGoal, setGoalResult,
    );
  }

  async function handleClearGoalDeadline() {
    await patch({ goalEndsAt: null }, setSavingGoal, setGoalResult);
    setGoalEndsAt('');
  }

  async function handleSaveTop(e: FormEvent) {
    e.preventDefault();
    await patch({ topDonatorsLimit: Number(topLimit) }, setSavingTop, setTopResult);
  }

  async function handleSaveTimer(e: FormEvent) {
    e.preventDefault();
    await patch(
      {
        timerEnabled,
        timerBaseAmount:  Number(timerBaseAmt),
        timerBaseMinutes: Number(timerBaseMins),
      },
      setSavingTimer, setTimerResult,
    );
  }

  async function handleResetTimer() {
    setSavingTimer(true);
    setTimerResult('');
    try {
      await api.patch('/api/admin/settings', { timerEndsAt: null });
      setTimerEndsAt(null);
      setTimerResult('✅ Timer reset.');
    } catch {
      setTimerResult('❌ Reset failed.');
    } finally {
      setSavingTimer(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-void text-ink">

      {/* Nav */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-live animate-pulse" />
          <span className="font-display text-xl uppercase tracking-wide">Donation Admin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-ink-muted">{username}</span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 font-mono text-xs text-ink-muted hover:text-live transition-colors uppercase tracking-wide"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            icon={<TrendingUp className="w-5 h-5 text-signal" />}
            label="Today's total"
            value={stats ? `฿${stats.todayTotal.toLocaleString()}` : '—'}
            sub={stats ? `${stats.todayCount} donation${stats.todayCount !== 1 ? 's' : ''}` : ''}
          />
          <StatCard
            icon={<Users className="w-5 h-5 text-gold" />}
            label="Top donator"
            value={stats?.topDonators[0]?.senderName ?? '—'}
            sub={stats?.topDonators[0] ? `฿${stats.topDonators[0].total.toLocaleString()} total` : ''}
          />
          <div className="bg-panel border border-white/5 px-5 py-4" style={{ clipPath: PANEL_CLIP }}>
            <p className="font-mono text-xs text-ink-muted uppercase tracking-wide mb-2">Top 5 donators</p>
            {stats?.topDonators.length ? (
              <ol className="space-y-1">
                {stats.topDonators.map((d, i) => (
                  <li key={d.senderName} className="flex justify-between font-body text-sm">
                    <span className="text-ink-muted">{i + 1}. {d.senderName}</span>
                    <span className="font-mono text-gold">฿{d.total.toLocaleString()}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="font-body text-xs text-ink-muted">No verified donations yet.</p>
            )}
          </div>
        </section>

        {/* ── Manual trigger ─────────────────────────────────────────────── */}
        <SectionCard title="Manual alert trigger" icon={<Zap className="w-4 h-4 text-gold" />}>
          <form onSubmit={handleManualTrigger} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <TextInput value={triggerName}    onChange={setTriggerName}    placeholder="Sender name"     className="w-full" />
            <TextInput value={triggerMessage} onChange={setTriggerMessage} placeholder="Message (optional)" className="w-full" />
            <TextInput value={triggerAmount}  onChange={setTriggerAmount}  placeholder="Amount (THB)"    type="number" className="w-full" />
            <button
              type="submit"
              disabled={triggering}
              className="bg-gold text-void font-display uppercase tracking-wide text-sm py-2 flex items-center justify-center gap-2 hover:bg-gold/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {triggering
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                : <><Zap className="w-4 h-4" /> Fire alert</>}
            </button>
          </form>
          {triggerResult && <p className="font-mono text-xs mt-3 text-ink-muted">{triggerResult}</p>}
        </SectionCard>

        {/* ── System settings ────────────────────────────────────────────── */}
        <SectionCard title="System settings" icon={<span className="text-signal text-sm">⚙</span>}>
          {!settingsLoaded ? <p className="font-mono text-xs text-ink-muted">Loading…</p> : (
            <form onSubmit={handleSaveSystem} className="space-y-4">
              <Field label="SlipOK verification mode">
                <div className="flex gap-3 mt-1">
                  {(['mock', 'live'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSlipOkMode(mode)}
                      className={`flex-1 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${
                        slipOkMode === mode
                          ? mode === 'live'
                            ? 'bg-live/10 border-live/40 text-live'
                            : 'bg-signal/10 border-signal/40 text-signal'
                          : 'border-white/10 text-ink-muted hover:border-white/20'
                      }`}
                    >
                      {mode === 'live' ? '🔴 Live' : '🟢 Mock'}
                    </button>
                  ))}
                </div>
                {slipOkMode === 'live' && (
                  <p className="font-mono text-xs text-live mt-1">
                    ⚠ Live mode charges your SlipOK quota on every verification.
                  </p>
                )}
              </Field>
              <Field label="Minimum TTS amount (THB)" hint="0 = always read aloud">
                <TextInput value={minTtsAmount} onChange={setMinTtsAmount} type="number" min="0" className="w-40" />
              </Field>
              <Field label="Profanity filter" hint="comma-separated words">
                <TextInput value={profanityInput} onChange={setProfanityInput} placeholder="word1, word2" className="w-full" />
              </Field>
              <SaveBar loading={savingSystem} result={systemResult} />
            </form>
          )}
        </SectionCard>

        {/* ── Donation goal widget ────────────────────────────────────────── */}
        <SectionCard title="Donation goal widget" icon={<span className="text-signal text-sm">🎯</span>}>
          <WidgetUrl path="/widget/goal" />
          {!settingsLoaded ? <p className="font-mono text-xs text-ink-muted">Loading…</p> : (
            <form onSubmit={handleSaveGoal} className="space-y-4">
              <Field label="Goal label">
                <TextInput value={goalLabel} onChange={setGoalLabel} placeholder="e.g. New Mic" className="w-full" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Target amount (THB)">
                  <TextInput value={goalTarget} onChange={setGoalTarget} type="number" min="0" className="w-full" />
                </Field>
                <Field label="Current amount (THB)" hint="auto-updates on donations">
                  <TextInput value={goalCurrent} onChange={setGoalCurrent} type="number" min="0" className="w-full" />
                </Field>
              </div>

              {/* Goal deadline */}
              <Field label="Goal end date" hint="optional — leave blank for no deadline">
                <div className="flex items-center gap-3">
                  <input
                    type="datetime-local"
                    value={goalEndsAt}
                    onChange={(e) => setGoalEndsAt(e.target.value)}
                    className="bg-panel-raised border border-white/10 px-3 py-2 text-ink font-body text-sm focus:outline-none focus:border-signal/60 transition-colors"
                  />
                  {goalEndsAt && (
                    <button
                      type="button"
                      onClick={handleClearGoalDeadline}
                      className="font-mono text-xs text-live hover:underline whitespace-nowrap"
                    >
                      Clear deadline
                    </button>
                  )}
                </div>
                {goalEndsAt && (
                  <p className="font-mono text-xs text-ink-muted mt-1">
                    Deadline: {new Date(goalEndsAt).toLocaleString()}
                  </p>
                )}
              </Field>

              <SaveBar loading={savingGoal} result={goalResult} />
            </form>
          )}
        </SectionCard>

        {/* ── Top donators widget ─────────────────────────────────────────── */}
        <SectionCard title="Top donators widget" icon={<span className="text-signal text-sm">🏆</span>}>
          <WidgetUrl path="/widget/top-donators" />
          {!settingsLoaded ? <p className="font-mono text-xs text-ink-muted">Loading…</p> : (
            <form onSubmit={handleSaveTop} className="space-y-4">
              <Field label="Number of donators to show">
                <div className="flex gap-3 mt-1">
                  {[5, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTopLimit(String(n))}
                      className={`px-6 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${
                        topLimit === String(n)
                          ? 'bg-signal/10 border-signal/40 text-signal'
                          : 'border-white/10 text-ink-muted hover:border-white/20'
                      }`}
                    >
                      Top {n}
                    </button>
                  ))}
                </div>
              </Field>
              <SaveBar loading={savingTop} result={topResult} />
            </form>
          )}
        </SectionCard>

        {/* ── Subathon timer widget ───────────────────────────────────────── */}
        <SectionCard title="Subathon timer widget" icon={<span className="text-signal text-sm">⏱</span>}>
          <WidgetUrl path="/widget/timer" />

          {/* Live timer status */}
          {timerEndsAt && (
            <div className="mb-4 flex items-center gap-3 border border-signal/20 bg-signal/5 px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-signal animate-pulse shrink-0" />
              <span className="font-mono text-xs text-signal">
                Ends: {new Date(timerEndsAt).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={handleResetTimer}
                disabled={savingTimer}
                className="ml-auto font-mono text-xs text-live hover:underline disabled:opacity-40"
              >
                Reset timer
              </button>
            </div>
          )}

          {!settingsLoaded ? <p className="font-mono text-xs text-ink-muted">Loading…</p> : (
            <form onSubmit={handleSaveTimer} className="space-y-4">
              <Field label="Enable subathon timer">
                <button
                  type="button"
                  onClick={() => setTimerEnabled((prev) => !prev)}
                  className={`mt-1 px-6 py-2 font-mono text-xs uppercase tracking-wide border transition-colors ${
                    timerEnabled
                      ? 'bg-signal/10 border-signal/40 text-signal'
                      : 'border-white/10 text-ink-muted hover:border-white/20'
                  }`}
                >
                  {timerEnabled ? '✅ Enabled' : '⬜ Disabled'}
                </button>
              </Field>

              {/* Two-field ratio */}
              <Field
                label="Time added per donation"
                hint="e.g. 30 mins per 100 THB"
              >
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs text-ink-muted">THB</span>
                    <TextInput
                      value={timerBaseAmt}
                      onChange={setTimerBaseAmt}
                      type="number"
                      min="1"
                      step="1"
                      className="w-28"
                    />
                  </div>
                  <span className="font-mono text-sm text-ink-muted mt-4">→</span>
                  <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs text-ink-muted">Minutes</span>
                    <TextInput
                      value={timerBaseMins}
                      onChange={setTimerBaseMins}
                      type="number"
                      min="0.01"
                      step="0.01"
                      className="w-28"
                    />
                  </div>
                  {timerBaseAmt && timerBaseMins && (
                    <p className="font-mono text-xs text-ink-muted mt-4 whitespace-nowrap">
                      = {Number(timerBaseMins) / Number(timerBaseAmt)} min / THB
                    </p>
                  )}
                </div>
                <p className="font-mono text-xs text-ink-muted mt-2">
                  Example: a ฿{timerBaseAmt} donation adds{' '}
                  {Number(timerBaseMins) >= 1
                    ? `${timerBaseMins} min`
                    : `${Math.round(Number(timerBaseMins) * 60)} sec`}{' '}
                  to the timer.
                </p>
              </Field>

              <SaveBar loading={savingTimer} result={timerResult} />
            </form>
          )}
        </SectionCard>

        {/* ── Donation history ────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg uppercase tracking-wide">Donation history</h2>
            <button
              onClick={() => { setLoadingData(true); fetchData(page); }}
              className="flex items-center gap-1.5 font-mono text-xs text-ink-muted hover:text-signal transition-colors uppercase tracking-wide"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loadingData ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 text-signal animate-spin" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Name', 'Message', 'Amount', 'Status', 'Source', 'Date', 'Actions'].map((h) => (
                        <th key={h} className="text-left font-mono text-xs text-ink-muted uppercase tracking-wide px-3 py-2">
                          {h}
                        </th>
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
                          <span className={`font-mono text-xs border px-2 py-0.5 ${STATUS_STYLES[d.verificationStatus] ?? ''}`}>
                            {d.verificationStatus}
                          </span>
                        </td>
                        <td className="px-3 py-3 font-mono text-xs text-ink-muted">{d.source}</td>
                        <td className="px-3 py-3 font-mono text-xs text-ink-muted whitespace-nowrap">
                          {new Date(d.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleReplay(d.id)}
                              disabled={replayingId === d.id}
                              className="flex items-center gap-1 font-mono text-xs text-ink-muted hover:text-signal disabled:opacity-40 transition-colors uppercase tracking-wide"
                            >
                              {replayingId === d.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Repeat2 className="w-3.5 h-3.5" />}
                              {replaySuccess === d.id ? 'Sent!' : 'Replay'}
                            </button>
                            {d.slipImageUrl && (
                              <a
                                href={`${import.meta.env.VITE_API_BASE_URL}${d.slipImageUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-xs text-ink-muted hover:text-gold transition-colors uppercase tracking-wide"
                              >
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
                  <button
                    onClick={() => { setLoadingData(true); fetchData(page - 1); }}
                    disabled={page <= 1}
                    className="font-mono text-xs text-ink-muted hover:text-signal disabled:opacity-30 transition-colors uppercase tracking-wide"
                  >
                    ← Prev
                  </button>
                  <span className="font-mono text-xs text-ink-muted">{page} / {totalPages}</span>
                  <button
                    onClick={() => { setLoadingData(true); fetchData(page + 1); }}
                    disabled={page >= totalPages}
                    className="font-mono text-xs text-ink-muted hover:text-signal disabled:opacity-30 transition-colors uppercase tracking-wide"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
