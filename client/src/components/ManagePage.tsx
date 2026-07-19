import { useState } from 'react';
import ScheduleView from './ScheduleView';
import ReportsPage from './ReportsPage';

/** Вкладка «Управление» для руководителей: расписание команды и отчёты. */
export default function ManagePage() {
  const [tab, setTab] = useState<'schedule' | 'reports'>('schedule');

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <div className="px-6 pt-4 flex gap-1">
        {([
          ['schedule', 'Расписание'],
          ['reports', 'Отчёты'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 text-xs rounded-t-lg border border-b-0 transition-colors ${
              tab === key
                ? 'bg-white border-gray-200 text-gray-900 font-medium'
                : 'bg-gray-100 border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'schedule' ? (
        <div className="flex-1 overflow-y-auto p-6 pt-0">
          <div className="max-w-4xl mx-auto">
            <ScheduleView inline />
          </div>
        </div>
      ) : (
        <ReportsPage />
      )}
    </div>
  );
}
