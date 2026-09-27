import type React from 'react';

/** Persisted DraggablePanel position/size, so the layout survives a reload. */
export interface SavedPanelLayout {
  pos: { x: number; y: number } | null;
  size: { w: number; h: number } | null;
}

/** A panel's home rect: origin + optional width/height (natural size when omitted). */
export interface DefaultRect {
  x: number;
  y: number;
  /** Omit to keep the panel's natural width. */
  w?: number;
  /** Omit to keep the panel's natural height. */
  h?: number;
}

export interface DraggablePanelProps {
  children: React.ReactNode;
  /** Optional extra classes for the panel container. */
  className?: string;
  /** Stable key for persisting the layout. */
  id?: string;
  /** Minimum width in px when resizing (default `PANEL_MIN_W`). */
  minWidth?: number;
  /** Minimum height in px when resizing (default `PANEL_MIN_H`). */
  minHeight?: number;
  /**
   * The panel's home rect, computed by the parent from the viewport.
   * While `layout` is null (the parent is still measuring natural sizes)
   * the panel stays hidden at the origin.
   */
  layout: DefaultRect | null;
  /** Reports the panel's natural (content) size once measured. */
  onMeasure?: (size: { w: number; h: number }) => void;
  /**
   * Auto-height: the panel's height always equals its content's natural
   * height (no explicit height cap), so the content is never clipped. The
   * panel reports its live height via `onMeasure` so the parent's stack
   * follows. A user resize pins the height; a reset restores auto-height.
   * For panels whose home rect height is not their natural height (board,
   * sidebar column) this must stay off.
   */
  followContent?: boolean;
}

/** Options for the `useDraggable` panel logic hook. */
export interface UseDraggableOptions {
  /** Stable key for persisting the layout. */
  id?: string;
  /** Minimum width in px when resizing. */
  minWidth: number;
  /** Minimum height in px when resizing. */
  minHeight: number;
  /** The panel's home rect, computed by the parent from the viewport. */
  layout: DefaultRect | null;
  /** Reports the panel's natural (content) size once measured. */
  onMeasure?: (size: { w: number; h: number }) => void;
  /** Auto-height: the panel's height always equals its content's natural height. */
  followContent?: boolean;
}

/** State and handlers produced by `useDraggable` for the panel's markup. */
export interface UseDraggableResult {
  /** Attach to the panel's outer element (measured for size/position). */
  panelRef: React.RefObject<HTMLDivElement>;
  /** Attach to the element wrapping the panel's content. */
  contentRef: React.RefObject<HTMLDivElement>;
  /** Current position (null while the panel is hidden at the origin). */
  pos: { x: number; y: number } | null;
  /** Current size (null while the panel is at auto size). */
  size: { w: number; h: number } | null;
  /** Whether the panel is collapsed to its compact bar. */
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  /** Whether the panel is currently being dragged (raises its z-index). */
  dragging: boolean;
  /** Whether the panel has been placed (positioned) yet. */
  placed: boolean;
  /** Whether the user has resized the panel (pins its height). */
  userResized: boolean;
  /** Grip handler: start dragging the panel. */
  startDrag: (e: React.PointerEvent) => void;
  /** Handle handler: start resizing the panel. */
  startResize: (e: React.PointerEvent) => void;
}
