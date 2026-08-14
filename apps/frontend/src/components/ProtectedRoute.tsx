import { useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, username } = useAuth();

  // If token or username is already in context, we're verified immediately
  // — no async check needed.
  const alreadyVerified = !!(token || username);

  const [verified, setVerified] = useState<boolean | null>(
    alreadyVerified ? true : null   // null = still checking
  );

  // Only runs when there's no in-memory session — checks the httpOnly cookie.
  const checkedRef = useRef(false);
  useEffect(() => {
    if (alreadyVerified || checkedRef.current) return;
    checkedRef.current = true;

    api.get('/api/admin/auth/me', { withCredentials: true })
      .then(() => setVerified(true))
      .catch(() => setVerified(false));
  }, [alreadyVerified]);

  if (verified === null) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <span className="font-mono text-xs text-ink-muted animate-pulse uppercase tracking-widest">
          Checking session…
        </span>
      </div>
    );
  }

  return verified ? <>{children}</> : <Navigate to="/admin/login" replace />;
}