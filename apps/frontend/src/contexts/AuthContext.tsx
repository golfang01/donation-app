/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { setMemoryToken } from '../lib/authToken';

interface AuthContextValue {
  token:    string | null;
  username: string | null;
  login:    (username: string, password: string) => Promise<void>;
  logout:   () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,    setToken]    = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ username: string }>('/api/admin/auth/me', { withCredentials: true })
      .then(({ data }) => setUsername(data.username))
      .catch(() => {});
  }, []);

  async function login(usernameInput: string, password: string) {
    const { data } = await api.post<{ username: string; token: string }>(
      '/api/admin/auth/login',
      { username: usernameInput, password },
      { withCredentials: true }
    );
    setMemoryToken(data.token);
    setToken(data.token);
    setUsername(data.username);
  }

  function logout() {
    api.post('/api/admin/auth/logout', {}, { withCredentials: true }).catch(() => {});
    setMemoryToken(null);
    setToken(null);
    setUsername(null);
  }

  return (
    <AuthContext.Provider value={{ token, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}