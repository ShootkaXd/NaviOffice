import { useEffect, useState } from 'react';
import { Desk, Employee } from '../types';
import { useStore, refreshMap } from '../store';
import { assignDesk, searchEmployees } from '../api';
import { showToast } from '../utils';
import Avatar from './Avatar';

interface AssignDialogProps {
  desk: Desk;
  onClose: () => void;
}

export default function AssignDialog({ desk, onClose }: AssignDialogProps) {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      searchEmployees(query.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function deskName(deskId: string) {
    const d = state.elements.find((el) => el.type === 'desk' && el.id === deskId);
    return d ? d.name : deskId;
  }

  async function handleAssign(emp: Employee) {
    if (busy) return;
    setBusy(true);
    try {
      await assignDesk(desk.id, emp.login);
      await refreshMap(dispatch);
      showToast(`${emp.displayName} — место ${desk.name}`);
      onClose();
    } catch {
      showToast('Не удалось назначить сотрудника');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl flex flex-col max-h-[70vh]">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Назначить сотрудника — место {desk.name}
          </h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="px-4 pb-2">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск сотрудника…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex-1 overflow-y-auto border-t border-gray-100 min-h-[8rem]">
          {loading ? (
            <div className="px-4 py-4 text-xs text-gray-400">Поиск…</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-xs text-gray-400">Никого не найдено</div>
          ) : (
            results.map((emp) => {
              const current = emp.login === desk.assignment?.login;
              const seated = !!emp.deskId && emp.deskId !== desk.id;
              return (
                <button
                  key={emp.login}
                  onClick={() => !current && handleAssign(emp)}
                  disabled={busy || current}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 disabled:hover:bg-transparent text-left transition-colors"
                >
                  <Avatar login={emp.login} name={emp.displayName} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-900 font-medium truncate">{emp.displayName}</div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {emp.department}
                      {emp.title ? ` · ${emp.title}` : ''}
                    </div>
                    {current ? (
                      <div className="text-[10px] text-gray-300 mt-0.5">уже на этом месте</div>
                    ) : seated ? (
                      <div className="text-[10px] text-amber-600 mt-0.5">
                        уже сидит на месте {deskName(emp.deskId!)} — будет пересажен
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
