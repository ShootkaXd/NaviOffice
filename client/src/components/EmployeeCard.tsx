import { useEffect, useState } from 'react';
import { Desk } from '../types';
import { useAuth } from '../auth';
import { useStore, refreshMap } from '../store';
import { searchEmployees, unassignDesk } from '../api';
import { showToast } from '../utils';
import Avatar from './Avatar';

interface EmployeeCardProps {
  desk: Desk;
  x: number;
  y: number;
  onClose: () => void;
  onAssign: () => void;
}

export default function EmployeeCard({ desk, x, y, onClose, onAssign }: EmployeeCardProps) {
  const { user } = useAuth();
  const { dispatch } = useStore();
  const canAssign = user?.role === 'Admin' || user?.role === 'Secretary';
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const login = desk.assignment?.login;

  // Email в assignment не входит — подтягиваем из поиска сотрудников.
  useEffect(() => {
    setEmail(null);
    if (!login) return;
    let alive = true;
    searchEmployees(login)
      .then((list) => {
        const emp = list.find((e) => e.login === login);
        if (alive && emp) setEmail(emp.email);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [login]);

  async function handleUnassign() {
    if (busy) return;
    setBusy(true);
    try {
      await unassignDesk(desk.id);
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

      {desk.assignment ? (
        <div className="flex flex-col items-center text-center">
          <Avatar login={desk.assignment.login} name={desk.assignment.displayName} size={64} className="mb-2.5" />
          <div className="text-sm font-semibold text-gray-900">{desk.assignment.displayName}</div>
          <div className="text-xs text-gray-500 mt-0.5">{desk.assignment.department}</div>
          <div className="text-xs text-gray-400">{desk.assignment.title}</div>
          {email && (
            <a href={`mailto:${email}`} className="text-xs text-accent hover:underline mt-1 break-all">
              {email}
            </a>
          )}
          <div className="text-[10px] text-gray-300 mt-1.5">Место {desk.name}</div>
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
          <div className="text-[10px] text-gray-300 mt-1">Место {desk.name}</div>
        </div>
      )}

      {canAssign && (
        <div className="mt-3 flex flex-col gap-1.5">
          <button
            onClick={onAssign}
            className="w-full py-1.5 text-xs bg-accent hover:bg-indigo-500 text-white rounded-md transition-colors"
          >
            Назначить сотрудника
          </button>
          {desk.assignment && (
            <button
              onClick={handleUnassign}
              disabled={busy}
              className="w-full py-1.5 text-xs text-red-500 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Снятие…' : 'Снять с места'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
