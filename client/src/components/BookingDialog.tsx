import { useEffect, useRef, useState } from 'react';
import { Employee, MeetingRoom } from '../types';
import { ApiError, createBooking, searchEmployees } from '../api';
import { showToast } from '../utils';
import Avatar from './Avatar';

interface BookingDialogProps {
  room: MeetingRoom;
  onClose: () => void;
  onBooked: () => void;
}

/** Слоты 08:00–20:00 с шагом 15 минут. */
const TIME_SLOTS: string[] = [];
for (let h = 8; h <= 20; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 20 && m > 0) break;
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BookingDialog({ room, onClose, onBooked }: BookingDialogProps) {
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [subject, setSubject] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attendees, setAttendees] = useState<Employee[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Employee[]>([]);
  const debounceRef = useRef<number | null>(null);

  // Поиск участников с дебаунсом.
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      searchEmployees(query.trim())
        .then((list) => setResults(list.filter((e) => !attendees.some((a) => a.login === e.login)).slice(0, 6)))
        .catch(() => setResults([]));
    }, 250);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query, attendees]);

  function addAttendee(emp: Employee) {
    setAttendees((prev) => [...prev, emp]);
    setQuery('');
    setResults([]);
  }

  function removeAttendee(login: string) {
    setAttendees((prev) => prev.filter((a) => a.login !== login));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (end <= start) {
      setError('Время окончания должно быть позже начала');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // Локальное время без смещения — сервер трактует так же.
      await createBooking(
        room.id,
        `${date}T${start}:00`,
        `${date}T${end}:00`,
        subject,
        attendees.map((a) => a.login)
      );
      showToast('Переговорная забронирована');
      onBooked();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Это время уже занято');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Не удалось забронировать');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center"
      onMouseDown={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-80 bg-white rounded-xl shadow-2xl p-5"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Бронирование</h3>
        <p className="text-xs text-gray-400 mb-4">{room.name}</p>

        <label className="block mb-3">
          <span className="text-xs text-gray-500 block mb-1">Дата</span>
          <input
            type="date"
            value={date}
            min={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </label>

        <div className="flex gap-2 mb-3">
          <label className="flex-1">
            <span className="text-xs text-gray-500 block mb-1">С</span>
            <select
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex-1">
            <span className="text-xs text-gray-500 block mb-1">До</span>
            <select
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="block mb-3">
          <span className="text-xs text-gray-500 block mb-1">Тема встречи</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Еженедельный синк"
            className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
          />
        </label>

        {/* Участники */}
        <div className="mb-3">
          <span className="text-xs text-gray-500 block mb-1">Участники</span>
          {attendees.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1.5">
              {attendees.map((a) => (
                <span
                  key={a.login}
                  className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[11px] rounded-full pl-1 pr-1.5 py-0.5"
                >
                  <Avatar login={a.login} name={a.displayName} size={16} />
                  {a.displayName.split(/\s+/).slice(0, 2).join(' ')}
                  <button
                    type="button"
                    onClick={() => removeAttendee(a.login)}
                    className="text-indigo-300 hover:text-indigo-600 leading-none"
                    title="Убрать"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти сотрудника…"
              className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:border-accent"
            />
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-40 overflow-y-auto">
                {results.map((emp) => (
                  <button
                    key={emp.login}
                    type="button"
                    onClick={() => addAttendee(emp)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50"
                  >
                    <Avatar login={emp.login} name={emp.displayName} size={22} />
                    <span className="min-w-0">
                      <span className="block text-xs text-gray-800 truncate">{emp.displayName}</span>
                      <span className="block text-[10px] text-gray-400 truncate">{emp.department}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="text-xs text-red-500 mb-3">{error}</div>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2 text-xs bg-accent hover:bg-indigo-500 text-white rounded-md disabled:opacity-50 transition-colors"
          >
            {busy ? 'Бронирование…' : 'Забронировать'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
