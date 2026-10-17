import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Terrain, cubeToPixel, DockSpec, GAME_HEX_SIZE } from 'common';
import { PORT_DOCK_SIZE, PORT_OFFSET } from '../constants';
import { BoardEditorCanvasProps, CanvasDragKind, CanvasDragState } from './types';
import {
  CANVAS_BASE_HEIGHT,
  CANVAS_BASE_WIDTH,
  HEX_SIZE,
  MAX_EDITOR_ZOOM,
  MIN_EDITOR_ZOOM,
  PAN_THRESHOLD,
  TOKEN_RADIUS,
  ZOOM_FACTOR,
} from './constants';
import { coordKey, dockSpanVertices, eventToBoardPoint, isClientPointInside, pixelToCube } from './utils';

/** Dock size + hit radii in editor units (scaled to match the game view). */
const DOCK_SIZE = (PORT_DOCK_SIZE * HEX_SIZE) / GAME_HEX_SIZE;
const DOCK_MARKER_R = DOCK_SIZE * 1.4; // port medallion is ~1.2x size
const DOCK_GRIP_R = DOCK_SIZE * 0.9;

/** Marker position = the span anchor pushed radially outward by the offset. */
function dockMarkerPos(vertices: { x: number; y: number }[]): { x: number; y: number } | null {
  if (vertices.length === 0) return null;
  const a = vertices.length === 1 ? vertices[0] : { x: (vertices[0].x + vertices[1].x) / 2, y: (vertices[0].y + vertices[1].y) / 2 };
  const dist = Math.hypot(a.x, a.y);
  const off = DOCK_SIZE * PORT_OFFSET;
  return dist > 0 ? { x: a.x + (a.x / dist) * off, y: a.y + (a.y / dist) * off } : a;
}

/**
 * All state and pointer/drag/drop/wheel handling for the board editor canvas.
 * Owns the view (center + scale), the in-progress drag (`dragRef`), the hover
 * cell used for drop previews, and the trash-can drop target. Attach the
 * returned handlers and refs to the canvas root / `<svg>` / trash overlay.
 */
