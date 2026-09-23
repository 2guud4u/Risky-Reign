import React, { useRef, useState, useCallback, useEffect } from 'react';
import { CubeCoord, Terrain, cubeToPixel } from 'common';
import { hexPointsAt } from '../utils/hex';
import { terrainColors } from 'common';
import { EditorMap, coordKey } from '../types/BoardEditor';

/**
 * The infinite-grid board editor canvas. Renders a window of the hex grid
 * (re-centered on the view as you pan), with pan + zoom. Clicking an empty
 * cell adds a hex with the selected terrain; clicking a placed cell selects
 * it. Dragging (beyond a small threshold) pans the view; the wheel zooms.
 */

const HEX_SIZE = 50; // board units per hex
const GRID_RADIUS = 8; // window radius around the view center
const PAN_THRESHOLD = 5; // screen px before a drag becomes a pan
const TOKEN_RADIUS = 16; // board units; click within this of a hex center grabs its number

interface BoardEditorCanvasProps {
  map: EditorMap;
  selectedTerrain: Terrain;
  selectedCoord: string | null;
  onSelect: (coordKey: string | null) => void;
  onAdd: (coord: CubeCoord, terrain: Terrain) => void;
  onRemove: (coordKey: string) => void;
  onMoveHex: (from: CubeCoord, to: CubeCoord) => void;
  onMoveNumber: (from: CubeCoord, to: CubeCoord) => void;
  onPlaceNumber: (coord: CubeCoord, number: number) => void;
  toolbarDrag: { kind: 'terrain' | 'number'; value: Terrain | number } | null;
}

/** All cube coords in a hexagonal region of the given radius. */
function coordsForRadius(radius: number): CubeCoord[] {
  const out: CubeCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      out.push({ q, r, s: -q - r });
    }
  }
  return out;
}

/** Inverse of cubeToPixel, with cube rounding to the nearest hex center. */
function pixelToCube(px: number, py: number, size: number): CubeCoord {
  const r = (2 / 3) * (py / size);
  const q = px / (size * Math.sqrt(3)) - r / 2;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(-q - r);
  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - (-q - r));
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return { q: rq, r: rr, s: -rq - rr };
}

