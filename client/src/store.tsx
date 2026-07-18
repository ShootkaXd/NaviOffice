import { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, Action } from './types';
import { getMap, getMeetingRoomStatuses } from './api';

const initialState: AppState = {
  offices: [],
  currentOfficeId: '',
  floors: [],
  currentFloorId: '',
  elements: [],
  selectedId: null,
  tool: 'select',
  focusDeskId: null,
  roomStatuses: {},
  dirty: false,
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_TOOL':
      return { ...state, tool: action.payload, selectedId: null };
    case 'ADD_ELEMENT':
      return { ...state, elements: [...state.elements, action.payload], selectedId: action.payload.id, dirty: true };
    case 'UPDATE_ELEMENT':
      return {
        ...state,
        elements: state.elements.map((el) => (el.id === action.payload.id ? action.payload : el)),
        dirty: true,
      };
    case 'DELETE_ELEMENT':
      return {
        ...state,
        elements: state.elements.filter((el) => el.id !== action.payload),
        selectedId: state.selectedId === action.payload ? null : state.selectedId,
        focusDeskId: state.focusDeskId === action.payload ? null : state.focusDeskId,
        dirty: true,
      };
    case 'SELECT':
      return { ...state, selectedId: action.payload };
    case 'SET_FLOOR':
      return { ...state, currentFloorId: action.payload, selectedId: null };
    case 'SET_MAP': {
      const { offices, floors, elements } = action.payload;
      const currentOfficeId = offices.some((o) => o.id === state.currentOfficeId)
        ? state.currentOfficeId
        : offices[0]?.id ?? '';
      const officeFloors = floors.filter((f) => f.officeId === currentOfficeId);
      const currentFloorId = officeFloors.some((f) => f.id === state.currentFloorId)
        ? state.currentFloorId
        : officeFloors[0]?.id ?? '';
      const selectedId =
        state.selectedId && elements.some((el) => el.id === state.selectedId) ? state.selectedId : null;
      return { ...state, offices, currentOfficeId, floors, elements, currentFloorId, selectedId, dirty: false };
    }
    case 'SET_OFFICE': {
      const officeFloors = state.floors.filter((f) => f.officeId === action.payload);
      return {
        ...state,
        currentOfficeId: action.payload,
        currentFloorId: officeFloors[0]?.id ?? '',
        selectedId: null,
      };
    }
    case 'FOCUS_DESK':
      return { ...state, focusDeskId: action.payload };
    case 'SET_STATUSES': {
      const roomStatuses: AppState['roomStatuses'] = {};
      for (const s of action.payload) roomStatuses[s.id] = s;
      return { ...state, roomStatuses };
    }
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

/** Обновить статусы занятости переговорных. */
export async function refreshStatuses(dispatch: React.Dispatch<Action>) {
  try {
    const statuses = await getMeetingRoomStatuses();
    dispatch({ type: 'SET_STATUSES', payload: statuses });
  } catch (err) {
    console.error('Не удалось загрузить статусы переговорных', err);
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
