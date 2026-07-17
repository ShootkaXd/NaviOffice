import { useState } from 'react';
import { useStore } from '../store';
import { uid } from '../utils';

export default function FloorSelector() {
  const { state, dispatch } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');

  function addFloor() {
    const id = 'floor-' + uid();
    dispatch({ type: 'ADD_FLOOR', payload: { id, name: `Floor ${state.floors.length + 1}` } });
  }

  function startEdit(id: string, name: string) {
    setEditing(id);
    setEditVal(name);
  }

  function commitEdit(id: string) {
    if (editVal.trim()) {
      dispatch({ type: 'RENAME_FLOOR', payload: { id, name: editVal.trim() } });
    }
    setEditing(null);
  }

  return (
    <div className="h-9 bg-sidebar border-t border-white/10 flex items-center px-2 gap-1 shrink-0 overflow-x-auto">
      {state.floors.map((floor) => (
        <button
          key={floor.id}
          onClick={() => dispatch({ type: 'SET_FLOOR', payload: floor.id })}
          onDoubleClick={() => startEdit(floor.id, floor.name)}
          className={`flex items-center h-6 px-3 rounded text-xs whitespace-nowrap transition-colors ${
            state.currentFloorId === floor.id
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
        </button>
      ))}
      <button
        onClick={addFloor}
        className="h-6 w-6 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors text-sm flex-shrink-0"
        title="Add floor"
      >
        +
      </button>
    </div>
  );
}
