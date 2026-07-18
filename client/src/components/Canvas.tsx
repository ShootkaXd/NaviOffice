import { useRef, useState, useEffect, useCallback } from 'react';
import { useStore, refreshStatuses } from '../store';
import { useAuth } from '../auth';
import { Desk, MapElement, Marker, MeetingRoom, Point, Room, RoomStatus } from '../types';
import { uid, snap, lastName, initials, DESK_RADIUS, DESK_FREE_COLOR, DESK_OCCUPIED_COLOR, ROOM_COLORS, MEETING_COLOR } from '../utils';
import { fetchFloorBackground } from '../api';
import { usePhoto } from './Avatar';
import EmployeeCard from './EmployeeCard';
import RoomCard from './RoomCard';
import AssignDialog from './AssignDialog';
import MeetingRoomCard, { BookingPrefill } from './MeetingRoomCard';
import BookingDialog from './BookingDialog';
import Legend from './Legend';

const CANVAS_W = 2000;
const CANVAS_H = 1400;
const HANDLE_SIZE = 7;
const CARD_W = 256;
const CARD_H = 280;
const MEETING_CARD_W = 288;
const MEETING_CARD_H = 330;

interface DragState {
  type: 'move' | 'resize' | 'vertex';
  startX: number;
  startY: number;
  origEl: MapElement;
  corner?: 'nw' | 'ne' | 'sw' | 'se';
  vertexIndex?: number;
}

