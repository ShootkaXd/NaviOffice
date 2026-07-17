import { useState } from 'react';
import { MeetingRoom } from '../types';
import { ApiError, createBooking } from '../api';
import { showToast } from '../utils';

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
      await createBooking(room.id, `${date}T${start}:00`, `${date}T${end}:00`, subject);
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
