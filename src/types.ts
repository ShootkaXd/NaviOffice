export type ToolType = 'select' | 'room' | 'desk' | 'wall';

export type DeskStatus = 'available' | 'booked' | 'unavailable';

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
  status: DeskStatus;
  floorId: string;
}

export type MapElement = Room | Desk;

export interface Floor {
  id: string;
  name: string;
}

export interface AppState {
  floors: Floor[];
  currentFloorId: string;
  elements: MapElement[];
  selectedId: string | null;
  tool: ToolType;
}

export type Action =
  | { type: 'SET_TOOL'; payload: ToolType }
  | { type: 'ADD_ELEMENT'; payload: MapElement }
  | { type: 'UPDATE_ELEMENT'; payload: MapElement }
  | { type: 'DELETE_ELEMENT'; payload: string }
  | { type: 'SELECT'; payload: string | null }
  | { type: 'ADD_FLOOR'; payload: Floor }
  | { type: 'SET_FLOOR'; payload: string }
  | { type: 'RENAME_FLOOR'; payload: { id: string; name: string } }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };
