import { Desk, DeskAssignment, Employee, Floor, MapElement, Room, User } from './types';

const TOKEN_KEY = 'navioffice_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Событие, по которому AuthProvider сбрасывает пользователя и показывает логин. */
export const UNAUTHORIZED_EVENT = 'navioffice:unauthorized';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    // 401 на логине (нет токена) — просто ошибка; 401 с токеном — сессия истекла.
    if (token) {
      clearToken();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(401, 'Unauthorized');
  }
  if (!res.ok) {
    throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------- Auth ----------

export interface LoginResponse {
  token: string;
  user: User;
}

export function login(username: string, password: string): Promise<LoginResponse> {
  return request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export function getMe(): Promise<User> {
  return request('/api/auth/me');
}

// ---------- Employees ----------

export function searchEmployees(search: string): Promise<Employee[]> {
  return request(`/api/employees?search=${encodeURIComponent(search)}`);
}

// Фото отдаётся защищённым эндпоинтом — качаем с токеном и кэшируем object URL.
const photoCache = new Map<string, Promise<string | null>>();

export function fetchPhoto(login: string): Promise<string | null> {
  let cached = photoCache.get(login);
  if (!cached) {
    cached = (async () => {
      const token = getToken();
      const res = await fetch(`/api/employees/${encodeURIComponent(login)}/photo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    })().catch(() => null);
    photoCache.set(login, cached);
  }
  return cached;
}

// ---------- Map ----------

interface RoomDto {
  id: string;
  floorId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  color: string;
  capacity: number;
}

interface DeskDto {
  id: string;
  floorId: string;
  x: number;
  y: number;
  name: string;
  rotation: number;
  assignment: DeskAssignment | null;
}

interface MapDto {
  floors: Floor[];
  rooms: RoomDto[];
  desks: DeskDto[];
}

export interface MapData {
  floors: Floor[];
  elements: MapElement[];
}

export async function getMap(): Promise<MapData> {
  const dto = await request<MapDto>('/api/map');
  const rooms: Room[] = dto.rooms.map((r) => ({ ...r, type: 'room' }));
  const desks: Desk[] = dto.desks.map((d) => ({
    ...d,
    rotation: d.rotation ?? 0,
    assignment: d.assignment ?? null,
    type: 'desk',
  }));
  return { floors: dto.floors, elements: [...rooms, ...desks] };
}

// ---------- Floors ----------

export function createFloor(name: string): Promise<Floor> {
  return request('/api/floors', { method: 'POST', body: JSON.stringify({ name }) });
}

export function updateFloor(id: string, name: string, order: number): Promise<void> {
  return request(`/api/floors/${id}`, { method: 'PUT', body: JSON.stringify({ name, order }) });
}

export function deleteFloor(id: string): Promise<void> {
  return request(`/api/floors/${id}`, { method: 'DELETE' });
}

/** id, созданные на клиенте до сохранения — сервер выдаст свои. */
export function isClientId(id: string) {
  return id.startsWith('tmp-');
}

export function saveFloorElements(floorId: string, elements: MapElement[]): Promise<void> {
  const rooms = elements
    .filter((el): el is Room => el.type === 'room')
    .map((r) => ({
      ...(isClientId(r.id) ? {} : { id: r.id }),
      x: r.x,
      y: r.y,
      width: r.width,
      height: r.height,
      name: r.name,
      color: r.color,
      capacity: r.capacity,
    }));
  const desks = elements
    .filter((el): el is Desk => el.type === 'desk')
    .map((d) => ({
      ...(isClientId(d.id) ? {} : { id: d.id }),
      x: d.x,
      y: d.y,
      name: d.name,
      rotation: d.rotation,
    }));
  return request(`/api/floors/${floorId}/elements`, { method: 'PUT', body: JSON.stringify({ rooms, desks }) });
}

// ---------- Assignments ----------

export function assignDesk(deskId: string, login: string): Promise<void> {
  return request(`/api/desks/${deskId}/assignment`, { method: 'PUT', body: JSON.stringify({ login }) });
}

export function unassignDesk(deskId: string): Promise<void> {
  return request(`/api/desks/${deskId}/assignment`, { method: 'DELETE' });
}
