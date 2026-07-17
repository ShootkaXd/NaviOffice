import { useState } from 'react';
import { useStore, refreshMap } from '../store';
import { useAuth } from '../auth';
import { createFloor, updateFloor, deleteFloor } from '../api';
import { showToast } from '../utils';

export default function FloorSelector() {
  const { state, dispatch } = useStore();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [busy, setBusy] = useState(false);

  const floors = [...state.floors].sort((a, b) => a.order - b.order);

  async function addFloor() {
    if (busy) return;
    setBusy(true);
    try {
      const floor = await createFloor(`Этаж ${state.floors.length + 1}`);
      await refreshMap(dispatch);
      dispatch({ type: 'SET_FLOOR', payload: floor.id });
    } catch {
      showToast('Не удалось создать этаж');
    } finally {
      setBusy(false);
    }
  }

  async function removeFloor(id: string, name: string) {
    if (busy) return;
    if (!confirm(`Удалить этаж «${name}» со всеми комнатами и столами?`)) return;
    setBusy(true);
    try {
      await deleteFloor(id);
      await refreshMap(dispatch);
    } catch {
      showToast('Не удалось удалить этаж');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(id: string, name: string) {
    if (!isAdmin) return;
    setEditing(id);
    setEditVal(name);
  }

  async function commitEdit(id: string) {
    const floor = state.floors.find((f) => f.id === id);
    const name = editVal.trim();
    setEditing(null);
    if (!floor || !name || name === floor.name) return;
    try {
      await updateFloor(id, name, floor.order);
      await refreshMap(dispatch);
    } catch {
      showToast('Не удалось переименовать этаж');
    }
  }

  return (
    <div className="h-9 bg-sidebar border-t border-white/10 flex items-center px-2 gap-1 shrink-0 overflow-x-auto">
      {floors.map((floor) => {
        const active = state.currentFloorId === floor.id;
        return (
          <div
            key={floor.id}
            onClick={() => dispatch({ type: 'SET_FLOOR', payload: floor.id })}
            onDoubleClick={() => startEdit(floor.id, floor.name)}
            className={`flex items-center h-6 px-3 rounded text-xs whitespace-nowrap transition-colors cursor-pointer ${
              active
                ? 'bg-accent text-white'
                : 'text-white/50 hover:text-white hover:bg-white/10'
            }`}
          >
            {editing === floor.id ? (
              <input
                autoFocus
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                onBlur={() => commitEdit(floor.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(floor.id);
                  if (e.key === 'Escape') setEditing(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent outline-none w-20 text-white"
              />
            ) : (
              floor.name
            )}
            {isAdmin && active && editing !== floor.id && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeFloor(floor.id, floor.name);
                }}
                title="Удалить этаж"
                className="ml-2 -mr-1 w-4 h-4 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/20"
              >
                ×
              </span>
            )}
          </div>
        );
      })}
      {floors.length === 0 && (
        <span className="text-white/30 text-xs px-2">Нет этажей</span>
      )}
      {isAdmin && (
        <button
          onClick={addFloor}
          disabled={busy}
          className="h-6 w-6 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors text-sm flex-shrink-0 disabled:opacity-50"
          title="Добавить этаж"
        >
          +
        </button>
      )}
    </div>
  );
}
