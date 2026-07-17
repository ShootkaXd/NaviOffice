import { useRef, useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { Desk, MapElement, Room } from '../types';
import { uid, snap, DESK_RADIUS, STATUS_COLORS, ROOM_COLORS } from '../utils';

const CANVAS_W = 2000;
const CANVAS_H = 1400;
const HANDLE_SIZE = 7;

interface DragState {
  type: 'move' | 'resize';
  startX: number;
  startY: number;
  origEl: MapElement;
  corner?: 'nw' | 'ne' | 'sw' | 'se';
}

interface DrawState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
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

export default function Canvas() {
  const { state, dispatch } = useStore();
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 1200, h: 800 });
  const [pan, setPan] = useState<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const currentElements = state.elements.filter((el) => el.floorId === state.currentFloorId);
  const selected = state.elements.find((el) => el.id === state.selectedId);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        dispatch({ type: 'DELETE_ELEMENT', payload: state.selectedId });
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT', payload: null });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.selectedId, dispatch]);

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
      return;
    }

    if (state.tool === 'room') {
      const sx = snap(pt.x);
      const sy = snap(pt.y);
      setDraw({ startX: sx, startY: sy, currentX: sx, currentY: sy });
      return;
    }

    if (state.tool === 'desk') {
      const desk: Desk = {
        id: uid(),
        type: 'desk',
        x: snap(pt.x),
        y: snap(pt.y),
        name: `D${currentElements.filter((el) => el.type === 'desk').length + 1}`,
        status: 'available',
        floorId: state.currentFloorId,
      };
      dispatch({ type: 'ADD_ELEMENT', payload: desk });
      return;
    }

    // select mode — clicking canvas background deselects
    if ((e.target as SVGElement).id === 'canvas-bg') {
      dispatch({ type: 'SELECT', payload: null });
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

      if (drag.type === 'move') {
        const orig = drag.origEl;
        dispatch({
          type: 'UPDATE_ELEMENT',
          payload: {
            ...orig,
            x: snap(orig.x + dx),
            y: snap(orig.y + dy),
          } as MapElement,
        });
      } else if (drag.type === 'resize' && drag.origEl.type === 'room') {
        const orig = drag.origEl as Room;
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

  function onSVGMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (pan) {
      setPan(null);
      return;
    }

    if (draw) {
      const minW = Math.abs(draw.currentX - draw.startX);
      const minH = Math.abs(draw.currentY - draw.startY);
      if (minW > 20 && minH > 20) {
        const x = Math.min(draw.startX, draw.currentX);
        const y = Math.min(draw.startY, draw.currentY);
        const room: Room = {
          id: uid(),
          type: 'room',
          x,
          y,
          width: Math.abs(draw.currentX - draw.startX),
          height: Math.abs(draw.currentY - draw.startY),
          name: `Room ${currentElements.filter((el) => el.type === 'room').length + 1}`,
          color: ROOM_COLORS[Math.floor(Math.random() * ROOM_COLORS.length)],
          capacity: 4,
          floorId: state.currentFloorId,
        };
        dispatch({ type: 'ADD_ELEMENT', payload: room });
      }
      setDraw(null);
      return;
    }

    if (drag) {
      setDrag(null);
    }
  }

  function onElementMouseDown(e: React.MouseEvent, el: MapElement) {
    e.stopPropagation();
    if (state.tool !== 'select') return;
    dispatch({ type: 'SELECT', payload: el.id });
    const pt = getSVGPoint(e.clientX, e.clientY);
    setDrag({ type: 'move', startX: pt.x, startY: pt.y, origEl: el });
  }

  function onHandleMouseDown(
    e: React.MouseEvent,
    el: Room,
    corner: 'nw' | 'ne' | 'sw' | 'se'
  ) {
    e.stopPropagation();
    const pt = getSVGPoint(e.clientX, e.clientY);
    setDrag({ type: 'resize', startX: pt.x, startY: pt.y, origEl: el, corner });
  }

  function onWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
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
    state.tool === 'room' ? 'crosshair' :
    state.tool === 'desk' ? 'cell' :
    drag ? 'grabbing' :
    'default';

  return (
    <div className="flex-1 relative overflow-hidden bg-gray-100">
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

        {/* Rooms */}
        {currentElements.filter((el) => el.type === 'room').map((el) => {
          const room = el as Room;
          const isSelected = state.selectedId === room.id;
          return (
            <g key={room.id}>
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
                style={{ cursor: state.tool === 'select' ? 'grab' : 'default' }}
                onMouseDown={(e) => onElementMouseDown(e, room)}
              />
              <text
                x={room.x + room.width / 2}
                y={room.y + 16}
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
                  x={room.x + room.width / 2}
                  y={room.y + 30}
                  textAnchor="middle"
                  fontSize={9}
                  fill={room.color}
                  fillOpacity={0.6}
                  pointerEvents="none"
                  style={{ userSelect: 'none' }}
                >
                  {room.capacity} seats
                </text>
              )}

              {/* Resize handles */}
              {isSelected && state.tool === 'select' && (
                <>
                  {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
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
                </>
              )}
            </g>
          );
        })}

        {/* Desks */}
        {currentElements.filter((el) => el.type === 'desk').map((el) => {
          const desk = el as Desk;
          const isSelected = state.selectedId === desk.id;
          const color = STATUS_COLORS[desk.status];
          return (
            <g
              key={desk.id}
              onMouseDown={(e) => onElementMouseDown(e, desk)}
              style={{ cursor: state.tool === 'select' ? 'grab' : 'default' }}
            >
              <circle
                cx={desk.x}
                cy={desk.y}
                r={DESK_RADIUS}
                fill={color}
                fillOpacity={0.25}
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
              {/* Desk icon */}
              <rect
                x={desk.x - 9}
                y={desk.y - 4}
                width={18}
                height={10}
                rx={2}
                fill={color}
                fillOpacity={0.8}
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
          title="Reset view"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
          </svg>
        </button>
      </div>

      {/* Tool hint */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
        {state.tool === 'room' && (
          <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            Click and drag to draw a room
          </div>
        )}
        {state.tool === 'desk' && (
          <div className="bg-black/60 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
            Click to place a desk
          </div>
        )}
      </div>
    </div>
  );
}
