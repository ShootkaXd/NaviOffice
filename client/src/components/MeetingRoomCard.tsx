import { useEffect, useMemo, useState } from 'react';
import { BookingItem, MeetingRoom, RoomStatus } from '../types';
import { ApiError, createBooking, getMeetingRoomSchedule } from '../api';
import { showToast } from '../utils';
import Avatar from './Avatar';

export interface BookingPrefill {
  date: string;
  start: string;
  end: string;
}

interface MeetingRoomCardProps {
  room: MeetingRoom;
  status: RoomStatus | undefined;
  onClose: () => void;
  /** Открыть диалог брони; prefill — если кликнули «+» на конкретном слоте. */
  onBook: (prefill?: BookingPrefill) => void;
  /** Инкремент после успешной брони — перезагрузить расписание. */
  refreshKey: number;
  /** Сообщить родителю, что появилась новая бронь (быстрая бронь из панели). */
  onBooked: () => void;
}

const DAY_START_H = 8;
const DAY_END_H = 21;
const PX_PER_MIN = 0.8; // 12 часов ≈ 624px
const QUICK_DURATIONS = [15, 30, 45, 60, 90];

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function fmtHM(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Минуты от начала таймлайна (08:00). */
function minutesFromDayStart(iso: string) {
  const d = new Date(iso);
  return (d.getHours() - DAY_START_H) * 60 + d.getMinutes();
}

const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export default function MeetingRoomCard({ room, status, onClose, onBook, refreshKey, onBooked }: MeetingRoomCardProps) {
  const [items, setItems] = useState<BookingItem[] | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    getMeetingRoomSchedule(room.id, todayISO())
      .then((res) => {
        if (alive) setItems(res.items);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [room.id, refreshKey]);

  // Текущая и следующая встречи — по расписанию (точнее, чем 60-сек кэш статусов).
  const { current, next } = useMemo(() => {
    const list = items ?? [];
    const cur = list.find((b) => new Date(b.start) <= now && now < new Date(b.end));
    const nxt = list.filter((b) => new Date(b.start) > now).sort((a, b) => a.start.localeCompare(b.start))[0];
    return { current: cur, next: nxt };
  }, [items, now]);

  const isBusy = current !== undefined || (items === null && !!status?.busy);
  const freeUntil = next ? fmtTime(next.start) : null;

  async function quickBook(minutes: number) {
    if (quickBusy) return;
    setQuickBusy(true);
    try {
      // Старт — сейчас, округлённый вверх до 5 минут.
      const start = new Date(now);
      start.setSeconds(0, 0);
      start.setMinutes(Math.ceil(start.getMinutes() / 5) * 5);
      const end = new Date(start.getTime() + minutes * 60_000);
      const iso = (d: Date) =>
        `${todayISO()}T${fmtHM(d.getHours(), d.getMinutes())}:00`;
      await createBooking(room.id, iso(start), iso(end), 'Быстрая бронь');
      showToast(`Забронировано на ${minutes} мин`);
      onBooked();
    } catch (err) {
      showToast(err instanceof ApiError && err.status === 409 ? 'Это время уже занято' : 'Не удалось забронировать');
    } finally {
      setQuickBusy(false);
    }
  }

  // Свободные 30-минутные слоты для «+» на таймлайне.
  const freeSlots = useMemo(() => {
    const list = items ?? [];
    const slots: { h: number; m: number }[] = [];
    for (let h = DAY_START_H; h < DAY_END_H; h++) {
      for (const m of [0, 30]) {
        const slotStart = new Date(now);
        slotStart.setHours(h, m, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60_000);
        if (slotEnd <= now) continue; // прошедшие не предлагаем
        const overlaps = list.some(
          (b) => new Date(b.start) < slotEnd && slotStart < new Date(b.end)
        );
        if (!overlaps) slots.push({ h, m });
      }
    }
    return slots;
  }, [items, now]);

  const nowOffset = (now.getHours() - DAY_START_H) * 60 + now.getMinutes();
  const timelineH = (DAY_END_H - DAY_START_H) * 60 * PX_PER_MIN;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={onClose}
    >
      <div
        className="w-[780px] max-w-full max-h-[92vh] rounded-2xl overflow-hidden flex shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* ===== Левая часть: панель комнаты ===== */}
        <div
          className="flex-1 min-w-0 text-white p-6 flex flex-col relative"
          style={{
            background: `linear-gradient(135deg, #16161f 0%, #232334 55%, ${room.color}33 130%)`,
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            title="Закрыть"
          >
            ×
          </button>

          <div className="flex items-start justify-between pr-8">
            <h1 className="text-3xl font-light tracking-wide truncate">{room.name}</h1>
            <span className="text-white/50 text-sm mt-2 whitespace-nowrap ml-3">{room.capacity} мест</span>
          </div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider bg-white/10 rounded px-2 py-0.5 text-white/60">
              #Переговорная
            </span>
            {room.email && (
              <span className="text-[10px] tracking-wider bg-white/10 rounded px-2 py-0.5 text-white/60">
                {room.email}
              </span>
            )}
          </div>

          <div className="flex-1 min-h-6" />

          {/* Статус + быстрая бронь */}
          <div
            className={`rounded-xl p-4 mb-3 backdrop-blur-sm ${
              isBusy ? 'bg-red-500/30 border border-red-400/30' : 'bg-teal-600/40 border border-teal-400/30'
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-2xl font-semibold tracking-wide">
                {isBusy ? 'ЗАНЯТО' : 'СВОБОДНО'}
              </span>
              <span className="text-white/70 text-sm whitespace-nowrap">
                {isBusy && current
                  ? `до ${fmtTime(current.end)}`
                  : freeUntil
                    ? `до ${freeUntil}`
                    : 'до конца дня'}
              </span>
            </div>
            {!isBusy && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-sm font-medium mr-1">Забронировать</span>
                {QUICK_DURATIONS.map((d) => (
                  <button
                    key={d}
                    disabled={quickBusy}
                    onClick={() => quickBook(d)}
                    className="px-3 py-1.5 text-xs bg-white/15 hover:bg-white/30 rounded-md transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    {d < 60 ? `${d} минут` : d === 60 ? '1 час' : '1,5 часа'}
                  </button>
                ))}
                <button
                  onClick={() => onBook()}
                  className="px-3 py-1.5 text-xs bg-white text-gray-900 hover:bg-white/90 rounded-md transition-colors whitespace-nowrap font-medium"
                >
                  Другое время…
                </button>
              </div>
            )}
            {isBusy && current && (
              <div className="mt-2 text-sm text-white/80 truncate">
                {current.subject}
                {current.organizer && <span className="text-white/50"> · {current.organizer}</span>}
              </div>
            )}
          </div>

          {/* Далее */}
          {next && (
            <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-white/40 text-lg font-light tracking-widest uppercase">Далее</span>
                <span className="text-white/70 text-sm whitespace-nowrap">
                  с {fmtTime(next.start)} до {fmtTime(next.end)}
                </span>
              </div>
              <div className="mt-2 text-sm font-medium truncate">{next.subject}</div>
              {next.organizer && (
                <div className="flex items-center gap-2 mt-2">
                  <Avatar login="" name={next.organizer} size={28} />
                  <span className="text-xs text-white/70">{next.organizer}</span>
                </div>
              )}
              {next.attendees.length > 0 && (
                <div className="text-[10px] text-white/40 mt-1.5 truncate" title={next.attendees.join(', ')}>
                  Участники: {next.attendees.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===== Правая часть: таймлайн дня ===== */}
        <div className="w-60 bg-white flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-gray-100 flex items-baseline justify-between">
            <span className="text-sm font-semibold text-gray-800">
              {WEEKDAYS[now.getDay()]}, {String(now.getDate()).padStart(2, '0')}.{String(now.getMonth() + 1).padStart(2, '0')}.{now.getFullYear()}
            </span>
            <span className="text-sm text-gray-400 tabular-nums">
              {fmtHM(now.getHours(), now.getMinutes())}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="relative ml-12 mr-2 my-2" style={{ height: timelineH }}>
              {/* Часовые линии и подписи */}
              {Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => {
                const h = DAY_START_H + i;
                const top = i * 60 * PX_PER_MIN;
                return (
                  <div key={h}>
                    <span
                      className="absolute -left-11 text-[10px] text-gray-400 tabular-nums -translate-y-1/2"
                      style={{ top }}
                    >
                      {fmtHM(h, 0)}
                    </span>
                    <div
                      className="absolute left-0 right-0 border-t border-dashed border-gray-200"
                      style={{ top }}
                    />
                  </div>
                );
              })}

              {/* Линия «сейчас» */}
              {nowOffset >= 0 && nowOffset <= (DAY_END_H - DAY_START_H) * 60 && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-red-400 z-10 pointer-events-none"
                  style={{ top: nowOffset * PX_PER_MIN }}
                >
                  <span className="absolute -left-1.5 -top-[3px] w-1.5 h-1.5 rounded-full bg-red-400" />
                </div>
              )}

              {/* Свободные слоты: «+» */}
              {freeSlots.map(({ h, m }) => (
                <button
                  key={`${h}-${m}`}
                  onClick={() =>
                    onBook({
                      date: todayISO(),
                      start: fmtHM(h, m),
                      end: m === 30 ? fmtHM(h + 1, 0) : fmtHM(h, 30),
                    })
                  }
                  className="absolute left-0 right-0 flex items-center justify-center text-gray-200 hover:text-accent hover:bg-indigo-50/60 rounded transition-colors text-sm"
                  style={{ top: ((h - DAY_START_H) * 60 + m) * PX_PER_MIN + 1, height: 30 * PX_PER_MIN - 2 }}
                  title={`Забронировать ${fmtHM(h, m)}`}
                >
                  +
                </button>
              ))}

              {/* Брони */}
              {(items ?? []).map((b, i) => {
                const top = Math.max(0, minutesFromDayStart(b.start) * PX_PER_MIN);
                const bottom = Math.min(timelineH, minutesFromDayStart(b.end) * PX_PER_MIN);
                if (bottom <= 0 || top >= timelineH) return null;
                const height = bottom - top;
                return (
                  <div
                    key={i}
                    className="absolute left-0 right-0 rounded-md bg-sky-100 border border-sky-200 px-2 py-1 overflow-hidden z-[5]"
                    style={{ top, height: Math.max(height, 16) }}
                    title={`${fmtTime(b.start)}–${fmtTime(b.end)} ${b.subject}${b.organizer ? ' · ' + b.organizer : ''}`}
                  >
                    <div className="text-[10px] font-medium text-sky-900 truncate">{b.subject}</div>
                    {height > 30 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Avatar login="" name={b.organizer || '?'} size={14} />
                        <span className="text-[9px] text-sky-700 truncate">{b.organizer}</span>
                      </div>
                    )}
                    {height > 50 && b.attendees.length > 0 && (
                      <div className="text-[9px] text-sky-600/70 truncate mt-0.5">
                        +{b.attendees.length} участн.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
