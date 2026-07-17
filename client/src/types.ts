export type ToolType = 'select' | 'room' | 'desk' | 'meeting';

export type Role = 'Admin' | 'Secretary' | 'User';

export interface User {
  login: string;
  displayName: string;
  department: string;
  title: string;
  email: string | null;
  role: Role;
}

export interface Employee {
  login: string;
  displayName: string;
  department: string;
  title: string;
  email: string;
  deskId?: string | null;
}

export interface DeskAssignment {
  login: string;
  displayName: string;
  department: string;
  title: string;
}

export interface Room {
  id: string;
  type: 'room';
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  color: string;
  capacity: number;
  floorId: string;
}

export interface Desk {
  id: string;
  type: 'desk';
  x: number;
  y: number;
  name: string;
  rotation: number;
  assignment: DeskAssignment | null;
  floorId: string;
}

export interface MeetingRoom {
  id: string;
  type: 'meeting';
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  email: string | null;
  capacity: number;
  color: string;
  floorId: string;
}

export type MapElement = Room | Desk | MeetingRoom;

export interface Floor {
  id: string;
  name: string;
  order: number;
  hasBackground: boolean;
}

/** Текущий статус переговорной: занята до / свободна до. */
export interface RoomStatus {
  id: string;
  busy: boolean;
  until: string | null;
}

export interface BookingItem {
  start: string;
  end: string;
  subject: string;
  organizer: string;
}

export interface AppState {
  floors: Floor[];
  currentFloorId: string;
  elements: MapElement[];
  selectedId: string | null;
  tool: ToolType;
  focusDeskId: string | null;
  roomStatuses: Record<string, RoomStatus>;
}

export type Action =
  | { type: 'SET_TOOL'; payload: ToolType }
  | { type: 'ADD_ELEMENT'; payload: MapElement }
  | { type: 'UPDATE_ELEMENT'; payload: MapElement }
  | { type: 'DELETE_ELEMENT'; payload: string }
  | { type: 'SELECT'; payload: string | null }
  | { type: 'SET_FLOOR'; payload: string }
  | { type: 'SET_MAP'; payload: { floors: Floor[]; elements: MapElement[] } }
  | { type: 'FOCUS_DESK'; payload: string | null }
  | { type: 'SET_STATUSES'; payload: RoomStatus[] };
