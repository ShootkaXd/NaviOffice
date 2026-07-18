import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth';
import { getPresence, getTeam, setPresence } from '../api';
import { PresenceEntry, PresenceStatus, TeamMember } from '../types';
import { showToast } from '../utils';
import Avatar from './Avatar';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const STATUS_META: Record<PresenceStatus, { label: string; icon: string; cls: string }> = {
  office: { label: 'В офисе', icon: '🏢', cls: 'bg-indigo-50 text-indigo-700' },
  remote: { label: 'Удалённо', icon: '🏠', cls: 'bg-green-50 text-green-700' },
  dayoff: { label: 'Нерабочий', icon: '—', cls: 'bg-gray-100 text-gray-400' },
};
const CYCLE: (PresenceStatus | 'none')[] = ['office', 'remote', 'dayoff', 'none'];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Понедельник недели, содержащей дату. */
function mondayOf(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
}

export default function ScheduleView({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [busy, setBusy] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart]
  );
  const from = toISO(days[0]);
  const to = toISO(days[6]);
  const todayIso = toISO(new Date());

  const rows = useMemo(() => {
    const me = { login: user?.login ?? '', displayName: (user?.displayName ?? '') + ' (вы)', department: user?.department ?? null, title: user?.title ?? null };
    return [me, ...team.filter((t) => t.login !== user?.login)];
  }, [team, user]);

  async function load() {
    try {
      const t = await getTeam();
      setTeam(t);
      const logins = [user?.login ?? '', ...t.map((m) => m.login)];
      setEntries(await getPresence(logins, from, to));
    } catch {
      showToast('Не удалось загрузить расписание');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  function statusOf(login: string, date: string): PresenceStatus | undefined {
    return entries.find((e) => e.login.toLowerCase() === login.toLowerCase() && e.date === date)?.status;
  }

  /** Клик по ячейке циклически меняет статус. Себе — всегда; подчинённым — руководитель/секретарь/админ (сервер проверит). */
  async function cycleStatus(login: string, date: string) {
    if (busy) return;
    const current = statusOf(login, date);
    const next = CYCLE[(CYCLE.indexOf(current ?? 'none') + 1) % CYCLE.length];
    setBusy(true);
    try {
      await setPresence(date, next, login === user?.login ? undefined : login);
      const logins = [user?.login ?? '', ...team.map((m) => m.login)];
      setEntries(await getPresence(logins, from, to));
    } catch {
      showToast('Нет прав менять этот статус');
    } finally {
      setBusy(false);
    }
  }

  function shiftWeek(deltaDays: number) {
    setWeekStart((w) => {
      const d = new Date(w);
      d.setDate(d.getDate() + deltaDays);
      return d;
    });
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={onClose}>
      <div
        className="w-[860px] max-w-full max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Расписание посещений</h2>
            <p className="text-[11px] text-gray-400">
              {team.length > 0 ? 'Вы и ваши подчинённые. ' : ''}Клик по ячейке меняет статус: в офисе → удалённо → нерабочий → пусто.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => shiftWeek(-7)} className="w-7 h-7 rounded text-gray-400 hover:bg-gray-100">‹</button>
            <span className="text-xs text-gray-600 tabular-nums w-40 text-center">
              {from.slice(8, 10)}.{from.slice(5, 7)} — {to.slice(8, 10)}.{to.slice(5, 7)}.{to.slice(0, 4)}
            </span>
            <button onClick={() => shiftWeek(7)} className="w-7 h-7 rounded text-gray-400 hover:bg-gray-100">›</button>
            <button
              onClick={() => setWeekStart(mondayOf(new Date()))}
              className="ml-1 text-[11px] text-accent hover:underline"
            >
              Сегодня
            </button>
            <button onClick={onClose} className="ml-3 w-7 h-7 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100" title="Закрыть">×</button>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left font-medium px-4 py-2 w-56">Сотрудник</th>
                {days.map((d, i) => {
                  const iso = toISO(d);
                  return (
                    <th key={iso} className={`font-medium px-1 py-2 text-center ${iso === todayIso ? 'text-red-500' : ''}`}>
                      {WEEKDAYS[i]}<br />
                      <span className="text-sm">{String(d.getDate()).padStart(2, '0')}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.login} className="border-t border-gray-100">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Avatar login={m.login} name={m.displayName} size={28} />
                      <div className="min-w-0">
                        <div className="text-gray-800 font-medium truncate">{m.displayName}</div>
                        <div className="text-[10px] text-gray-400 truncate">{m.title ?? m.department ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  {days.map((d) => {
                    const iso = toISO(d);
                    const st = statusOf(m.login, iso);
                    const meta = st ? STATUS_META[st] : null;
                    return (
                      <td key={iso} className="px-1 py-1.5 text-center">
                        <button
                          onClick={() => cycleStatus(m.login, iso)}
                          disabled={busy}
                          title={meta?.label ?? 'Не указан'}
                          className={`w-full h-10 rounded-md flex flex-col items-center justify-center transition-colors ${
                            meta ? meta.cls : 'text-gray-200 hover:bg-gray-50'
                          } ${iso === todayIso ? 'ring-1 ring-red-200' : ''}`}
                        >
                          <span className="text-sm leading-4">{meta?.icon ?? '?'}</span>
                          {meta && <span className="text-[9px] leading-3">{meta.label}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
