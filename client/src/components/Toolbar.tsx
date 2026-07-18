import { useEffect } from 'react';
import { useStore } from '../store';
import { ToolType } from '../types';

interface Tool {
  id: ToolType;
  label: string;
  icon: JSX.Element;
}

const tools: Tool[] = [
  {
    id: 'select',
    label: 'Выбрать / переместить (V)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 0L4 17.5L8.5 13L12 21L14.5 20L11 12L17 12Z" />
      </svg>
    ),
  },
  {
    id: 'room',
    label: 'Добавить комнату (R)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
      </svg>
    ),
  },
  {
    id: 'desk',
    label: 'Добавить стол (D)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="8" width="20" height="8" rx="2" />
        <line x1="8" y1="16" x2="8" y2="20" />
        <line x1="16" y1="16" x2="16" y2="20" />
        <circle cx="12" cy="6" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'meeting',
    label: 'Добавить переговорную (M)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="16" y1="3" x2="16" y2="7" />
      </svg>
    ),
  },
  {
    id: 'printer',
    label: 'Добавить принтер (P)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9V3h12v6" />
        <rect x="3" y="9" width="18" height="8" rx="1.5" />
        <rect x="6" y="14" width="12" height="7" />
        <circle cx="18" cy="12" r="0.5" fill="currentColor" />
      </svg>
    ),
  },
];

const HOTKEYS: Record<string, ToolType> = {
  KeyV: 'select',
  KeyR: 'room',
  KeyD: 'desk',
  KeyM: 'meeting',
  KeyP: 'printer',
};

export default function Toolbar() {
  const { state, dispatch } = useStore();

  // Горячие клавиши V/R/D/M/P (работают в любой раскладке).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const tool = HOTKEYS[e.code];
      if (tool) dispatch({ type: 'SET_TOOL', payload: tool });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <aside className="w-14 bg-sidebar border-r border-white/10 flex flex-col items-center pt-3 gap-1 shrink-0">
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => dispatch({ type: 'SET_TOOL', payload: t.id })}
          title={t.label}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
            state.tool === t.id
              ? 'bg-accent text-white'
              : 'text-white/50 hover:text-white hover:bg-white/10'
          }`}
        >
          {t.icon}
        </button>
      ))}

      <div className="flex-1" />

      <div className="mb-3 text-white/20 text-center">
        <div className="w-6 border-t border-white/10 mx-auto mb-2" />
        <span className="text-[9px] leading-3 block">
          {state.tool === 'select' ? 'SEL'
            : state.tool === 'room' ? 'ROOM'
            : state.tool === 'meeting' ? 'MEET'
            : state.tool === 'printer' ? 'PRNT'
            : 'DESK'}
        </span>
      </div>
    </aside>
  );
}