export function useEditorCanvas({
  map,
  selectedTerrain,
  onSelect,
  onAdd,
  onRemove,
  onClearNumber,
  onMoveHex,
  onMoveNumber,
  onPlaceNumber,
  onPaint,
  paintMode,
  toolbarDrag,
  coast,
  docks,
  onMoveDock,
  onStretchDock,
  docksMode,
  selectedDock: _selectedDock, // render-only prop; selection lives in BoardEditor
  onSelectDock,
  onAddDock,
  onRemoveDock,
}: BoardEditorCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef<CanvasDragState | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [dragKind, setDragKind] = useState<CanvasDragKind | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [overTrash, setOverTrash] = useState(false);
  // Coast index under the cursor during a dock drag (ghost preview).
  const [hoverDockIndex, setHoverDockIndex] = useState<number | null>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const w = CANVAS_BASE_WIDTH / scale;
  const h = CANVAS_BASE_HEIGHT / scale;

  // Board units per screen pixel. With preserveAspectRatio=meet (the default),
  // the drawn view is the larger of the two dimension ratios, so pan must use
  // that — not just w/rect.width, which under-reads when letterboxed.
  const boardUnitsPerScreenPx = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return 1;
    return Math.max(w / rect.width, h / rect.height);
  }, [w, h]);

  const eventToBoard = useCallback(
    (e: React.MouseEvent | React.DragEvent) => {
      const svg = svgRef.current;
      if (!svg) return null;
      return eventToBoardPoint(svg, e);
    },
    []
  );

  // True when the pointer is over the trash-can overlay (screen coords).
  const isOverTrash = useCallback((e: React.MouseEvent) => {
    return isClientPointInside(trashRef.current, e);
  }, []);

  // Dock hit geometry, memoized: span vertices + marker center per dock.
  const dockHit = useMemo(
    () =>
      docks.map((d: DockSpec) => {
        const verts = dockSpanVertices(coast, d);
        return { verts, marker: dockMarkerPos(verts) };
      }),
    [coast, docks]
  );

  // Coast vertices not spanned by any dock — the "+" add handles in docks mode.
  const freeCoast = useMemo(() => {
    const n = coast.length;
    const used = new Set<number>();
    for (const d of docks) {
      for (const i of d.coast.slice(0, 2)) used.add(((i % n) + n) % n);
    }
    const out: number[] = [];
    for (let i = 0; i < n; i++) if (!used.has(i)) out.push(i);
    return out;
  }, [coast, docks]);

  /** Nearest coast-ring index to a board point (null when no coast). */
  const nearestCoastIndex = useCallback(
    (pt: { x: number; y: number }): number | null => {
      const n = coast.length;
      if (n === 0) return null;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(pt.x - coast[i].x, pt.y - coast[i].y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    [coast]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return; // only left-click starts a drag/pan
      const pt = eventToBoard(e);
      if (!pt) return;

      // Dock interactions only exist while the Docks tab is active: a
      // span-end grip or the marker is a small target the hex under it
      // would otherwise swallow; a free coast vertex adds a new dock.
      if (docksMode) {
        for (let i = 0; i < dockHit.length; i++) {
          const { verts, marker } = dockHit[i];
          for (let end = 0; end < verts.length; end++) {
            if (Math.hypot(pt.px - verts[end].x, pt.py - verts[end].y) <= DOCK_GRIP_R) {
              dragRef.current = { kind: 'dockEnd', dockIndex: i, end: end as 0 | 1, startX: e.clientX, startY: e.clientY, moved: false };
              setDragKind('dockEnd');
              setDragValue(null);
              return;
            }
          }
          // A 1-vertex dock gets a ghost extension handle on the next ring
          // vertex — grabbing it stretches the dock to 2.
          if (docks[i].coast.length === 1 && coast.length > 1) {
            const s = ((docks[i].coast[0] % coast.length) + coast.length) % coast.length;
            const ghost = coast[(s + 1) % coast.length];
            if (ghost && Math.hypot(pt.px - ghost.x, pt.py - ghost.y) <= DOCK_GRIP_R) {
              dragRef.current = { kind: 'dockEnd', dockIndex: i, end: 1, startX: e.clientX, startY: e.clientY, moved: false };
              setDragKind('dockEnd');
              setDragValue(null);
              return;
            }
          }
          if (marker && Math.hypot(pt.px - marker.x, pt.py - marker.y) <= DOCK_MARKER_R) {
            dragRef.current = { kind: 'dock', dockIndex: i, startX: e.clientX, startY: e.clientY, moved: false };
            setDragKind('dock');
            setDragValue(null);
            return;
          }
        }
        // Free coast vertices are "+" add handles.
        for (const i of freeCoast) {
          if (Math.hypot(pt.px - coast[i].x, pt.py - coast[i].y) <= DOCK_GRIP_R * 1.2) {
            dragRef.current = { kind: 'dockAdd', coastIndex: i, startX: e.clientX, startY: e.clientY, moved: false };
            setDragKind('dockAdd');
            setDragValue(null);
            return;
          }
        }
      }

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
    [map, center, eventToBoard, dockHit, docks, coast, docksMode, freeCoast]
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
      } else if (d.kind === 'dock' || d.kind === 'dockEnd' || d.kind === 'dockAdd') {
        const pt = eventToBoard(e);
        if (pt) setHoverDockIndex(nearestCoastIndex({ x: pt.px, y: pt.py }));
      } else {
        const pt = eventToBoard(e);
        if (pt) setHoverKey(coordKey(pixelToCube(pt.px, pt.py, HEX_SIZE)));
        setOverTrash(isOverTrash(e));
      }
    },
    [boardUnitsPerScreenPx, eventToBoard, isOverTrash, nearestCoastIndex]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setHoverKey(null);
      setHoverDockIndex(null);
      setDragKind(null);
      setDragValue(null);
      setOverTrash(false);
      if (!d) return;
      const pt = eventToBoard(e);
      if (!pt) return;
      const cube = pixelToCube(pt.px, pt.py, HEX_SIZE);
      const key = coordKey(cube);

      // Drop on the trash can: delete the hex / clear the number / remove the dock.
      if (d.moved && (d.kind === 'hex' || d.kind === 'number' || d.kind === 'dock' || d.kind === 'dockEnd') && isOverTrash(e)) {
        if (d.kind === 'hex') onRemove(coordKey(d.from));
        else if (d.kind === 'number') onClearNumber(coordKey(d.from));
        else onRemoveDock(d.dockIndex);
        return;
      }

      if (d.kind === 'pan') {
        if (d.moved) return; // it was a pan, not a click
        if (map[key]) onSelect(key);
        else if (paintMode) onAdd(cube, selectedTerrain);
        else if (docksMode) onSelectDock(null); // empty space: clear dock selection
        return;
      }

      if (!d.moved) {
        if (d.kind === 'dock' || d.kind === 'dockEnd') {
          onSelectDock(d.dockIndex); // click a dock: select it for the palette
          return;
        }
        if (d.kind === 'dockAdd') {
          onAddDock(d.coastIndex); // click a "+" handle: place a dock there
          return;
        }
        // A click on a hex (or its number token): paint it (paint mode) and/or
        // select it.
        if (paintMode) onPaint(d.from);
        onSelect(coordKey(d.from));
        return;
      }

      // Dock drags land on the nearest coast vertex: a body drag moves the
      // whole span there; an end-grip drag stretches/shrinks/re-anchors it.
      if (d.kind === 'dock' || d.kind === 'dockAdd') {
        const i = nearestCoastIndex({ x: pt.px, y: pt.py });
        if (i === null) return;
        if (d.kind === 'dock') onMoveDock(d.dockIndex, i);
        else onAddDock(i);
        return;
      }
      if (d.kind === 'dockEnd') {
        const i = nearestCoastIndex({ x: pt.px, y: pt.py });
        if (i !== null) onStretchDock(d.dockIndex, d.end, i);
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
    [map, selectedTerrain, docksMode, onSelect, onSelectDock, onAdd, onAddDock, onMoveHex, onMoveNumber, onMoveDock, onStretchDock, onRemoveDock, onPaint, paintMode, eventToBoard, isOverTrash, onRemove, onClearNumber, nearestCoastIndex]
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    setScale((s) => Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, s * factor)));
  }, []);

  const clearDrag = () => {
    dragRef.current = null;
    setHoverKey(null);
    setHoverDockIndex(null);
    setDragKind(null);
    setDragValue(null);
    setOverTrash(false);
  };

  // Clear the hover preview when a toolbar drag ends without a drop.
  useEffect(() => {
    if (!toolbarDrag) {
      setHoverKey(null);
      setHoverDockIndex(null);
    }
  }, [toolbarDrag]);

  // Native HTML5 drag-and-drop from the toolbar: drag a terrain onto an
  // empty cell to place it; drag a number onto a hex to set it.
  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!toolbarDrag) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const pt = eventToBoard(e);
      if (!pt) return;
      if (toolbarDrag.kind === 'port') {
        // Port chips target coast vertices, not hex cells.
        setHoverDockIndex(nearestCoastIndex({ x: pt.px, y: pt.py }));
      } else {
        setHoverKey(coordKey(pixelToCube(pt.px, pt.py, HEX_SIZE)));
      }
    },
    [toolbarDrag, eventToBoard, nearestCoastIndex]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setHoverKey(null);
      setHoverDockIndex(null);
      if (!toolbarDrag) return;
      const pt = eventToBoard(e);
      if (!pt) return;
      if (toolbarDrag.kind === 'port') {
        // Dropping a port chip on the coast adds a dock there.
        const i = nearestCoastIndex({ x: pt.px, y: pt.py });
        if (i !== null) onAddDock(i);
        return;
      }
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
    [toolbarDrag, map, onAdd, onAddDock, onPlaceNumber, eventToBoard, nearestCoastIndex]
  );

  return {
    svgRef,
    trashRef,
    center,
    viewWidth: w,
    viewHeight: h,
    hoverKey,
    hoverDockIndex,
    dockHit,
    freeCoast,
    dragKind,
    dragValue,
    overTrash,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    clearDrag,
    onDragOver,
    onDrop,
    onWheel,
  };
}
