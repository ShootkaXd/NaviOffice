import { useState } from 'react';
import { Room } from '../types';
import { useAuth } from '../auth';
import { useStore, refreshMap } from '../store';
import { unassignRoom } from '../api';
import { showToast } from '../utils';
import Avatar from './Avatar';

interface RoomCardProps {
  room: Room;
  x: number;
  y: number;
  onClose: () => void;
  onAssign: () => void;
}

export default function RoomCard({ room, x, y, onClose, onAssign }: RoomCardProps) {
  const { user } = useAuth();
  const { state, dispatch } = useStore();
  const canAssign = user?.role === 'Admin' || user?.role === 'Secretary';
  const [busy, setBusy] = useState(false);

  const floor = state.floors.find((f) => f.id === room.floorId);
  const office = state.offices.find((o) => o.id === floor?.officeId);

  async function handleUnassign(login: string) {
    if (busy) return;
    setBusy(true);
    try {
      await unassignRoom(room.id, login);
      await refreshMap(dispatch);
      showToast('Сотрудник отвязан от помещения');
    } catch {
      showToast('Не удалось отвязать сотрудника');
    } finally {
      setBusy(false);
    }
  }

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

      <div className="text-sm font-semibold text-gray-900 pr-6">{room.name}</div>
      <div className="text-[11px] text-gray-400 mt-0.5">
        {office ? `Офис «${office.name}», ` : ''}{floor?.name ?? ''} · {room.capacity} мест
      </div>

      <div className="mt-3 border-t border-gray-100 pt-2.5">
        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Сотрудники помещения</div>
        {room.assignments.length === 0 ? (
          <div className="text-xs text-gray-300 py-1">Никто не привязан</div>
        ) : (
          <div className="max-h-44 overflow-y-auto divide-y divide-gray-50">
            {room.assignments.map((a) => (
              <div key={a.login} className="flex items-center gap-2 py-1.5">
                <Avatar login={a.login} name={a.displayName} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-800 truncate">{a.displayName}</div>
                  <div className="text-[10px] text-gray-400 truncate">{a.title ?? a.department}</div>
                </div>
                {canAssign && (
                  <button
                    onClick={() => handleUnassign(a.login)}
                    disabled={busy}
                    className="text-gray-300 hover:text-red-400 text-sm leading-none px-1"
                    title="Отвязать"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {canAssign && (
        <button
          onClick={onAssign}
          className="mt-3 w-full py-1.5 text-xs bg-accent hover:bg-indigo-500 text-white rounded-md transition-colors"
        >
          Привязать сотрудника
        </button>
      )}
    </div>
  );
}
