import { useRef, useState } from 'react';
import { useStore, refreshMap } from '../store';
import { Room, Desk, MapElement, Marker, MeetingRoom } from '../types';
import { ROOM_COLORS, showToast } from '../utils';
import { ApiError, deleteFloorBackground, uploadFloorBackground } from '../api';

/** Палитра + произвольный цвет (input type=color). */
function ColorField({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <label className="block mb-3">
      <span className="text-white/50 text-xs block mb-2">Цвет</span>
      <div className="flex flex-wrap gap-1.5 items-center">
        {ROOM_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className={`w-6 h-6 rounded-full transition-all ${value === c ? 'ring-2 ring-white ring-offset-1 ring-offset-sidebar scale-110' : 'hover:scale-110'}`}
          />
        ))}
        {/* Произвольный цвет */}
        <span
          className={`relative w-6 h-6 rounded-full overflow-hidden border border-white/30 cursor-pointer transition-all hover:scale-110 ${!ROOM_COLORS.includes(value) ? 'ring-2 ring-white ring-offset-1 ring-offset-sidebar scale-110' : ''}`}
          style={{ background: !ROOM_COLORS.includes(value) ? value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
          title="Свой цвет"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </span>
      </div>
      <div className="flex items-center gap-1.5 mt-2">
        <span className="w-4 h-4 rounded flex-shrink-0" style={{ background: value }} />
        <input
          type="text"
          key={value}
          defaultValue={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
          }}
          className="w-20 bg-sidebar-light border border-white/10 rounded px-1.5 py-0.5 text-white/70 text-[11px] font-mono focus:outline-none focus:border-accent"
        />
      </div>
    </label>
  );
}

