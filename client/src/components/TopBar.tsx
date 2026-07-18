import { useEffect, useRef, useState } from 'react';
import { useStore, refreshMap } from '../store';
import ScheduleView from './ScheduleView';
import { createOffice } from '../api';
import { useAuth } from '../auth';
import { searchEmployees, saveFloorElements } from '../api';
import { Desk, Employee, Role } from '../types';
import { showToast } from '../utils';
import Avatar from './Avatar';

const ROLE_LABELS: Record<Role, string> = {
  Admin: 'Администратор',
  Secretary: 'Секретарь',
  User: 'Просмотр',
};

const ROLE_BADGE: Record<Role, string> = {
  Admin: 'bg-accent/20 text-indigo-300 border-accent/40',
  Secretary: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
  User: 'bg-white/10 text-white/50 border-white/20',
};

function EmployeeSearch() {
  const { state, dispatch } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(() => {
      searchEmployees(query.trim())
        .then((r) => {
          setResults(r);
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function deskById(deskId: string | null | undefined): Desk | undefined {
    if (!deskId) return undefined;
    return state.elements.find((el) => el.type === 'desk' && el.id === deskId) as Desk | undefined;
  }

  function selectEmployee(emp: Employee) {
    const desk = deskById(emp.deskId);
    setOpen(false);
    setQuery('');
    if (!desk) return;
    dispatch({ type: 'SET_FLOOR', payload: desk.floorId });
    dispatch({ type: 'SELECT', payload: desk.id });
    dispatch({ type: 'FOCUS_DESK', payload: desk.id });
  }

  return (
    <div ref={boxRef} className="relative w-72">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Поиск сотрудника…"
        className="w-full bg-sidebar-light border border-white/10 rounded-md pl-8 pr-3 py-1.5 text-white text-xs placeholder-white/30 focus:outline-none focus:border-accent"
      />
      {open && (
        <div className="absolute top-full mt-1.5 w-full bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden z-40 max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-400">Никого не найдено</div>
          ) : (
            results.map((emp) => {
              const desk = deskById(emp.deskId);
              return (
                <button
                  key={emp.login}
                  onClick={() => selectEmployee(emp)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                >
                  <Avatar login={emp.login} name={emp.displayName} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-900 font-medium truncate">{emp.displayName}</div>
                    <div className="text-[10px] text-gray-400 truncate">{emp.department}</div>
                  </div>
                  {desk ? (
                    <span className="text-[10px] text-accent whitespace-nowrap">место {desk.name}</span>
                  ) : (
                    <span className="text-[10px] text-gray-300 whitespace-nowrap">без места</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function OfficeSelect() {
  const { state, dispatch } = useStore();
  const { user } = useAuth();

  async function handleChange(value: string) {
    if (value === '__new__') {
      const name = prompt('Название нового офиса:');
      if (name?.trim()) {
        try {
          const office = await createOffice(name.trim());
          await refreshMap(dispatch);
          dispatch({ type: 'SET_OFFICE', payload: office.id });
        } catch {
          showToast('Не удалось создать офис');
        }
      }
      return;
    }
    dispatch({ type: 'SET_OFFICE', payload: value });
  }

  if (state.offices.length === 0) return null;
  return (
    <select
      value={state.currentOfficeId}
      onChange={(e) => handleChange(e.target.value)}
      className="bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white/90 text-xs focus:outline-none focus:border-accent max-w-44"
      title="Офис"
    >
      {state.offices.map((o) => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
      {user?.role === 'Admin' && <option value="__new__">+ Новый офис…</option>}
    </select>
  );
}

export default function TopBar() {
  const { state, dispatch } = useStore();
  const { user, logout } = useAuth();
  const [showSchedule, setShowSchedule] = useState(false);

  // Ctrl/Cmd+S — сохранить карту (для администратора).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (user?.role === 'Admin') handleSave();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, state.currentFloorId, state.elements]);
  const [saving, setSaving] = useState(false);
  const isAdmin = user?.role === 'Admin';

  async function handleSave() {
    if (!state.currentFloorId || saving) return;
    setSaving(true);
    try {
      const els = state.elements.filter((el) => el.floorId === state.currentFloorId);
      await saveFloorElements(state.currentFloorId, els);
      await refreshMap(dispatch);
      showToast('Этаж сохранён');
    } catch {
      showToast('Не удалось сохранить этаж');
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="h-12 bg-sidebar border-b border-white/10 flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-accent">
          <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.9" />
          <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.6" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.6" />
          <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.3" />
        </svg>
        <span className="text-white font-semibold text-sm tracking-wide">NaviOffice</span>
      </div>

      <div className="flex-1 flex justify-center">
        <OfficeSelect />
        <EmployeeSearch />
        <button
          onClick={() => setShowSchedule(true)}
          className="px-3 py-1 text-xs bg-sidebar-light hover:bg-white/10 text-white/80 rounded-md transition-colors border border-white/10 whitespace-nowrap"
          title="График посещения офиса"
        >
          Расписание
        </button>
      </div>

      {isAdmin && (
        <button
          onClick={handleSave}
          disabled={saving || !state.currentFloorId}
          className="px-3 py-1 text-xs bg-accent hover:bg-indigo-500 disabled:opacity-50 text-white rounded-md transition-colors"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
          {state.dirty && !saving && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-300 ml-1.5 align-middle" title="Есть несохранённые изменения" />
          )}
        </button>
      )}

      {user && (
        <div className="flex items-center gap-2.5">
          <Avatar login={user.login} name={user.displayName} size={26} />
          <div className="hidden sm:block leading-tight text-right">
            <div className="text-white/80 text-xs">{user.displayName}</div>
          </div>
          <span className={`px-2 py-0.5 text-[10px] rounded-full border ${ROLE_BADGE[user.role]}`}>
            {ROLE_LABELS[user.role]}
          </span>
          <button
            onClick={logout}
            className="px-3 py-1 text-xs bg-sidebar-light hover:bg-white/10 text-white/70 rounded-md transition-colors border border-white/10"
          >
            Выйти
          </button>
        </div>
      )}
      {showSchedule && <ScheduleView onClose={() => setShowSchedule(false)} />}
    </header>
  );
}
