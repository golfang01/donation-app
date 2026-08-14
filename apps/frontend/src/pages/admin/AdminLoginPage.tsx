import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Radio } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const PANEL_CLIP = 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 0 100%)';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const { login } = useAuth();
  const navigate  = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password);
      navigate('/admin', { replace: true });
    } catch {
      setError('Invalid username or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div
        className="w-full max-w-sm bg-panel border border-white/5"
        style={{ clipPath: PANEL_CLIP }}
      >
        <div className="px-8 pt-8 pb-2">
          <div className="flex items-center gap-2 text-signal mb-2">
            <Radio className="w-4 h-4" />
            <span className="font-mono text-xs tracking-[0.2em] uppercase">
              Admin Access
            </span>
          </div>
          <h1 className="font-display text-3xl text-ink uppercase tracking-wide">
            Sign in
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 pt-4 space-y-4">
          <div>
            <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
              Username
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-panel-raised border border-white/10 px-4 py-2.5 text-ink font-body text-sm focus:outline-none focus:border-signal/60 transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-panel-raised border border-white/10 px-4 py-2.5 text-ink font-body text-sm focus:outline-none focus:border-signal/60 transition-colors"
            />
          </div>

          {error && (
            <p className="font-body text-sm text-live">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-signal text-void font-display uppercase tracking-wide text-sm py-3 flex items-center justify-center gap-2 hover:bg-signal/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
              : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}