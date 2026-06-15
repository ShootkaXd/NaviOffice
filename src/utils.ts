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

export const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  booked: '#f97316',
  unavailable: '#ef4444',
};
