import { DESK_FREE_COLOR, DESK_OCCUPIED_COLOR, MEETING_COLOR } from '../utils';

export default function Legend() {
  return (
    <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg shadow px-3 py-2 space-y-1.5 text-[11px] text-gray-600 pointer-events-none select-none">
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full border-2 flex-shrink-0"
          style={{ borderColor: DESK_FREE_COLOR, background: `${DESK_FREE_COLOR}22` }}
        />
        Свободно
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full border-2 flex-shrink-0"
          style={{ borderColor: DESK_OCCUPIED_COLOR, background: DESK_OCCUPIED_COLOR }}
        />
        Занято
      </div>
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded border-2 flex-shrink-0"
          style={{ borderColor: MEETING_COLOR, background: `${MEETING_COLOR}22` }}
        />
        Переговорная
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full border-2 border-dashed border-accent flex-shrink-0" />
        Выбранное место
      </div>
    </div>
  );
}
