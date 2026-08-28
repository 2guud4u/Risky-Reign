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

/** Event (fired on `window`) that resets every DraggablePanel's layout. */
export const RESET_PANELS_EVENT = 'panel-layout:reset';

/** Reset the position/size of every DraggablePanel back to its default. */
export const resetAllPanels = (): void => {
  window.dispatchEvent(new Event(RESET_PANELS_EVENT));
};

/**
 * Reusable wrapper that makes its content draggable via a grip handle at the
 * top and resizable via a corner handle at the top-left. In normal flow the
 * panel sits in the page at its natural content size (it always fits its
 * children). Once a grip drag is recognized the panel is pinned to that
 * natural size and becomes fixed-position so it floats above other content;
 * it can then be resized, which may make it smaller than its content. A
 * small movement threshold ensures child clicks still work when the gesture
 * starts on them. Dragging is unclamped — a panel can be moved anywhere,
 * including off-screen — and `resetAllPanels` restores every panel.
 *
 * When an `id` is provided, the panel's position/size are remembered in
 * sessionStorage so the layout survives a reload; resetting clears it.
 *
 * "Collapse" hides the panel's actions — grip drag and the resize handle —
 * leaving a compact grip; the content stays visible and the grip (or the ▸
 * button) expands it again.
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

  // Reset this panel whenever a global reset is requested (see resetAllPanels).
  useEffect(() => {
    const onReset = () => {
      setPos(null);
      setSize(null);
      if (id) {
        // Clear the saved layout so the next reload also starts fresh.
        savePanelLayout(id, { pos: null, size: null });
      }
    };
    window.addEventListener(RESET_PANELS_EVENT, onReset);
    return () => window.removeEventListener(RESET_PANELS_EVENT, onReset);
  }, [id]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // Promote a pending drag once the pointer moved far enough.
      const p = pendingDragRef.current;
      if (p && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > DRAG_THRESHOLD) {
        dragRef.current = p;
        pendingDragRef.current = null;
        // Pin the panel to its natural size the moment the drag is recognized
        // so it immediately fits its children once it floats (clamped to the
        // resize minimums). The panel is still in normal flow here, so this
        // rect is its full content size and matches its drawn position; the
        // position update below moves it from there.
        const el = panelRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          setPos({ x: rect.left, y: rect.top });
          setSize({ w: Math.max(minWidth, rect.width), h: Math.max(minHeight, rect.height) });
        }
      }

      // Move the panel (unclamped: it can go anywhere, including off-screen).
      const d = dragRef.current;
      if (d) {
        setPos({
          x: d.origX + e.clientX - d.startX,
          y: d.origY + e.clientY - d.startY,
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
          x: r.origX + (e.clientX - r.startX),
          y: r.origY + (e.clientY - r.startY),
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

  return (
    <div
      ref={panelRef}
      className={`${className} ${pos ? 'fixed max-h-[calc(95vh-2rem)] overflow-y-auto shadow-lg z-50' : 'relative'}`}
      style={{
        ...(pos ? { left: pos.x, top: pos.y } : {}),
        // `size` is only set once the panel is floating (drag promotion,
        // resize, or a restored layout), so the width/height here always
        // accompany a fixed position. In normal flow the panel keeps its
        // natural content size and stays in the page flow.
        ...(size ? { width: size.w, height: size.h } : {}),
      }}
    >
      {/* Grip handle: drag to move; hosts the Collapse control on the right.
          Collapsed, the grip stops being draggable and clicking it (or the ▸
          button) expands the actions again. */}
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
