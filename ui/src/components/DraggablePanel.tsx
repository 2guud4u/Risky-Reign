import React, { useEffect, useRef, useState } from 'react';

interface DraggablePanelProps {
  children: React.ReactNode;
  /** Optional extra classes for the panel container. */
  className?: string;
  /** Tooltip text shown on the grip. */
  title?: string;
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
 */
const DraggablePanel: React.FC<DraggablePanelProps> = ({
  children,
  className = '',
  title = 'Drag to move',
  minWidth = 160,
  minHeight = 80,
}) => {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
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

  return (
    <div
      ref={panelRef}
      className={`${className} ${pos ? 'fixed max-h-[calc(100vh-2rem)] overflow-y-auto shadow-lg z-50' : ''}`}
      style={{
        ...(pos ? { left: pos.x, top: pos.y } : {}),
        ...(size ? { width: size.w, height: size.h } : {}),
      }}
    >
      {/* Grip handle */}
      <div
        className="flex items-center justify-center py-1 cursor-move select-none text-gray-400 hover:text-gray-600"
        onPointerDown={startDrag}
        title={title}
      >
        <span className="text-lg leading-none">⠿</span>
      </div>
      {children}
      {/* Resize handle (top-left corner) */}
      <div
        className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize select-none z-10"
        onPointerDown={startResize}
        title="Drag to resize"
      >
        <svg viewBox="0 0 16 16" className="w-full h-full text-gray-300 hover:text-gray-500">
          <path d="M2 2 L8 2 M2 2 L5 5 M2 2 L2 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
    </div>
  );
};

export default DraggablePanel;