const BoardEditorCanvas: React.FC<BoardEditorCanvasProps> = ({
  map,
  selectedTerrain,
  selectedCoord,
  onSelect,
  onAdd,
  onRemove,
  onMoveHex,
  onMoveNumber,
  onPlaceNumber,
  toolbarDrag,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  type DragState =
    | { kind: 'pan'; startX: number; startY: number; originX: number; originY: number; moved: boolean }
    | { kind: 'hex'; from: CubeCoord; startX: number; startY: number; moved: boolean }
    | { kind: 'number'; from: CubeCoord; value: number; startX: number; startY: number; moved: boolean };
  const dragRef = useRef<DragState | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [dragKind, setDragKind] = useState<'hex' | 'number' | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);

  const BASE_W = 900;
  const BASE_H = 650;
  const w = BASE_W / scale;
  const h = BASE_H / scale;

  // Re-center the grid window on the view center so it feels infinite.
  const centerCube = pixelToCube(center.x, center.y, HEX_SIZE);
  const windowCoords = coordsForRadius(GRID_RADIUS).map(
    (c) => ({ q: c.q + centerCube.q, r: c.r + centerCube.r, s: c.s + centerCube.s })
  );

  const boardUnitsPerScreenPx = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? w / rect.width : 1;
  }, [w]);

  // Convert a mouse event to board-space (px, py). The viewBox top-left in
  // board space is (center - size/2), so offset from there.
  const eventToBoard = useCallback(
    (e: React.MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const px = center.x - w / 2 + (e.clientX - rect.left) * boardUnitsPerScreenPx();
      const py = center.y - h / 2 + (e.clientY - rect.top) * (h / rect.height);
      return { px, py };
    },
    [center, w, h, boardUnitsPerScreenPx]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // only left-click starts a drag/pan
      const pt = eventToBoard(e);
      if (!pt) return;
      const cube = pixelToCube(pt.px, pt.py, HEX_SIZE);
      const hex = map[coordKey(cube)];
      if (hex) {
        const { x, y } = cubeToPixel(hex.coord, HEX_SIZE);
        const onToken = hex.rollNumber !== null && Math.hypot(pt.px - x, pt.py - y) <= TOKEN_RADIUS;
        if (onToken) {
          dragRef.current = { kind: 'number', from: hex.coord, value: hex.rollNumber as number, startX: e.clientX, startY: e.clientY, moved: false };
          setDragKind('number');
          setDragValue(hex.rollNumber);
        } else {
          dragRef.current = { kind: 'hex', from: hex.coord, startX: e.clientX, startY: e.clientY, moved: false };
          setDragKind('hex');
          setDragValue(null);
        }
      } else {
        dragRef.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, originX: center.x, originY: center.y, moved: false };
      }
    },
    [map, center, eventToBoard]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      d.moved = true;
      if (d.kind === 'pan') {
        const k = boardUnitsPerScreenPx();
        setCenter({ x: d.originX - dx * k, y: d.originY - dy * k });
      } else {
        const pt = eventToBoard(e);
        if (pt) setHoverKey(coordKey(pixelToCube(pt.px, pt.py, HEX_SIZE)));
      }
    },
    [boardUnitsPerScreenPx, eventToBoard]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setHoverKey(null);
      setDragKind(null);
      setDragValue(null);
      if (!d) return;
      const pt = eventToBoard(e);
      if (!pt) return;
      const cube = pixelToCube(pt.px, pt.py, HEX_SIZE);
      const key = coordKey(cube);

      if (d.kind === 'pan') {
        if (d.moved) return; // it was a pan, not a click
        if (map[key]) onSelect(key);
        else onAdd(cube, selectedTerrain);
        return;
      }

      if (!d.moved) {
        // A click on a hex (or its number token): select it.
        onSelect(coordKey(d.from));
        return;
      }

      if (d.kind === 'hex') {
        // Move the hex to the target cell if it is empty and different.
        if (key !== coordKey(d.from) && !map[key]) onMoveHex(d.from, cube);
        return;
      }

      // d.kind === 'number': drop on a valid (non-Desert/Water) hex.
      const target = map[key];
      if (key !== coordKey(d.from) && target && target.terrain !== 'Desert' && target.terrain !== 'Water') {
        onMoveNumber(d.from, cube);
      }
    },
    [map, selectedTerrain, onSelect, onAdd, onMoveHex, onMoveNumber, eventToBoard]
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setScale((s) => Math.min(3, Math.max(0.4, s * factor)));
  }, []);

  const clearDrag = () => {
    dragRef.current = null;
    setHoverKey(null);
    setDragKind(null);
    setDragValue(null);
  };

  // Clear the hover preview when a toolbar drag ends without a drop.
  useEffect(() => {
    if (!toolbarDrag) setHoverKey(null);
  }, [toolbarDrag]);

  // Native HTML5 drag-and-drop from the toolbar: drag a terrain onto an
  // empty cell to place it; drag a number onto a hex to set it.
  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!toolbarDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const pt = eventToBoard(e);
      if (pt) setHoverKey(coordKey(pixelToCube(pt.px, pt.py, HEX_SIZE)));
    },
    [toolbarDrag, eventToBoard]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setHoverKey(null);
      if (!toolbarDrag) return;
      const pt = eventToBoard(e);
      if (!pt) return;
      const cube = pixelToCube(pt.px, pt.py, HEX_SIZE);
      const key = coordKey(cube);
      if (toolbarDrag.kind === 'terrain') {
        if (!map[key]) onAdd(cube, toolbarDrag.value as Terrain);
      } else {
        const target = map[key];
        if (target && target.terrain !== 'Desert' && target.terrain !== 'Water') {
          onPlaceNumber(cube, toolbarDrag.value as number);
        }
      }
    },
    [toolbarDrag, map, onAdd, onPlaceNumber, eventToBoard]
  );

  const cells: React.ReactNode[] = [];
  for (const coord of windowCoords) {
    const key = coordKey(coord);
    const { x, y } = cubeToPixel(coord, HEX_SIZE);
    const placed = map[key];
    const isSelected = selectedCoord === key;
    const isHover = hoverKey === key && dragKind !== null;
    const isDragSource = dragKind !== null && placed && coordKey(placed.coord) === key;
    cells.push(
      <g
        key={key}
        style={{ cursor: placed ? 'grab' : 'pointer' }}
        onDoubleClick={placed ? () => onRemove(key) : undefined}
        onContextMenu={
          placed
            ? (e) => {
                e.preventDefault();
                onRemove(key);
              }
            : undefined
        }
      >
        <polygon
          points={hexPointsAt(x, y, HEX_SIZE * 0.96)}
          fill={placed ? terrainColors[placed.terrain] ?? '#eee' : 'transparent'}
          stroke={isHover ? '#16a34a' : isSelected ? '#f59e0b' : placed ? '#374151' : '#d1d5db'}
          strokeWidth={isHover || isSelected ? 4 : placed ? 2 : 1}
          strokeDasharray={placed ? undefined : '6 4'}
          opacity={dragKind === 'hex' && isDragSource ? 0.4 : 1}
        />
        {placed && placed.rollNumber !== null && (
          <circle cx={x} cy={y} r={16} fill="#fff" stroke="#111" strokeWidth={1.5} opacity={dragKind === 'number' && isDragSource ? 0.4 : 1} />
        )}
        {placed && placed.rollNumber !== null && (
          <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight="bold" fill="#111" opacity={dragKind === 'number' && isDragSource ? 0.4 : 1}>
            {placed.rollNumber}
          </text>
        )}
        {placed && placed.terrain === 'Desert' && (
          <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#92400e">
            🏜️
          </text>
        )}
      </g>
    );
  }

  // Drag preview: a ghost at the hovered cell showing the drop target.
  // Works for both in-canvas drags (dragKind) and toolbar drags (toolbarDrag).
  const activeDragKind = dragKind ?? (toolbarDrag ? toolbarDrag.kind : null);
  const previewNumber =
    dragValue ?? (toolbarDrag && toolbarDrag.kind === 'number' ? (toolbarDrag.value as number) : null);
  let preview: React.ReactNode = null;
  if (hoverKey && activeDragKind) {
    const hv = hoverKey.split(',').map(Number);
    const cube: CubeCoord = { q: hv[0], r: hv[1], s: hv[2] };
    const { x, y } = cubeToPixel(cube, HEX_SIZE);
    const occupied = !!map[hoverKey];
    const isNumber = activeDragKind === 'number';
    const valid = isNumber
      ? occupied && map[hoverKey]!.terrain !== 'Desert' && map[hoverKey]!.terrain !== 'Water'
      : !occupied;
    const isToolbarTerrain = toolbarDrag?.kind === 'terrain';
    preview = isNumber ? (
      <g opacity={0.85}>
        <circle cx={x} cy={y} r={16} fill="#fff" stroke={valid ? '#16a34a' : '#dc2626'} strokeWidth={2.5} />
        <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={16} fontWeight="bold" fill="#111">
          {previewNumber}
        </text>
      </g>
    ) : (
      <polygon
        points={hexPointsAt(x, y, HEX_SIZE * 0.96)}
        fill={isToolbarTerrain ? (terrainColors[toolbarDrag!.value as Terrain] ?? '#eee') : 'none'}
        fillOpacity={isToolbarTerrain ? 0.5 : 0}
        stroke={valid ? '#16a34a' : '#dc2626'}
        strokeWidth={3}
        strokeDasharray="8 4"
      />
    );
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${center.x - w / 2} ${center.y - h / 2} ${w} ${h}`}
      style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={clearDrag}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onWheel={onWheel}
    >
      {cells}
      {preview}
    </svg>
  );
};

export default BoardEditorCanvas;
