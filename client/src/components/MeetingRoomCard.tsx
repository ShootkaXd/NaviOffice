import { useEffect, useState } from 'react';
import { BookingItem, MeetingRoom, RoomStatus } from '../types';
import { getMeetingRoomSchedule } from '../api';

interface MeetingRoomCardProps {
  room: MeetingRoom;
  status: RoomStatus | undefined;
  x: number;
  y: number;
  onClose: () => void;
  onBook: () => void;
  /** Инкремент после успешной брони — перезагрузить расписание. */
  refreshKey: number;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MeetingRoomCard({ room, status, x, y, onClose, onBook, refreshKey }: MeetingRoomCardProps) {
  const [items, setItems] = useState<BookingItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    setItems(null);
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

  const statusLine = status
    ? status.busy
      ? `Занята${status.until ? ` до ${fmtTime(status.until)}` : ''}`
      : `Свободна${status.until ? ` до ${fmtTime(status.until)}` : ''}`
    : null;

  return (
    <div
      className="absolute z-30 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-4"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        title="Закрыть"
      >
        ×
      </button>

      <div className="flex items-center gap-2.5 mb-1">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${room.color}22` }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={room.color} strokeWidth="2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <line x1="8" y1="3" x2="8" y2="7" />
            <line x1="16" y1="3" x2="16" y2="7" />
          </svg>
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{room.name}</div>
          <div className="text-xs text-gray-400">Вместимость: {room.capacity}</div>
        </div>
      </div>

      {statusLine && (
        <div className="flex items-center gap-1.5 mt-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${status!.busy ? 'bg-red-500' : 'bg-green-500'}`}
          />
          <span className={`text-xs font-medium ${status!.busy ? 'text-red-600' : 'text-green-600'}`}>
            {statusLine}
          </span>
        </div>
      )}
      {room.email && <div className="text-[10px] text-gray-300 mt-1 break-all">{room.email}</div>}

      <div className="mt-3 border-t border-gray-100 pt-2.5">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Сегодня</div>
        {items === null ? (
          <div className="text-xs text-gray-300 py-1">Загрузка…</div>
        ) : items.length === 0 ? (
          <div className="text-xs text-gray-300 py-1">Сегодня броней нет</div>
        ) : (
          <div className="max-h-36 overflow-y-auto space-y-1">
            {items.map((b, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-baseline gap-2">
                  <span className="text-gray-700 font-medium whitespace-nowrap tabular-nums">
                    {fmtTime(b.start)}–{fmtTime(b.end)}
                  </span>
                  <span className="text-gray-500 truncate">
                    {b.subject}
                    {b.organizer && <span className="text-gray-300"> · {b.organizer}</span>}
                  </span>
                </div>
                {b.attendees.length > 0 && (
                  <div className="text-[10px] text-gray-400 pl-1 truncate" title={b.attendees.join(', ')}>
                    Участники: {b.attendees.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onBook}
        className="mt-3 w-full py-1.5 text-xs bg-accent hover:bg-indigo-500 text-white rounded-md transition-colors"
      >
        Забронировать
      </button>
    </div>
  );
}