/** Загрузка/удаление плана этажа (подложки). Только для Admin — панель видна только ему. */
function FloorBackgroundSection() {
  const { state, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const floor = state.floors.find((f) => f.id === state.currentFloorId);

  if (!floor) return null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !floor) return;
    setBusy(true);
    try {
      await uploadFloorBackground(floor.id, file);
      await refreshMap(dispatch);
      showToast('План этажа загружен');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Не удалось загрузить план');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    if (!floor || busy) return;
    setBusy(true);
    try {
      await deleteFloorBackground(floor.id);
      await refreshMap(dispatch);
      showToast('План этажа убран');
    } catch {
      showToast('Не удалось убрать план');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-white/10">
      <span className="text-white/40 text-[10px] uppercase tracking-widest block mb-2">План этажа</span>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="w-full py-1.5 text-xs bg-sidebar-light hover:bg-white/10 text-white/80 rounded-md border border-white/10 disabled:opacity-50 transition-colors"
      >
        {busy ? 'Загрузка…' : floor.hasBackground ? 'Заменить план…' : 'Загрузить план…'}
      </button>
      {floor.hasBackground && (
        <button
          onClick={handleRemove}
          disabled={busy}
          className="w-full mt-1.5 py-1.5 text-xs text-red-400 border border-red-400/30 rounded-md hover:bg-red-500/10 disabled:opacity-50 transition-colors"
        >
          Убрать план
        </button>
      )}
      <p className="text-white/20 text-[10px] mt-1.5">PNG, JPEG или SVG до 10 МБ. Подложка рисуется под сеткой.</p>
    </div>
  );
}

export default function PropertiesPanel() {
  const { state, dispatch } = useStore();

  const selected = state.elements.find((el) => el.id === state.selectedId);

  function update(patch: Partial<MapElement>) {
    if (!selected) return;
    dispatch({ type: 'UPDATE_ELEMENT', payload: { ...selected, ...patch } as MapElement });
  }

  function handleDelete() {
    if (!selected) return;
    dispatch({ type: 'DELETE_ELEMENT', payload: selected.id });
  }

  if (!selected) {
    return (
      <aside className="w-56 bg-sidebar border-l border-white/10 flex flex-col p-4 shrink-0 overflow-y-auto">
        <h2 className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-4">Свойства</h2>
        <p className="text-white/20 text-xs mt-2">Выберите элемент на карте, чтобы изменить его свойства.</p>

        <FloorBackgroundSection />

        <div className="flex-1" />

        <div className="text-white/10 text-[10px] space-y-1">
          <div>Выбор: клик по элементу</div>
          <div>Комната: нарисовать мышью</div>
          <div>Стол: клик по карте</div>
          <div>Переговорная: нарисовать мышью</div>
          <div>Удалить: Del или кнопка</div>
          <div>Сохранить: кнопка сверху</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-56 bg-sidebar border-l border-white/10 flex flex-col p-4 shrink-0 overflow-y-auto">
      <h2 className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-4">Свойства</h2>

      <div className="mb-2">
        <span className="text-white/40 text-[10px] uppercase tracking-widest">
          {selected.type === 'room' ? 'Комната'
            : selected.type === 'meeting' ? 'Переговорная'
            : selected.type === 'marker' ? 'Принтер'
            : 'Стол'}
        </span>
      </div>

      {/* Name / Label */}
      <label className="block mb-3">
        <span className="text-white/50 text-xs block mb-1">
          {selected.type === 'marker' ? 'Подпись' : 'Название'}
        </span>
        <input
          type="text"
          value={selected.type === 'marker' ? (selected as Marker).label : selected.name}
          onChange={(e) =>
            selected.type === 'marker'
              ? update({ label: e.target.value } as Partial<MapElement>)
              : update({ name: e.target.value } as Partial<MapElement>)
          }
          className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:border-accent"
        />
      </label>

      {/* Position */}
      <label className="block mb-1">
        <span className="text-white/50 text-xs block mb-1">Позиция</span>
        <div className="flex gap-2">
          <div className="flex-1">
            <span className="text-white/30 text-[10px]">X</span>
            <input
              type="number"
              value={Math.round(selected.x)}
              onChange={(e) => update({ x: Number(e.target.value) })}
              className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <span className="text-white/30 text-[10px]">Y</span>
            <input
              type="number"
              value={Math.round(selected.y)}
              onChange={(e) => update({ y: Number(e.target.value) })}
              className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </label>

      {selected.type === 'room' && <RoomProps room={selected as Room} update={update} />}
      {selected.type === 'desk' && <DeskProps desk={selected as Desk} update={update} />}
      {selected.type === 'meeting' && <MeetingProps room={selected as MeetingRoom} update={update} />}

      <div className="mt-auto pt-4">
        <button
          onClick={handleDelete}
          className="w-full py-1.5 text-xs text-red-400 border border-red-400/30 rounded-md hover:bg-red-500/10 transition-colors"
        >
          Удалить элемент
        </button>
      </div>
    </aside>
  );
}

function RoomProps({ room, update }: { room: Room; update: (p: Partial<Room>) => void }) {
  return (
    <>
      <div className="flex gap-2 mb-3 mt-2">
        <label className="flex-1">
          <span className="text-white/30 text-[10px]">Ширина</span>
          <input
            type="number"
            value={Math.round(room.width)}
            onChange={(e) => update({ width: Math.max(40, Number(e.target.value)) })}
            className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex-1">
          <span className="text-white/30 text-[10px]">Высота</span>
          <input
            type="number"
            value={Math.round(room.height)}
            onChange={(e) => update({ height: Math.max(40, Number(e.target.value)) })}
            className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
          />
        </label>
      </div>

      <label className="block mb-3">
        <span className="text-white/50 text-xs block mb-1">Вместимость</span>
        <input
          type="number"
          min="1"
          value={room.capacity}
          onChange={(e) => update({ capacity: Math.max(1, Number(e.target.value)) })}
          className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:border-accent"
        />
      </label>

      <ColorField value={room.color} onChange={(color) => update({ color })} />

      {room.points && (
        <div className="mb-3">
          <span className="text-white/50 text-xs block mb-1">Форма: полигон ({room.points.length} вершин)</span>
          <button
            onClick={() => update({ points: null })}
            className="w-full py-1 text-xs text-white/60 border border-white/10 rounded-md hover:bg-white/5 transition-colors"
          >
            Сделать прямоугольной
          </button>
          <p className="text-white/20 text-[10px] mt-1">
            Тяните круглые точки на рёбрах, чтобы добавить углы; двойной клик по вершине удаляет её.
          </p>
        </div>
      )}
    </>
  );
}

function MeetingProps({ room, update }: { room: MeetingRoom; update: (p: Partial<MeetingRoom>) => void }) {
  return (
    <>
      <div className="flex gap-2 mb-3 mt-2">
        <label className="flex-1">
          <span className="text-white/30 text-[10px]">Ширина</span>
          <input
            type="number"
            value={Math.round(room.width)}
            onChange={(e) => update({ width: Math.max(40, Number(e.target.value)) })}
            className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex-1">
          <span className="text-white/30 text-[10px]">Высота</span>
          <input
            type="number"
            value={Math.round(room.height)}
            onChange={(e) => update({ height: Math.max(40, Number(e.target.value)) })}
            className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
          />
        </label>
      </div>

      <label className="block mb-3">
        <span className="text-white/50 text-xs block mb-1">Email переговорной</span>
        <input
          type="email"
          value={room.email ?? ''}
          onChange={(e) => update({ email: e.target.value.trim() || null })}
          placeholder="room-a@company.ru"
          className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:border-accent"
        />
        <span className="text-white/20 text-[10px] block mt-1">
          Почта room mailbox из Exchange — нужна для бронирования через Outlook.
        </span>
      </label>

      <label className="block mb-3">
        <span className="text-white/50 text-xs block mb-1">Вместимость</span>
        <input
          type="number"
          min="1"
          value={room.capacity}
          onChange={(e) => update({ capacity: Math.max(1, Number(e.target.value)) })}
          className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:border-accent"
        />
      </label>

      <ColorField value={room.color} onChange={(color) => update({ color })} />
    </>
  );
}

function DeskProps({ desk, update }: { desk: Desk; update: (p: Partial<Desk>) => void }) {
  return (
    <>
      <label className="block mt-2 mb-3">
        <span className="text-white/50 text-xs block mb-1">Поворот, °</span>
        <input
          type="number"
          step="15"
          value={Math.round(desk.rotation)}
          onChange={(e) => update({ rotation: Number(e.target.value) })}
          className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:border-accent"
        />
      </label>

      <ColorField value={desk.color ?? '#22c55e'} onChange={(color) => update({ color })} />

      <div className="mb-3">
        <span className="text-white/50 text-xs block mb-1">Сотрудники</span>
        {desk.assignments.length > 0 ? (
          <div className="space-y-1">
            {desk.assignments.map((a) => (
              <div key={a.login} className="bg-sidebar-light border border-white/10 rounded-md px-2 py-1.5">
                <div className="text-white text-xs">{a.displayName}</div>
                <div className="text-white/40 text-[10px]">{a.department}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-white/30 text-xs px-1">Место свободно</div>
        )}
        <p className="text-white/20 text-[10px] mt-1.5">
          Назначение — через карточку места на карте (до двух сотрудников).
        </p>
      </div>
    </>
  );
}
