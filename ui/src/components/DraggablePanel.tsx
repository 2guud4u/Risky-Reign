import React, { useEffect, useRef, useState } from 'react';
import { loadPanelLayout, savePanelLayout } from '../utils/panelLayout';

interface DraggablePanelProps {
  children: React.ReactNode;
  /** Optional extra classes for the panel container. */
  className?: string;
  /** Tooltip text shown on the grip (also used as the persistence key). */
  title?: string;
  /** Stable key for persisting the layout; defaults to the panel's title. */
  id?: string;
  /** Minimum width in px when resizing (default 160). */
  minWidth?: number;
  /** Minimum height in px when resizing (default 80). */
  minHeight?: number;
}

/** Minimum pointer movement (px) before a press counts as a drag instead of a click. */
const DRAG_THRESHOLD = 5;

/**
 * Reusable wrapper that makes its content draggable via a grip handle at the
 * top and resizable via a corner handle at the bottom-right. Before
 * interaction, the panel keeps its normal layout size/position; once dragged
 * it becomes fixed-position (and fixed-size if resized) and floats above
 * other content. A small movement threshold ensures child clicks still work
 * when the gesture starts on them.
 *
 * When an `id` is provided, the panel's position/size are remembered in
 * sessionStorage so the layout survives a reload; "Reset" restores the default.
 *
 * "Collapse" (to the right of Reset) hides the panel's actions — grip drag,
 * Reset, and the resize handle — leaving a compact grip; the content stays
 * visible and the grip (or the ▸ button) expands it again.
 */
const DraggablePanel: React.FC<DraggablePanelProps> = ({
  children,
  className = '',
  title = 'Drag to move',
  id,
  minWidth = 160,
  minHeight = 80,
}) => {
  // Restore any persisted layout on first render.
  const [saved] = useState(() => (id ? loadPanelLayout(id) : null));
  const [pos, setPos] = useState<{ x: number; y: number } | null>(saved?.pos ?? null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(saved?.size ?? null);
  const [collapsed, setCollapsed] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pendingDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // Persist the layout whenever it changes (only when the panel is floating).
  useEffect(() => {
    if (!id) return;
    if (pos || size) savePanelLayout(id, { pos, size });
  }, [id, pos, size]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Promote a pending drag once the pointer moved far enough.
      const p = pendingDragRef.current;
      if (p && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > DRAG_THRESHOLD) {
        dragRef.current = p;
        pendingDragRef.current = null;
      }

      // Move the panel.
      const d = dragRef.current;
      if (d && panelRef.current) {
        const w = panelRef.current.offsetWidth;
        setPos({
          x: Math.min(Math.max(0, d.origX + e.clientX - d.startX), window.innerWidth - w),
          y: Math.min(Math.max(0, d.origY + e.clientY - d.startY), window.innerHeight - 48),
        });
      }

      // Resize the panel from its top-left corner: dragging left/up grows it,
      // and the panel position follows the corner.
      const r = resizeRef.current;
      if (r) {
        const w = Math.max(minWidth, r.origW - (e.clientX - r.startX));
        const h = Math.max(minHeight, r.origH - (e.clientY - r.startY));
        setSize({ w, h });
        setPos({
          x: Math.min(Math.max(0, r.origX + (e.clientX - r.startX)), window.innerWidth - w),
          y: Math.min(Math.max(0, r.origY + (e.clientY - r.startY)), window.innerHeight - 48),
        });
      }
    };
    const onUp = () => {
      if (dragRef.current) {
        // Swallow the click event that follows a real drag so buttons/links
        // under the pointer don't fire by accident.
        const suppressClick = (e: Event) => {
          e.stopPropagation();
          e.preventDefault();
          window.removeEventListener('click', suppressClick, true);
        };
        window.addEventListener('click', suppressClick, true);
      }
      dragRef.current = null;
      pendingDragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [minWidth, minHeight]);

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // left button only
    e.stopPropagation();
    const rect = panelRef.current?.getBoundingClientRect();
    pendingDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos ? pos.x : (rect?.left ?? 0),
      origY: pos ? pos.y : (rect?.top ?? 0),
    };
  };

  const startResize = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // left button only
    e.stopPropagation();
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos ? pos.x : rect.left,
      origY: pos ? pos.y : rect.top,
      origW: rect.width,
      origH: rect.height,
    };
  };

  const resetLayout = () => {
    setPos(null);
    setSize(null);
    if (id) {
      // Clear the saved layout so the next reload also starts fresh.
      savePanelLayout(id, { pos: null, size: null });
    }
  };

  return (
    <div
      ref={panelRef}
      className={`${className} ${pos ? 'fixed max-h-[calc(100vh-2rem)] overflow-y-auto shadow-lg z-50' : ''}`}
      style={{
        ...(pos ? { left: pos.x, top: pos.y } : {}),
        ...(size ? { width: size.w, height: size.h } : {}),
      }}
    >
      {/* Grip handle: drag to move; hosts the Reset and Collapse controls on
          the right. Collapsed, the grip stops being draggable and clicking
          it (or the ▸ button) expands the actions again. */}
      <div
        className={`relative flex items-center justify-center py-1 select-none text-gray-400 hover:text-gray-600 ${
          collapsed ? 'cursor-pointer' : 'cursor-move'
        }`}
        onPointerDown={collapsed ? undefined : startDrag}
        onClick={collapsed ? () => setCollapsed(false) : undefined}
        title={collapsed ? `Click to expand — ${title}` : title}
      >
        {collapsed ? (
          <span className="text-[13px] leading-none tracking-widest">•••</span>
        ) : (
          <span className="text-lg leading-none">⠿</span>
        )}
        <span className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {!collapsed && (pos || size) && (
            <button
              type="button"
              onClick={resetLayout}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-[10px] font-semibold cursor-pointer hover:text-gray-700"
              title="Reset position and size"
            >
              Reset
            </button>
          )}
          {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            onPointerDown={(e) => e.stopPropagation()}
            className="text-[13px] leading-none cursor-pointer hover:text-gray-700"
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {'▾'}
          </button>
          )}
        </span>
      </div>
      {children}
      {/* Resize handle (top-left corner) */}
      {!collapsed && (
        <div
          className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize select-none z-10"
          onPointerDown={startResize}
          title="Drag to resize"
        >
          <svg viewBox="0 0 16 16" className="w-full h-full text-gray-300 hover:text-gray-500">
            <path d="M2 2 L8 2 M2 2 L5 5 M2 2 L2 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default DraggablePanel;
