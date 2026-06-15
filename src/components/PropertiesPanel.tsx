import { useStore } from '../store';
import { Room, Desk, DeskStatus, MapElement } from '../types';
import { ROOM_COLORS, STATUS_COLORS } from '../utils';

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
      <aside className="w-56 bg-sidebar border-l border-white/10 flex flex-col p-4 shrink-0">
        <h2 className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-4">Properties</h2>
        <p className="text-white/20 text-xs mt-2">Select an element on the canvas to edit its properties.</p>

        <div className="flex-1" />

        <div className="text-white/10 text-[10px] space-y-1">
          <div>Select tool: click element</div>
          <div>Room tool: drag to draw</div>
          <div>Desk tool: click to place</div>
          <div>Delete: Del key or button</div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-56 bg-sidebar border-l border-white/10 flex flex-col p-4 shrink-0 overflow-y-auto">
      <h2 className="text-white/30 text-xs font-semibold uppercase tracking-widest mb-4">Properties</h2>

      <div className="mb-2">
        <span className="text-white/40 text-[10px] uppercase tracking-widest">
          {selected.type === 'room' ? 'Room' : 'Desk'}
        </span>
      </div>

      {/* Name */}
      <label className="block mb-3">
        <span className="text-white/50 text-xs block mb-1">Name</span>
        <input
          type="text"
          value={selected.name}
          onChange={(e) => update({ name: e.target.value })}
          className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:border-accent"
        />
      </label>

      {/* Position */}
      <label className="block mb-1">
        <span className="text-white/50 text-xs block mb-1">Position</span>
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

      <div className="mt-auto pt-4">
        <button
          onClick={handleDelete}
          className="w-full py-1.5 text-xs text-red-400 border border-red-400/30 rounded-md hover:bg-red-500/10 transition-colors"
        >
          Delete element
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
          <span className="text-white/30 text-[10px]">W</span>
          <input
            type="number"
            value={Math.round(room.width)}
            onChange={(e) => update({ width: Math.max(40, Number(e.target.value)) })}
            className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
          />
        </label>
        <label className="flex-1">
          <span className="text-white/30 text-[10px]">H</span>
          <input
            type="number"
            value={Math.round(room.height)}
            onChange={(e) => update({ height: Math.max(40, Number(e.target.value)) })}
            className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-xs focus:outline-none focus:border-accent"
          />
        </label>
      </div>

      <label className="block mb-3">
        <span className="text-white/50 text-xs block mb-1">Capacity</span>
        <input
          type="number"
          min="1"
          value={room.capacity}
          onChange={(e) => update({ capacity: Math.max(1, Number(e.target.value)) })}
          className="w-full bg-sidebar-light border border-white/10 rounded-md px-2 py-1 text-white text-sm focus:outline-none focus:border-accent"
        />
      </label>

      <label className="block mb-3">
        <span className="text-white/50 text-xs block mb-2">Color</span>
        <div className="flex flex-wrap gap-1.5">
          {ROOM_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => update({ color: c })}
              style={{ background: c }}
              className={`w-6 h-6 rounded-full transition-all ${room.color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-sidebar scale-110' : 'hover:scale-110'}`}
            />
          ))}
        </div>
      </label>
    </>
  );
}

function DeskProps({ desk, update }: { desk: Desk; update: (p: Partial<Desk>) => void }) {
  const statuses: DeskStatus[] = ['available', 'booked', 'unavailable'];
  return (
    <label className="block mt-2 mb-3">
      <span className="text-white/50 text-xs block mb-2">Status</span>
      <div className="flex flex-col gap-1.5">
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => update({ status: s })}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
              desk.status === s ? 'bg-white/10 text-white' : 'text-white/40 hover:bg-white/5'
            }`}
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: STATUS_COLORS[s] }}
            />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>
    </label>
  );
}
