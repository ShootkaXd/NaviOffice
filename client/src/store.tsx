import { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, Action } from './types';
import { getMap } from './api';

const initialState: AppState = {
  floors: [],
  currentFloorId: '',
  elements: [],
  selectedId: null,
  tool: 'select',
  focusDeskId: null,
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
        focusDeskId: state.focusDeskId === action.payload ? null : state.focusDeskId,
      };
    case 'SELECT':
      return { ...state, selectedId: action.payload };
    case 'SET_FLOOR':
      return { ...state, currentFloorId: action.payload, selectedId: null };
    case 'SET_MAP': {
      const { floors, elements } = action.payload;
      const currentFloorId = floors.some((f) => f.id === state.currentFloorId)
        ? state.currentFloorId
        : floors[0]?.id ?? '';
      const selectedId =
        state.selectedId && elements.some((el) => el.id === state.selectedId) ? state.selectedId : null;
      return { ...state, floors, elements, currentFloorId, selectedId };
    }
    case 'FOCUS_DESK':
      return { ...state, focusDeskId: action.payload };
    default:
      return state;
  }
}

/** Перечитать карту с сервера и положить в store. */
export async function refreshMap(dispatch: React.Dispatch<Action>) {
  try {
    const map = await getMap();
    dispatch({ type: 'SET_MAP', payload: map });
  } catch (err) {
    console.error('Не удалось загрузить карту', err);
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
