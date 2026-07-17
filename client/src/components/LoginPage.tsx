import { useState, FormEvent } from 'react';
import { useAuth } from '../auth';
import { ApiError } from '../api';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Неверный логин или пароль'
          : 'Не удалось подключиться к серверу'
      );
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-sidebar bg-gradient-to-br from-sidebar via-sidebar to-indigo-950 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-xs bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex flex-col items-center mb-6">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-accent mb-3">
            <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.9" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.6" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.6" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.3" />
          </svg>
          <h1 className="text-gray-900 font-semibold text-lg tracking-wide">NaviOffice</h1>
          <p className="text-gray-400 text-xs mt-1">Карта офиса</p>
        </div>

        <label className="block mb-3">
          <span className="text-gray-500 text-xs block mb-1">Логин</span>
          <input
            type="text"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </label>

        <label className="block mb-4">
          <span className="text-gray-500 text-xs block mb-1">Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </label>

        {error && (
          <div className="mb-4 text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || !username.trim() || !password}
          className="w-full py-2 bg-accent hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {busy ? 'Вход…' : 'Войти'}
        </button>
      </form>
    </div>
  );
}
