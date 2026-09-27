import React from 'react';
import { useDraggable } from '../hooks/useDraggable';
import { DraggablePanelProps } from '../types/draggablePanel';
import { PANEL_MIN_W, PANEL_MIN_H } from '../constants';

/**
 * A floating panel: always `position: fixed`, draggable by its grip,
 * resizable from its top-right corner, collapsible to a compact bar.
 *
 * On mount the panel is hidden at the origin, measures its natural size
 * (reported via `onMeasure`), then places itself at `layout` — its home
 * rect, computed by the parent from the viewport. Because every panel is
 * floating from the first frame, dragging one can never reflow the others.
 *
 * A placed panel follows its home rect while the user hasn't moved it
 * (e.g. on window resize); once the user drags or resizes it, it keeps
 * the user's position/size. With an `id`, the position/size are remembered
 * in sessionStorage across reloads; `resetAllPanels` restores every panel
 * to its home rect.
 */
const DraggablePanel: React.FC<DraggablePanelProps> = ({
  children,
  className = '',
  id,
  minWidth = PANEL_MIN_W,
  minHeight = PANEL_MIN_H,
  layout,
  onMeasure,
  followContent = false,
}) => {
  const {
    panelRef,
    contentRef,
    pos,
    size,
    collapsed,
    setCollapsed,
    dragging,
    placed,
    userResized,
    startDrag,
    startResize,
  } = useDraggable({ id, minWidth, minHeight, layout, onMeasure, followContent });

  return (
    <div
      ref={panelRef}
      className={`${className} fixed shadow-lg flex flex-col`}
      style={{
        left: pos ? pos.x : 0,
        top: pos ? pos.y : 0,
        ...(size && !collapsed
          ? {
              width: size.w,
              // Auto-height panels have no explicit height cap (they size to
              // their content); a user resize pins the height.
              ...(followContent && !userResized ? {} : { height: size.h }),
            }
          : {}),
        ...(dragging ? { zIndex: 50 } : {}),
        visibility: placed ? undefined : 'hidden',
      }}
    >
      {collapsed ? (
        <div className="flex items-center h-8 pl-1 pr-3 bg-white border border-gray-300 rounded-md shadow">
          {/* Grip: the drag handle, inside the collapsed bar. */}
          <span
            className="inline-flex h-8 w-6 shrink-0 items-center justify-center cursor-move text-gray-400 text-xs select-none"
            onPointerDown={startDrag}
            title="Drag to move"
          >
            {'⠿'}
          </span>
          <button
            type="button"
            className="flex-1 text-left text-[13px] font-semibold text-gray-600 cursor-pointer hover:opacity-70"
            onClick={() => setCollapsed(false)}
            title="Expand panel"
          >
            {id ?? 'Panel'} {'▸'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center gap-1 px-2 pt-1 pb-1">
            {/* Grip: the drag handle (top-left, inside the card). */}
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 cursor-move text-xs select-none"
              onPointerDown={startDrag}
              title="Drag to move"
            >
              {'⠿'}
            </span>
            {id && <span className="text-[11px] uppercase tracking-wide text-gray-400">{id}</span>}
            <div className="flex-1" />
            {id && (
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xs leading-none px-1"
                onClick={() => setCollapsed(true)}
                title="Collapse panel"
              >
                {'▾'}
              </button>
            )}
            {/* Resize handle: top-right, inside the card. */}
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 hover:text-gray-600 cursor-nesw-resize text-[10px] select-none"
              onPointerDown={startResize}
              title="Drag to resize"
            >
              {'⤡'}
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <div ref={contentRef} className="h-full">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DraggablePanel;
