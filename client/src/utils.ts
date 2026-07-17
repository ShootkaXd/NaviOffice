export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function snap(v: number, grid = 20) {
  return Math.round(v / grid) * grid;
}

export const DESK_RADIUS = 18;

export const ROOM_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6',
];

export const DESK_FREE_COLOR = '#22c55e';
export const DESK_OCCUPIED_COLOR = '#6366f1';
export const MEETING_COLOR = '#8b5cf6';

export function initials(displayName: string) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

/** Фамилия — первое слово из «Фамилия Имя Отчество». */
export function lastName(displayName: string) {
  return displayName.split(/\s+/).filter(Boolean)[0] ?? displayName;
}

export function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}
