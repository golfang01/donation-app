import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate('/admin', { replace: true });
    } catch {
      setError('Incorrect username or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Wordmark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#4B5E53] mb-4">
            <span className="text-white text-lg font-bold">D</span>
          </div>
          <h1 className="text-xl font-semibold text-[#1A1C1A] tracking-tight">Admin sign in</h1>
          <p className="text-sm text-[#6B726A] mt-1">Donation dashboard access</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E5E3DD] rounded-2xl shadow-sm p-8 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#6B726A] mb-1.5">
                Username
              </label>
              <input
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-[#E5E3DD] bg-[#F3F1ED] px-4 py-2.5 text-sm text-[#1A1C1A] placeholder:text-[#6B726A]/50 focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/20 focus:border-[#4B5E53] transition-all"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#6B726A] mb-1.5">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#E5E3DD] bg-[#F3F1ED] px-4 py-2.5 text-sm text-[#1A1C1A] placeholder:text-[#6B726A]/50 focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/20 focus:border-[#4B5E53] transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4B5E53] hover:bg-[#3A4B42] text-white text-sm font-semibold py-2.5 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-[#6B726A] mt-6">
          Donation Admin Panel
        </p>
      </div>
    </div>
  );
}