import { useState } from 'react';
import { Desk, DeskAssignment } from '../types';
import { useAuth } from '../auth';
import { useStore, refreshMap } from '../store';
import { unassignDesk } from '../api';
import { showToast } from '../utils';
import Avatar from './Avatar';

interface EmployeeCardProps {
  desk: Desk;
  x: number;
  y: number;
  onClose: () => void;
  onAssign: () => void;
}

function OccupantRow({ a, canAssign, onRemove, busy }: {
  a: DeskAssignment;
  canAssign: boolean;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Avatar login={a.login} name={a.displayName} size={40} />
      <div className="min-w-0 flex-1 text-left">
        <div className="text-xs font-semibold text-gray-900 truncate">{a.displayName}</div>
        <div className="text-[11px] text-gray-500 truncate">{a.department}</div>
        <div className="text-[10px] text-gray-400 truncate">{a.title}</div>
      </div>
      {canAssign && (
        <button
          onClick={onRemove}
          disabled={busy}
          className="text-[10px] text-red-400 border border-red-200 rounded px-1.5 py-0.5 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
        >
          Снять
        </button>
      )}
    </div>
  );
}

export default function EmployeeCard({ desk, x, y, onClose, onAssign }: EmployeeCardProps) {
  const { user } = useAuth();
  const { dispatch } = useStore();
  const canAssign = user?.role === 'Admin' || user?.role === 'Secretary';
  const [busy, setBusy] = useState(false);
  const occupants = desk.assignments;

  async function handleUnassign(login: string) {
    if (busy) return;
    setBusy(true);
    try {
      await unassignDesk(desk.id, login);
      await refreshMap(dispatch);
      showToast('Сотрудник снят с места');
    } catch {
      showToast('Не удалось снять сотрудника с места');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="absolute z-30 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 p-4"
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

      <div className="text-[10px] text-gray-300 mb-1">Место {desk.name}</div>

      {occupants.length > 0 ? (
        <div className="divide-y divide-gray-100">
          {occupants.map((a) => (
            <OccupantRow
              key={a.login}
              a={a}
              canAssign={canAssign}
              busy={busy}
              onRemove={() => handleUnassign(a.login)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center text-center py-2">
          <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-dashed border-green-300 flex items-center justify-center mb-2.5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>
          <div className="text-sm font-medium text-gray-700">Место свободно</div>
        </div>
      )}

      {canAssign && occupants.length < 2 && (
        <button
          onClick={onAssign}
          className="mt-3 w-full py-1.5 text-xs bg-accent hover:bg-indigo-500 text-white rounded-md transition-colors"
        >
          {occupants.length === 0 ? 'Назначить сотрудника' : 'Добавить второго сотрудника'}
        </button>
      )}
    </div>
  );
}
