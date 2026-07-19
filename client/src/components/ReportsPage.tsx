import { useEffect, useState } from 'react';
import { getReportsSummary, ReportsSummary } from '../api';

const PERIODS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
];

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function StatCard({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="text-2xl font-semibold text-gray-900 tabular-nums">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-300 mt-0.5">{sub}</div>}
    </div>
  );
}

/** Столбиковая диаграмма с накоплением: в офисе / удалённо / нерабочий по дням. */
function PresenceChart({ data, teamSize }: { data: ReportsSummary['teamPresence']; teamSize: number }) {
  const max = Math.max(teamSize, ...data.map((d) => d.office + d.remote + d.dayOff), 1);
  const H = 160;
  const BW = Math.min(28, Math.max(8, Math.floor(560 / data.length) - 4));
  return (
    <div className="overflow-x-auto">
      <svg width={data.length * (BW + 4) + 30} height={H + 30} role="img" aria-label="Посещаемость команды по дням">
        {data.map((d, i) => {
          const x = 30 + i * (BW + 4);
          const hOffice = (d.office / max) * H;
          const hRemote = (d.remote / max) * H;
          const hOff = (d.dayOff / max) * H;
          let y = H;
          const bars = [
            { h: hOffice, color: '#6366f1', label: 'офис' },
            { h: hRemote, color: '#22c55e', label: 'удалённо' },
            { h: hOff, color: '#d1d5db', label: 'нерабочий' },
          ];
          return (
            <g key={d.date}>
              <title>{`${d.date.slice(8, 10)}.${d.date.slice(5, 7)}: офис ${d.office}, удалённо ${d.remote}, нерабочих ${d.dayOff}`}</title>
              {bars.map((b, j) => {
                y -= b.h;
                return b.h > 0 ? <rect key={j} x={x} y={y} width={BW} height={b.h} fill={b.color} rx={1.5} /> : null;
              })}
              {(data.length <= 14 || i % 5 === 0) && (
                <text x={x + BW / 2} y={H + 12} textAnchor="middle" fontSize={8} fill="#9ca3af">
                  {d.date.slice(8, 10)}.{d.date.slice(5, 7)}
                </text>
              )}
            </g>
          );
        })}
        {[0, Math.ceil(max / 2), max].map((v) => (
          <text key={v} x={24} y={H - (v / max) * H + 3} textAnchor="end" fontSize={8} fill="#9ca3af">{v}</text>
        ))}
      </svg>
      <div className="flex gap-4 mt-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#6366f1' }} /> В офисе</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#22c55e' }} /> Удалённо</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#d1d5db' }} /> Нерабочий</span>
      </div>
    </div>
  );
}

/** Брони переговорных по дням. */
function BookingsChart({ data }: { data: ReportsSummary['bookingsPerDay'] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const H = 120;
  const BW = Math.min(28, Math.max(8, Math.floor(560 / data.length) - 4));
  return (
    <svg width={data.length * (BW + 4) + 30} height={H + 30} role="img" aria-label="Брони переговорных по дням">
      {data.map((d, i) => {
        const x = 30 + i * (BW + 4);
        const h = (d.count / max) * H;
        return (
          <g key={d.date}>
            <title>{`${d.date.slice(8, 10)}.${d.date.slice(5, 7)}: ${d.count} броней`}</title>
            <rect x={x} y={H - h} width={BW} height={Math.max(h, d.count > 0 ? 2 : 0)} fill="#8b5cf6" rx={1.5} />
            {(data.length <= 14 || i % 5 === 0) && (
              <text x={x + BW / 2} y={H + 12} textAnchor="middle" fontSize={8} fill="#9ca3af">
                {d.date.slice(8, 10)}.{d.date.slice(5, 7)}
              </text>
            )}
          </g>
        );
      })}
      {[0, max].map((v) => (
        <text key={v} x={24} y={H - (v / max) * H + 3} textAnchor="end" fontSize={8} fill="#9ca3af">{v}</text>
      ))}
    </svg>
  );
}

export default function ReportsPage() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    setData(null);
    setError(false);
    getReportsSummary(iso(from), iso(to))
      .then(setData)
      .catch(() => setError(true));
  }, [days]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Отчёты</h1>
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  days === p.days ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="text-sm text-red-500">Не удалось загрузить отчёт</div>}
        {!data && !error && <div className="text-sm text-gray-400">Загрузка…</div>}

        {data && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard value={data.desksTotal} label="Мест всего" />
              <StatCard
                value={data.desksOccupied}
                label="Мест занято"
                sub={data.desksTotal > 0 ? `${Math.round((data.desksOccupied / data.desksTotal) * 100)}% рассажено` : undefined}
              />
              <StatCard value={data.meetingRoomsTotal} label="Переговорных" />
              <StatCard value={data.bookingsInPeriod} label="Броней за период" />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-1">Посещаемость команды</h2>
              <p className="text-[11px] text-gray-400 mb-3">
                Вы и ваши прямые подчинённые ({data.teamSize} чел.). Данные из графика посещений; чужие команды не видны.
              </p>
              <PresenceChart data={data.teamPresence} teamSize={data.teamSize} />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-800 mb-3">Брони переговорных по дням</h2>
              <BookingsChart data={data.bookingsPerDay} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