/** Ограничивающий прямоугольник полигона. */
function bboxOf(points: Point[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Центроид полигона (для подписи). */
function centroidOf(points: Point[]) {
  const n = points.length;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / n,
    y: points.reduce((s, p) => s + p.y, 0) / n,
  };
}

/** Прямоугольник → 4 вершины (для конвертации в полигон). */
function rectToPoints(room: Room): Point[] {
  return [
    { x: room.x, y: room.y },
    { x: room.x + room.width, y: room.y },
    { x: room.x + room.width, y: room.y + room.height },
    { x: room.x, y: room.y + room.height },
  ];
}

interface DrawState {
  kind: 'room' | 'meeting';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

interface CardState {
  deskId: string;
  x: number;
  y: number;
}

interface MeetingCardState {
  roomId: string;
  x: number;
  y: number;
}

function svgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const inv = ctm.inverse();
  const transformed = pt.matrixTransform(inv);
  return { x: transformed.x, y: transformed.y };
}

function DeskOccupant({ desk, a, index, total }: { desk: Desk; a: { login: string; displayName: string }; index: number; total: number }) {
  const photo = usePhoto(a.login);
  const offset = total === 1 ? 0 : index === 0 ? -7 : 7;
  const clipId = `desk-clip-${desk.id}-${index}`;
  return (
    <>
      <clipPath id={clipId}>
        <circle cx={desk.x + offset} cy={desk.y - 2} r={total === 1 ? 11 : 8} />
      </clipPath>
      <circle cx={desk.x + offset} cy={desk.y - 2} r={total === 1 ? 11 : 8} fill={DESK_OCCUPIED_COLOR} pointerEvents="none" />
      {photo ? (
        <image
          href={photo}
          x={desk.x + offset - (total === 1 ? 11 : 8)}
          y={desk.y - 2 - (total === 1 ? 11 : 8)}
          width={(total === 1 ? 11 : 8) * 2}
          height={(total === 1 ? 11 : 8) * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
          pointerEvents="none"
        />
      ) : (
        <text
          x={desk.x + offset}
          y={desk.y + (total === 1 ? 1 : 0)}
          textAnchor="middle"
          fontSize={total === 1 ? 8 : 6.5}
          fill="white"
          fontWeight="600"
          pointerEvents="none"
          style={{ userSelect: 'none' }}
        >
          {initials(a.displayName)}
        </text>
      )}
    </>
  );
}

function DeskNode({
  desk,
  isSelected,
  isFocused,
  onMouseDown,
  onClick,
}: {
  desk: Desk;
  isSelected: boolean;
  isFocused: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const occupants = desk.assignments;
  const occupied = occupants.length > 0;
  const color = desk.color ?? (occupied ? DESK_OCCUPIED_COLOR : DESK_FREE_COLOR);

  return (
    <g onMouseDown={onMouseDown} onClick={onClick} style={{ cursor: 'pointer' }}>
      {isFocused && (
        <circle
          className="desk-pulse"
          cx={desk.x}
          cy={desk.y}
          r={DESK_RADIUS}
          fill="none"
          stroke="#6366f1"
          strokeWidth={3}
        />
      )}
      <circle
        cx={desk.x}
        cy={desk.y}
        r={DESK_RADIUS}
        fill={color}
        fillOpacity={occupied ? 0.12 : 0.08}
        stroke={color}
        strokeWidth={isSelected ? 2.5 : 1.5}
      />
      {isSelected && (
        <circle
          cx={desk.x}
          cy={desk.y}
          r={DESK_RADIUS + 4}
          fill="none"
          stroke="#6366f1"
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />
      )}
      {occupied ? (
        <>
          {occupants.map((a, i) => (
            <DeskOccupant key={a.login} desk={desk} a={a} index={i} total={occupants.length} />
          ))}
          <text
            x={desk.x}
            y={desk.y + 15}
            textAnchor="middle"
            fontSize={7.5}
            fill="#4f46e5"
            fontWeight="600"
            pointerEvents="none"
            style={{ userSelect: 'none' }}
          >
            {occupants.map((a) => lastName(a.displayName)).join(' / ')}
          </text>
          <text
            x={desk.x}
            y={desk.y + 24}
            textAnchor="middle"
            fontSize={6.5}
            fill="#9ca3af"
            pointerEvents="none"
            style={{ userSelect: 'none' }}
          >
            {desk.name}
          </text>
        </>
      ) : (
        <>
          <rect
            x={desk.x - 9}
            y={desk.y - 4}
            width={18}
            height={10}
            rx={2}
            fill={color}
            fillOpacity={0.5}
            transform={desk.rotation ? `rotate(${desk.rotation} ${desk.x} ${desk.y})` : undefined}
            pointerEvents="none"
          />
          <text
            x={desk.x}
            y={desk.y + 15}
            textAnchor="middle"
            fontSize={8}
            fill={color}
            fontWeight="600"
            pointerEvents="none"
            style={{ userSelect: 'none' }}
          >
            {desk.name}
          </text>
        </>
      )}
    </g>
  );
}

/** Переговорная на карте: прямоугольник с иконкой календаря и индикатором занятости. */
function MeetingRoomNode({
  room,
  status,
  isSelected,
  canEdit,
  onMouseDown,
  onClick,
}: {
  room: MeetingRoom;
  status: RoomStatus | undefined;
  isSelected: boolean;
  canEdit: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const dotColor = status ? (status.busy ? '#ef4444' : '#22c55e') : '#9ca3af';
  return (
    <g onMouseDown={onMouseDown} onClick={onClick} style={{ cursor: 'pointer' }}>
      <rect
        x={room.x}
        y={room.y}
        width={room.width}
        height={room.height}
        fill={room.color}
        fillOpacity={0.12}
        stroke={room.color}
        strokeWidth={isSelected ? 2 : 1.5}
        strokeOpacity={isSelected ? 1 : 0.8}
        strokeDasharray={canEdit && isSelected ? undefined : '0'}
        rx={6}
      />
      {/* Индикатор занятости */}
      <circle
        cx={room.x + room.width - 12}
        cy={room.y + 12}
        r={5}
        fill={dotColor}
        stroke="white"
        strokeWidth={1.5}
        pointerEvents="none"
      />
      {/* Иконка календаря */}
      <g
        transform={`translate(${room.x + room.width / 2 - 9}, ${room.y + room.height / 2 - 16})`}
        pointerEvents="none"
        opacity={0.55}
      >
        <rect x="0" y="2" width="18" height="15" rx="2" fill="none" stroke={room.color} strokeWidth="1.8" />
        <line x1="0" y1="7" x2="18" y2="7" stroke={room.color} strokeWidth="1.8" />
        <line x1="4.5" y1="0" x2="4.5" y2="4" stroke={room.color} strokeWidth="1.8" />
        <line x1="13.5" y1="0" x2="13.5" y2="4" stroke={room.color} strokeWidth="1.8" />
      </g>
      <text
        x={room.x + room.width / 2}
        y={room.y + room.height / 2 + 14}
        textAnchor="middle"
        fontSize={11}
        fill={room.color}
        fontWeight="600"
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {room.name}
      </text>
      <text
        x={room.x + room.width / 2}
        y={room.y + room.height / 2 + 27}
        textAnchor="middle"
        fontSize={9}
        fill={room.color}
        fillOpacity={0.6}
        pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {room.capacity} мест
      </text>
    </g>
  );
}

export default function Canvas() {
  const { state, dispatch } = useStore();
  const { user } = useAuth();
  const canEdit = user?.role === 'Admin';
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const movedRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1200, h: 800 });
  const [pan, setPan] = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [meetingCard, setMeetingCard] = useState<MeetingCardState | null>(null);
  const [roomCard, setRoomCard] = useState<{ roomId: string; x: number; y: number } | null>(null);
  const [roomAssignFor, setRoomAssignFor] = useState<string | null>(null);
  const [bookingFor, setBookingFor] = useState<string | null>(null);
  const [bookingPrefill, setBookingPrefill] = useState<BookingPrefill | undefined>(undefined);
  const [scheduleKey, setScheduleKey] = useState(0);
  const [bgUrl, setBgUrl] = useState<string | null>(null);

  const currentElements = state.elements.filter((el) => el.floorId === state.currentFloorId);
  const currentFloor = state.floors.find((f) => f.id === state.currentFloorId);
  const cardDesk = card
    ? (state.elements.find((el) => el.id === card.deskId && el.type === 'desk') as Desk | undefined)
    : undefined;
  const assignDeskEl = assignFor
    ? (state.elements.find((el) => el.id === assignFor && el.type === 'desk') as Desk | undefined)
    : undefined;
  const roomCardRoom = roomCard
    ? (state.elements.find((el) => el.id === roomCard.roomId && el.type === 'room') as Room | undefined)
    : undefined;
  const roomAssignEl = roomAssignFor
    ? (state.elements.find((el) => el.id === roomAssignFor && el.type === 'room') as Room | undefined)
    : undefined;
  const meetingCardRoom = meetingCard
    ? (state.elements.find((el) => el.id === meetingCard.roomId && el.type === 'meeting') as MeetingRoom | undefined)
    : undefined;
  const bookingRoom = bookingFor
    ? (state.elements.find((el) => el.id === bookingFor && el.type === 'meeting') as MeetingRoom | undefined)
    : undefined;

  // Подложка (план этажа): качаем с токеном и кладём blob URL.
  useEffect(() => {
    let alive = true;
    setBgUrl(null);
    if (currentFloor?.hasBackground) {
      fetchFloorBackground(currentFloor.id).then((url) => {
        if (alive) setBgUrl(url);
      });
    }
    return () => {
      alive = false;
    };
  }, [currentFloor?.id, currentFloor?.hasBackground]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (canEdit && (e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        dispatch({ type: 'DELETE_ELEMENT', payload: state.selectedId });
        setCard(null);
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT', payload: null });
        setCard(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.selectedId, dispatch, canEdit]);

  // Смена этажа — закрыть карточку и диалог.
  useEffect(() => {
    setCard(null);
    setAssignFor(null);
    setMeetingCard(null);
    setBookingFor(null);
    setRoomCard(null);
    setRoomAssignFor(null);
  }, [state.currentFloorId]);

  // Фокус на столе из поиска: подлететь и подсветить ~2 секунды.
  useEffect(() => {
    if (!state.focusDeskId) return;
    const desk = state.elements.find(
      (el) => el.id === state.focusDeskId && el.type === 'desk'
    ) as Desk | undefined;
    if (!desk || desk.floorId !== state.currentFloorId) return;
    setViewBox({ x: desk.x - 300, y: desk.y - 200, w: 600, h: 400 });
    const t = setTimeout(() => dispatch({ type: 'FOCUS_DESK', payload: null }), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.focusDeskId, state.currentFloorId]);

  const getSVGPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      return svgPoint(svgRef.current, clientX, clientY);
    },
    []
  );

  function onSVGMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return;

    const pt = getSVGPoint(e.clientX, e.clientY);

    if (e.button === 0 && (e.altKey || e.metaKey)) {
      setPan({ sx: e.clientX, sy: e.clientY, ox: viewBox.x, oy: viewBox.y });
      setCard(null);
      return;
    }

    if (canEdit && (state.tool === 'room' || state.tool === 'meeting')) {
      const sx = snap(pt.x);
      const sy = snap(pt.y);
      setDraw({ kind: state.tool, startX: sx, startY: sy, currentX: sx, currentY: sy });
      return;
    }

    if (canEdit && state.tool === 'desk') {
      if (!state.currentFloorId) return;
      const desk: Desk = {
        id: 'tmp-' + uid(),
        type: 'desk',
        x: snap(pt.x),
        y: snap(pt.y),
        name: `D${currentElements.filter((el) => el.type === 'desk').length + 1}`,
        rotation: 0,
        color: null,
        assignments: [],
        floorId: state.currentFloorId,
      };
      dispatch({ type: 'ADD_ELEMENT', payload: desk });
      return;
    }

    if (canEdit && state.tool === 'printer') {
      if (!state.currentFloorId) return;
      const marker: Marker = {
        id: 'tmp-' + uid(),
        type: 'marker',
        x: snap(pt.x),
        y: snap(pt.y),
        kind: 'printer',
        label: `Принтер ${currentElements.filter((el) => el.type === 'marker').length + 1}`,
        floorId: state.currentFloorId,
      };
      dispatch({ type: 'ADD_ELEMENT', payload: marker });
      return;
    }

    // select mode — clicking canvas background deselects
    if ((e.target as SVGElement).id === 'canvas-bg') {
      dispatch({ type: 'SELECT', payload: null });
      setCard(null);
      setMeetingCard(null);
    }
  }

  function onSVGMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (pan) {
      const dx = (e.clientX - pan.sx) * (viewBox.w / (svgRef.current?.clientWidth ?? 1));
      const dy = (e.clientY - pan.sy) * (viewBox.h / (svgRef.current?.clientHeight ?? 1));
      setViewBox((v) => ({ ...v, x: pan.ox - dx, y: pan.oy - dy }));
      return;
    }

    if (draw) {
      const pt = getSVGPoint(e.clientX, e.clientY);
      setDraw((d) => d ? { ...d, currentX: snap(pt.x), currentY: snap(pt.y) } : null);
      return;
    }

    if (drag) {
      const pt = getSVGPoint(e.clientX, e.clientY);
      const dx = pt.x - drag.startX;
      const dy = pt.y - drag.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;

      if (drag.type === 'move') {
        const orig = drag.origEl;
        const nx = snap(orig.x + dx);
        const ny = snap(orig.y + dy);
        const payload: MapElement = { ...orig, x: nx, y: ny } as MapElement;
        // Полигональная комната перемещается вместе с вершинами.
        if (payload.type === 'room' && orig.type === 'room' && orig.points) {
          payload.points = orig.points.map((p) => ({ x: p.x + (nx - orig.x), y: p.y + (ny - orig.y) }));
        }
        dispatch({ type: 'UPDATE_ELEMENT', payload });
      } else if (drag.type === 'vertex' && drag.origEl.type === 'room') {
        const orig = drag.origEl as Room;
        if (!orig.points || drag.vertexIndex === undefined) return;
        const points = orig.points.map((p, i) =>
          i === drag.vertexIndex ? { x: snap(pt.x), y: snap(pt.y) } : p
        );
        const bb = bboxOf(points);
        dispatch({
          type: 'UPDATE_ELEMENT',
          payload: { ...orig, points, ...bb } as MapElement,
        });
      } else if (drag.type === 'resize' && (drag.origEl.type === 'room' || drag.origEl.type === 'meeting')) {
        const orig = drag.origEl as Room | MeetingRoom;
        let { x, y, width, height } = orig;
        const corner = drag.corner;
        if (corner === 'se') {
          width = Math.max(40, snap(orig.width + dx));
          height = Math.max(40, snap(orig.height + dy));
        } else if (corner === 'sw') {
          x = snap(orig.x + dx);
          width = Math.max(40, snap(orig.width - dx));
          height = Math.max(40, snap(orig.height + dy));
        } else if (corner === 'ne') {
          y = snap(orig.y + dy);
          width = Math.max(40, snap(orig.width + dx));
          height = Math.max(40, snap(orig.height - dy));
        } else if (corner === 'nw') {
          x = snap(orig.x + dx);
          y = snap(orig.y + dy);
          width = Math.max(40, snap(orig.width - dx));
          height = Math.max(40, snap(orig.height - dy));
        }
        dispatch({
          type: 'UPDATE_ELEMENT',
          payload: { ...orig, x, y, width, height } as MapElement,
        });
      }
    }
  }

  function onSVGMouseUp() {
    if (pan) {
      setPan(null);
      return;
    }

    if (draw) {
      const minW = Math.abs(draw.currentX - draw.startX);
      const minH = Math.abs(draw.currentY - draw.startY);
      if (minW > 20 && minH > 20 && state.currentFloorId) {
        const x = Math.min(draw.startX, draw.currentX);
        const y = Math.min(draw.startY, draw.currentY);
        const width = Math.abs(draw.currentX - draw.startX);
        const height = Math.abs(draw.currentY - draw.startY);
        if (draw.kind === 'meeting') {
          const meeting: MeetingRoom = {
            id: 'tmp-' + uid(),
            type: 'meeting',
            x,
            y,
            width,
            height,
            name: `Переговорная ${currentElements.filter((el) => el.type === 'meeting').length + 1}`,
            email: null,
            capacity: 6,
            color: MEETING_COLOR,
            floorId: state.currentFloorId,
          };
          dispatch({ type: 'ADD_ELEMENT', payload: meeting });
        } else {
          const room: Room = {
            id: 'tmp-' + uid(),
            type: 'room',
            x,
            y,
            width,
            height,
            name: `Комната ${currentElements.filter((el) => el.type === 'room').length + 1}`,
            color: ROOM_COLORS[Math.floor(Math.random() * ROOM_COLORS.length)],
            capacity: 4,
            floorId: state.currentFloorId,
            points: null,
            assignments: [],
          };
          dispatch({ type: 'ADD_ELEMENT', payload: room });
        }
      }
      setDraw(null);
      return;
    }

    if (drag) {
      setDrag(null);
    }
  }

  function onElementMouseDown(e: React.MouseEvent, el: MapElement) {
    // В режимах рисования событие должно дойти до канваса —
    // иначе нельзя поставить стол/нарисовать комнату поверх существующей.
    if (canEdit && state.tool !== 'select') return;
    e.stopPropagation();
    if (el.type === 'room') {
      setCard(null);
      setMeetingCard(null);
    }
    if (!canEdit) return;
    dispatch({ type: 'SELECT', payload: el.id });
    const pt = getSVGPoint(e.clientX, e.clientY);
    movedRef.current = false;
    setDrag({ type: 'move', startX: pt.x, startY: pt.y, origEl: el });
  }

  function onDeskClick(e: React.MouseEvent, desk: Desk) {
    e.stopPropagation();
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (canEdit && state.tool !== 'select') return;
    dispatch({ type: 'SELECT', payload: desk.id });
    setMeetingCard(null);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(e.clientX - rect.left + 14, 8), Math.max(8, rect.width - CARD_W - 8));
    const y = Math.min(Math.max(e.clientY - rect.top - 24, 8), Math.max(8, rect.height - CARD_H - 8));
    setCard({ deskId: desk.id, x, y });
  }

  function onRoomClick(e: React.MouseEvent, room: Room) {
    e.stopPropagation();
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (canEdit && state.tool !== 'select') return;
    if (canEdit) return; // в режиме редактора комнату выбирают для правки, карточка не нужна
    setCard(null);
    setMeetingCard(null);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(e.clientX - rect.left + 14, 8), Math.max(8, rect.width - MEETING_CARD_W - 8));
    const y = Math.min(Math.max(e.clientY - rect.top - 24, 8), Math.max(8, rect.height - MEETING_CARD_H - 8));
    setRoomCard({ roomId: room.id, x, y });
  }

  function onMeetingClick(e: React.MouseEvent, room: MeetingRoom) {
    e.stopPropagation();
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (canEdit && state.tool !== 'select') return;
    dispatch({ type: 'SELECT', payload: room.id });
    setCard(null);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(e.clientX - rect.left + 14, 8), Math.max(8, rect.width - MEETING_CARD_W - 8));
    const y = Math.min(Math.max(e.clientY - rect.top - 24, 8), Math.max(8, rect.height - MEETING_CARD_H - 8));
    setMeetingCard({ roomId: room.id, x, y });
  }

  function onHandleMouseDown(
    e: React.MouseEvent,
    el: Room | MeetingRoom,
    corner: 'nw' | 'ne' | 'sw' | 'se'
  ) {
    e.stopPropagation();
    const pt = getSVGPoint(e.clientX, e.clientY);
    setDrag({ type: 'resize', startX: pt.x, startY: pt.y, origEl: el, corner });
  }

  /** Начать перетаскивание существующей вершины полигона. */
  function onVertexMouseDown(e: React.MouseEvent, room: Room, index: number) {
    e.stopPropagation();
    const pt = getSVGPoint(e.clientX, e.clientY);
    setDrag({ type: 'vertex', startX: pt.x, startY: pt.y, origEl: room, vertexIndex: index });
  }

  /** Удалить вершину двойным кликом (минимум 3 остаются). */
  function onVertexDoubleClick(e: React.MouseEvent, room: Room, index: number) {
    e.stopPropagation();
    if (!room.points || room.points.length <= 3) return;
    const points = room.points.filter((_, i) => i !== index);
    const bb = bboxOf(points);
    dispatch({ type: 'UPDATE_ELEMENT', payload: { ...room, points, ...bb } as MapElement });
  }

  /**
   * Вставить новую вершину на середине ребра и сразу начать её тянуть.
   * Для прямоугольной комнаты сначала конвертируем её в полигон из 4 углов.
   */
  function onMidpointMouseDown(e: React.MouseEvent, room: Room, edgeIndex: number) {
    e.stopPropagation();
    const basePoints = room.points ?? rectToPoints(room);
    const a = basePoints[edgeIndex];
    const b = basePoints[(edgeIndex + 1) % basePoints.length];
    const mid = { x: snap((a.x + b.x) / 2), y: snap((a.y + b.y) / 2) };
    const points = [...basePoints.slice(0, edgeIndex + 1), mid, ...basePoints.slice(edgeIndex + 1)];
    const bb = bboxOf(points);
    const updated = { ...room, points, ...bb } as Room;
    dispatch({ type: 'UPDATE_ELEMENT', payload: updated });
    const pt = getSVGPoint(e.clientX, e.clientY);
    setDrag({ type: 'vertex', startX: pt.x, startY: pt.y, origEl: updated, vertexIndex: edgeIndex + 1 });
  }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    setCard(null);
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const pt = getSVGPoint(e.clientX, e.clientY);
    setViewBox((v) => {
      const nw = Math.max(400, Math.min(3000, v.w * factor));
      const nh = Math.max(300, Math.min(2000, v.h * factor));
      const nx = pt.x - (pt.x - v.x) * (nw / v.w);
      const ny = pt.y - (pt.y - v.y) * (nh / v.h);
      return { x: nx, y: ny, w: nw, h: nh };
    });
  }

  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`;

  const cursorStyle =
    canEdit && (state.tool === 'room' || state.tool === 'meeting') ? 'crosshair' :
    canEdit && (state.tool === 'desk' || state.tool === 'printer') ? 'cell' :
    drag ? 'grabbing' :
    'default';

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-gray-100">
      <svg
        ref={svgRef}
        className="w-full h-full select-none"
        viewBox={vb}
        style={{ cursor: cursorStyle }}
        onMouseDown={onSVGMouseDown}
        onMouseMove={onSVGMouseMove}
        onMouseUp={onSVGMouseUp}
        onMouseLeave={onSVGMouseUp}
        onWheel={onWheel}
      >
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.8" fill="#ccc" />
          </pattern>
          <pattern id="grid-large" width="100" height="100" patternUnits="userSpaceOnUse">
            <rect width="100" height="100" fill="url(#grid)" />
            <circle cx="100" cy="100" r="1.2" fill="#bbb" />
          </pattern>
        </defs>

        {/* Background */}
        <rect
          id="canvas-bg"
          x={-5000}
          y={-5000}
          width={10000}
          height={10000}
          fill="url(#grid-large)"
        />

        {/* Canvas boundary */}
        <rect
          x={0}
          y={0}
          width={CANVAS_W}
          height={CANVAS_H}
          fill="white"
          fillOpacity={0.7}
          stroke="#ddd"
          strokeWidth={1}
        />

        {/* План этажа (подложка) */}
        {bgUrl && (
          <image
            href={bgUrl}
            x={0}
            y={0}
            width={CANVAS_W}
            height={CANVAS_H}
            preserveAspectRatio="xMidYMid meet"
            opacity={0.6}
            pointerEvents="none"
          />
        )}

        {/* Rooms */}
        {currentElements.filter((el) => el.type === 'room').map((el) => {
          const room = el as Room;
          const isSelected = state.selectedId === room.id;
          const isPolygon = !!room.points && room.points.length >= 3;
          const label = isPolygon ? centroidOf(room.points!) : { x: room.x + room.width / 2, y: room.y + 23 };
          const editablePoints = room.points ?? rectToPoints(room);
          return (
            <g key={room.id}>
              {isPolygon ? (
                <polygon
                  points={room.points!.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={room.color}
                  fillOpacity={0.15}
                  stroke={room.color}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeOpacity={isSelected ? 1 : 0.7}
                  strokeLinejoin="round"
                  style={{ cursor: canEdit && state.tool === 'select' ? 'grab' : 'pointer' }}
                  onMouseDown={(e) => onElementMouseDown(e, room)}
                  onClick={(e) => onRoomClick(e, room)}
                />
              ) : (
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  fill={room.color}
                  fillOpacity={0.15}
                  stroke={room.color}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeOpacity={isSelected ? 1 : 0.7}
                  rx={4}
                  style={{ cursor: canEdit && state.tool === 'select' ? 'grab' : 'pointer' }}
                  onMouseDown={(e) => onElementMouseDown(e, room)}
                  onClick={(e) => onRoomClick(e, room)}
                />
              )}
              <text
                x={label.x}
                y={label.y - 7}
                textAnchor="middle"
                fontSize={11}
                fill={room.color}
                fillOpacity={0.9}
                fontWeight="600"
                pointerEvents="none"
                style={{ userSelect: 'none' }}
              >
                {room.name}
              </text>
              {room.capacity > 0 && (
                <text
                  x={label.x}
                  y={label.y + 7}
                  textAnchor="middle"
                  fontSize={9}
                  fill={room.color}
                  fillOpacity={0.6}
                  pointerEvents="none"
                  style={{ userSelect: 'none' }}
                >
                  {room.capacity} мест
                </text>
              )}

              {canEdit && isSelected && state.tool === 'select' && (
                <>
                  {/* Угловые resize-хэндлы — только у прямоугольной комнаты */}
                  {!isPolygon &&
                    (['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
                      const hx =
                        corner === 'nw' || corner === 'sw'
                          ? room.x - HANDLE_SIZE / 2
                          : room.x + room.width - HANDLE_SIZE / 2;
                      const hy =
                        corner === 'nw' || corner === 'ne'
                          ? room.y - HANDLE_SIZE / 2
                          : room.y + room.height - HANDLE_SIZE / 2;
                      const cur =
                        corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
                      return (
                        <rect
                          key={corner}
                          x={hx}
                          y={hy}
                          width={HANDLE_SIZE}
                          height={HANDLE_SIZE}
                          fill="white"
                          stroke="#6366f1"
                          strokeWidth={1.5}
                          rx={1}
                          style={{ cursor: cur }}
                          onMouseDown={(e) => onHandleMouseDown(e, room, corner)}
                        />
                      );
                    })}

                  {/* Вершины полигона: drag — двигать, double-click — удалить */}
                  {isPolygon &&
                    room.points!.map((p, i) => (
                      <rect
                        key={`v-${i}`}
                        x={p.x - HANDLE_SIZE / 2}
                        y={p.y - HANDLE_SIZE / 2}
                        width={HANDLE_SIZE}
                        height={HANDLE_SIZE}
                        fill="white"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        rx={1}
                        style={{ cursor: 'move' }}
                        onMouseDown={(e) => onVertexMouseDown(e, room, i)}
                        onDoubleClick={(e) => onVertexDoubleClick(e, room, i)}
                      />
                    ))}

                  {/* Середины рёбер: mousedown — вставить вершину и тянуть (создание угловой формы) */}
                  {editablePoints.map((p, i) => {
                    const q = editablePoints[(i + 1) % editablePoints.length];
                    const mx = (p.x + q.x) / 2;
                    const my = (p.y + q.y) / 2;
                    return (
                      <circle
                        key={`m-${i}`}
                        cx={mx}
                        cy={my}
                        r={4.5}
                        fill="#eef2ff"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        strokeDasharray="2 1.5"
                        style={{ cursor: 'copy' }}
                        onMouseDown={(e) => onMidpointMouseDown(e, room, i)}
                      >
                        <title>Потянуть, чтобы добавить угол</title>
                      </circle>
                    );
                  })}
                </>
              )}
            </g>
          );
        })}

        {/* Meeting rooms */}
        {currentElements.filter((el) => el.type === 'meeting').map((el) => {
          const meeting = el as MeetingRoom;
          const isSelected = state.selectedId === meeting.id;
          return (
            <g key={meeting.id}>
              <MeetingRoomNode
                room={meeting}
                status={state.roomStatuses[meeting.id]}
                isSelected={isSelected}
                canEdit={canEdit}
                onMouseDown={(e) => onElementMouseDown(e, meeting)}
                onClick={(e) => onMeetingClick(e, meeting)}
              />
              {canEdit && isSelected && state.tool === 'select' && (
                <>
                  {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
                    const hx =
                      corner === 'nw' || corner === 'sw'
                        ? meeting.x - HANDLE_SIZE / 2
                        : meeting.x + meeting.width - HANDLE_SIZE / 2;
                    const hy =
                      corner === 'nw' || corner === 'ne'
                        ? meeting.y - HANDLE_SIZE / 2
                        : meeting.y + meeting.height - HANDLE_SIZE / 2;
                    const cur =
                      corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize';
                    return (
                      <rect
                        key={corner}
                        x={hx}
                        y={hy}
                        width={HANDLE_SIZE}
                        height={HANDLE_SIZE}
                        fill="white"
                        stroke="#6366f1"
                        strokeWidth={1.5}
                        rx={1}
                        style={{ cursor: cur }}
                        onMouseDown={(e) => onHandleMouseDown(e, meeting, corner)}
                      />
                    );
                  })}
                </>
              )}
            </g>
          );
        })}

        {/* Desks */}
        {currentElements.filter((el) => el.type === 'desk').map((el) => {
          const desk = el as Desk;
          return (
            <DeskNode
              key={desk.id}
              desk={desk}
              isSelected={state.selectedId === desk.id}
              isFocused={state.focusDeskId === desk.id}
              onMouseDown={(e) => onElementMouseDown(e, desk)}
              onClick={(e) => onDeskClick(e, desk)}
            />
          );
        })}

        {/* Markers (принтеры) */}
        {currentElements.filter((el) => el.type === 'marker').map((el) => {
          const marker = el as Marker;
          const isSelected = state.selectedId === marker.id;
          return (
            <g
              key={marker.id}
              onMouseDown={(e) => onElementMouseDown(e, marker)}
              style={{ cursor: canEdit && state.tool === 'select' ? 'grab' : 'default' }}
            >
              {isSelected && (
                <rect
                  x={marker.x - 15}
                  y={marker.y - 15}
                  width={30}
                  height={30}
                  rx={7}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
              )}
              <rect
                x={marker.x - 11}
                y={marker.y - 11}
                width={22}
                height={22}
                rx={5}
                fill="#475569"
                fillOpacity={0.9}
              />
              {/* Иконка принтера */}
              <g transform={`translate(${marker.x - 6}, ${marker.y - 6})`} pointerEvents="none">
                <rect x="2" y="0" width="8" height="3.5" rx="0.5" fill="white" />
                <rect x="0" y="3.5" width="12" height="5" rx="1" fill="white" />
                <rect x="2" y="7.5" width="8" height="4.5" rx="0.5" fill="white" stroke="#475569" strokeWidth="0.8" />
                <circle cx="10" cy="5.2" r="0.8" fill="#475569" />
              </g>
              <text
                x={marker.x}
                y={marker.y + 22}
                textAnchor="middle"
                fontSize={7.5}
                fill="#475569"
                fontWeight="600"
                pointerEvents="none"
                style={{ userSelect: 'none' }}
              >
                {marker.label}
              </text>
            </g>
          );
        })}

        {/* Drawing preview */}
        {draw && (
          <rect
            x={Math.min(draw.startX, draw.currentX)}
            y={Math.min(draw.startY, draw.currentY)}
            width={Math.abs(draw.currentX - draw.startX)}
            height={Math.abs(draw.currentY - draw.startY)}
            fill="#6366f1"
            fillOpacity={0.1}
            stroke="#6366f1"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            rx={4}
            pointerEvents="none"
          />
        )}
      </svg>

      {/* Employee card popup */}
      {cardDesk && card && (
        <EmployeeCard
          desk={cardDesk}
          x={card.x}
          y={card.y}
          onClose={() => setCard(null)}
          onAssign={() => setAssignFor(cardDesk.id)}
        />
      )}

      {/* Assign dialog */}
      {assignDeskEl && (
        <AssignDialog desk={assignDeskEl} onClose={() => setAssignFor(null)} />
      )}

      {/* Карточка помещения */}
      {roomCardRoom && roomCard && (
        <RoomCard
          room={roomCardRoom}
          x={roomCard.x}
          y={roomCard.y}
          onClose={() => setRoomCard(null)}
          onAssign={() => setRoomAssignFor(roomCardRoom.id)}
        />
      )}
      {roomAssignEl && (
        <AssignDialog room={roomAssignEl} onClose={() => setRoomAssignFor(null)} />
      )}

      {/* Панель переговорной */}
      {meetingCardRoom && meetingCard && (
        <MeetingRoomCard
          room={meetingCardRoom}
          status={state.roomStatuses[meetingCardRoom.id]}
          refreshKey={scheduleKey}
          onClose={() => setMeetingCard(null)}
          onBook={(prefill) => {
            setBookingPrefill(prefill);
            setBookingFor(meetingCardRoom.id);
          }}
          onBooked={() => {
            setScheduleKey((k) => k + 1);
            refreshStatuses(dispatch);
          }}
        />
      )}

      {/* Booking dialog */}
      {bookingRoom && (
        <BookingDialog
          room={bookingRoom}
          initial={bookingPrefill}
          onClose={() => {
            setBookingFor(null);
            setBookingPrefill(undefined);
          }}
          onBooked={() => {
            setScheduleKey((k) => k + 1);
            refreshStatuses(dispatch);
          }}
        />
      )}

      {/* Legend */}
      <Legend />

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button
          onClick={() => setViewBox((v) => ({ ...v, w: v.w * 0.8, h: v.h * 0.8 }))}
          className="w-8 h-8 bg-white shadow rounded text-gray-600 hover:text-gray-900 flex items-center justify-center text-lg font-light"
        >
          +
        </button>
        <button
          onClick={() => setViewBox((v) => ({ ...v, w: v.w * 1.25, h: v.h * 1.25 }))}
          className="w-8 h-8 bg-white shadow rounded text-gray-600 hover:text-gray-900 flex items-center justify-center text-lg font-light"
        >
          −
        </button>
        <button
          onClick={() => setViewBox({ x: 0, y: 0, w: 1200, h: 800 })}
          className="w-8 h-8 bg-white shadow rounded text-gray-500 hover:text-gray-900 flex items-center justify-center"
          title="Сбросить вид"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
          </svg>
        </button>
      </div>

      {/* Tool hint */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
        {canEdit && state.tool === 'room' && (
          <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            Нарисуйте комнату, зажав кнопку мыши
          </div>
        )}
        {canEdit && state.tool === 'desk' && (
          <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            Кликните по карте, чтобы поставить стол
          </div>
        )}
        {canEdit && state.tool === 'meeting' && (
          <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            Нарисуйте переговорную, зажав кнопку мыши
          </div>
        )}
        {canEdit && state.tool === 'printer' && (
          <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            Кликните по карте, чтобы поставить принтер
          </div>
        )}
      </div>
    </div>
  );
}
