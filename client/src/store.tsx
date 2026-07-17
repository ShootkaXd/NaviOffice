import { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, Action, Floor } from './types';

const defaultFloor: Floor = { id: 'floor-1', name: 'Floor 1' };

const initialState: AppState = {
  floors: [defaultFloor],
  currentFloorId: 'floor-1',
  elements: [],
  selectedId: null,
  tool: 'select',
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, tool: action.payload, selectedId: null };
    case 'ADD_ELEMENT':
      return { ...state, elements: [...state.elements, action.payload], selectedId: action.payload.id };
    case 'UPDATE_ELEMENT':
      return {
        ...state,
        elements: state.elements.map((el) => (el.id === action.payload.id ? action.payload : el)),
      };
    case 'DELETE_ELEMENT':
      return {
        ...state,
        elements: state.elements.filter((el) => el.id !== action.payload),
        selectedId: state.selectedId === action.payload ? null : state.selectedId,
      };
    case 'SELECT':
      return { ...state, selectedId: action.payload };
    case 'ADD_FLOOR':
      return { ...state, floors: [...state.floors, action.payload], currentFloorId: action.payload.id };
    case 'SET_FLOOR':
      return { ...state, currentFloorId: action.payload, selectedId: null };
    case 'RENAME_FLOOR':
      return {
        ...state,
        floors: state.floors.map((f) => (f.id === action.payload.id ? { ...f, name: action.payload.name } : f)),
      };
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    default:
      return state;
  }
}

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
