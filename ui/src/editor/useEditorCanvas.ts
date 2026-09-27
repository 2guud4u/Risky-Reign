import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Terrain, cubeToPixel } from 'common';
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
import { coordKey, eventToBoardPoint, isClientPointInside, pixelToCube } from './utils';

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
}: BoardEditorCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragRef = useRef<CanvasDragState | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [dragKind, setDragKind] = useState<CanvasDragKind | null>(null);
  const [dragValue, setDragValue] = useState<number | null>(null);
  const [overTrash, setOverTrash] = useState(false);
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
        setOverTrash(isOverTrash(e));
      }
    },
    [boardUnitsPerScreenPx, eventToBoard, isOverTrash]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setHoverKey(null);
      setDragKind(null);
      setDragValue(null);
      setOverTrash(false);
      if (!d) return;
      const pt = eventToBoard(e);
      if (!pt) return;
      const cube = pixelToCube(pt.px, pt.py, HEX_SIZE);
      const key = coordKey(cube);

      // Drop on the trash can: delete the hex / clear the number.
      if (d.moved && (d.kind === 'hex' || d.kind === 'number') && isOverTrash(e)) {
        if (d.kind === 'hex') onRemove(coordKey(d.from));
        else onClearNumber(coordKey(d.from));
        return;
      }

      if (d.kind === 'pan') {
        if (d.moved) return; // it was a pan, not a click
        if (map[key]) onSelect(key);
        else if (paintMode) onAdd(cube, selectedTerrain);
        return;
      }

      if (!d.moved) {
        // A click on a hex (or its number token): paint it (paint mode) and/or
        // select it.
        if (paintMode) onPaint(d.from);
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
    [map, selectedTerrain, onSelect, onAdd, onMoveHex, onMoveNumber, onPaint, paintMode, eventToBoard, isOverTrash, onRemove, onClearNumber]
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
    setScale((s) => Math.min(MAX_EDITOR_ZOOM, Math.max(MIN_EDITOR_ZOOM, s * factor)));
  }, []);

  const clearDrag = () => {
    dragRef.current = null;
    setHoverKey(null);
    setDragKind(null);
    setDragValue(null);
    setOverTrash(false);
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

  return {
    svgRef,
    trashRef,
    center,
    viewWidth: w,
    viewHeight: h,
    hoverKey,
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
