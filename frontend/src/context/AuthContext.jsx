import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => tokenStore.get());
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));

  const logout = useCallback(() => {
    tokenStore.clear();
    setToken(null);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    api
      .get('/auth/me')
      .then((res) => !cancelled && setUser(res.data.data.user))
      .catch((err) => {
        // jika offline, pakai data user tersimpan agar kasir tetap bisa mencatat
        if (!err.response) {
          try {
            const cached = JSON.parse(localStorage.getItem('cs_user') || 'null');
            if (cached && !cancelled) setUser(cached);
          } catch { /* abaikan */ }
        } else if (!cancelled) logout();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [token, logout]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem('cs_user', JSON.stringify(user));
      else localStorage.removeItem('cs_user');
    } catch { /* abaikan */ }
  }, [user]);

  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    const { token: t, user: u } = res.data.data;
    tokenStore.set(t);
    setToken(t);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, logout, isOwner: user?.role === 'OWNER' }),
    [user, token, loading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
