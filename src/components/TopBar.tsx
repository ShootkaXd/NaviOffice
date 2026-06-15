import { useStore } from '../store';
import { AppState } from '../types';

const SAVE_KEY = 'navioffice_map';

export default function TopBar() {
  const { state, dispatch } = useStore();

  function handleSave() {
    const data: Partial<AppState> = {
      floors: state.floors,
      currentFloorId: state.currentFloorId,
      elements: state.elements,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    showToast('Map saved!');
  }

  function handleLoad() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return showToast('No saved map found');
    try {
      const data = JSON.parse(raw) as Partial<AppState>;
      dispatch({ type: 'LOAD_STATE', payload: data });
      showToast('Map loaded!');
    } catch {
      showToast('Failed to load map');
    }
  }

  function handleClear() {
    if (!confirm('Clear all elements on all floors?')) return;
    dispatch({ type: 'LOAD_STATE', payload: { elements: [], selectedId: null } });
  }

  function showToast(msg: string) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }

  return (
    <header className="h-12 bg-sidebar border-b border-white/10 flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-accent">
          <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.9"/>
          <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.6"/>
          <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.6"/>
          <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" opacity="0.3"/>
        </svg>
        <span className="text-white font-semibold text-sm tracking-wide">NaviOffice</span>
      </div>
      <div className="flex-1" />
      <button
        onClick={handleSave}
        className="px-3 py-1 text-xs bg-accent hover:bg-indigo-500 text-white rounded-md transition-colors"
      >
        Save
      </button>
      <button
        onClick={handleLoad}
        className="px-3 py-1 text-xs bg-sidebar-light hover:bg-white/10 text-white/80 rounded-md transition-colors border border-white/10"
      >
        Load
      </button>
      <button
        onClick={handleClear}
        className="px-3 py-1 text-xs bg-sidebar-light hover:bg-red-500/20 text-red-400 rounded-md transition-colors border border-white/10"
      >
        Clear
      </button>
    </header>
  );
}
