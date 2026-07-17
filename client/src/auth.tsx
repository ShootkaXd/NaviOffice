import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from './types';
import * as api from './api';

const USER_KEY = 'navioffice_user';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => (api.getToken() ? readStoredUser() : null));
  const [loading, setLoading] = useState(() => !!api.getToken() && !readStoredUser());

  // Глобальный 401 из api-слоя: токен уже стёрт — показываем логин.
  useEffect(() => {
    function onUnauthorized() {
      localStorage.removeItem(USER_KEY);
      setUser(null);
    }
    window.addEventListener(api.UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(api.UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // Валидация токена при старте + обновление данных пользователя.
  useEffect(() => {
    if (!api.getToken()) {
      setLoading(false);
      return;
    }
    api
      .getMe()
      .then((me) => {
        setUser(me);
        localStorage.setItem(USER_KEY, JSON.stringify(me));
      })
      .catch(() => {
        // 401 обработан глобально; сетевые ошибки — остаёмся на сохранённом user.
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.login(username, password);
    api.setToken(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    api.clearToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
