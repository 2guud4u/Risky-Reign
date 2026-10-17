import React from 'react';
import { Terrain, hexCoordsForRadius, GAME_HEX_SIZE } from 'common';
import { PORT_DOCK_SIZE } from '../constants';
import { BoardEditorCanvasProps } from './types';
import { GRID_RADIUS, HEX_SIZE } from './constants';
import { coordKey, pixelToCube } from './utils';
import { useEditorCanvas } from './useEditorCanvas';
import { PortDock } from '../components/PortDock';
import EditorHexCell from './EditorHexCell';
import DragPreview from './DragPreview';
import TrashCan from './TrashCan';

/** Port size scaled to editor units (matches the game's proportions). */
const DOCK_SIZE = (PORT_DOCK_SIZE * HEX_SIZE) / GAME_HEX_SIZE;
const DOCK_GRIP_R = DOCK_SIZE * 0.9;

/**
 * The infinite-grid board editor canvas. Renders a window of the hex grid
 * (re-centered on the view as you pan), with pan + zoom. Clicking an empty
 * cell adds a hex with the selected terrain; clicking a placed cell selects
 * it. Dragging (beyond a small threshold) pans the view; the wheel zooms.
 */
const BoardEditorCanvas: React.FC<BoardEditorCanvasProps> = (props) => {
  const { map, selectedCoord, onRemove, toolbarDrag, docks, coast, docksMode, selectedDock } = props;
  const {
    svgRef,
    trashRef,
    center,
    viewWidth,
    viewHeight,
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
  } = useEditorCanvas(props);

  // Re-center the grid window on the view center so it feels infinite.
  const centerCube = pixelToCube(center.x, center.y, HEX_SIZE);
  const windowCoords = hexCoordsForRadius(GRID_RADIUS).map(
    (c) => ({ q: c.q + centerCube.q, r: c.r + centerCube.r, s: c.s + centerCube.s })
  );

  // Drag preview: a ghost at the hovered cell showing the drop target.
  // Works for both in-canvas drags (dragKind) and toolbar drags (toolbarDrag).
  const cellDragKind = dragKind === 'hex' || dragKind === 'number' ? dragKind : null;
  const activeDragKind =
    cellDragKind ?? (toolbarDrag && toolbarDrag.kind !== 'port' ? toolbarDrag.kind : null);
  const previewNumber =
    dragValue ?? (toolbarDrag && toolbarDrag.kind === 'number' ? (toolbarDrag.value as number) : null);


  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`${center.x - viewWidth / 2} ${center.y - viewHeight / 2} ${viewWidth} ${viewHeight}`}
        style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block', userSelect: 'none' }}
        onDragStart={(e) => e.preventDefault()}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={clearDrag}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onWheel={onWheel}
      >
        {windowCoords.map((coord) => {
          const key = coordKey(coord);
          const placed = map[key];
          return (
            <EditorHexCell
              key={key}
              cellKey={key}
              coord={coord}
              placed={placed}
              isSelected={selectedCoord === key}
              isHover={hoverKey === key && cellDragKind !== null}
              isDragSource={cellDragKind !== null && !!placed && coordKey(placed.coord) === key}
              dragKind={cellDragKind}
              onRemove={onRemove}
            />
          );
        })}

        {/* Port docks on the coast ring: the real harbor marker (non-
            interactive so the canvas owns the drag), an end-grip on each
            span vertex for stretching, and a ghost extension handle for
            1-vertex docks. */}
        {dockHit.map(({ verts, marker }, i) => {
          if (verts.length === 0) return null;
          const dock = docks[i];
          return (
            <g key={`dock-${i}`}>
              <PortDock vertices={verts} port={dock.port} size={DOCK_SIZE} interactive={false} />
              {docksMode && i === selectedDock && marker && (
                // Selection halo on the active dock's marker.
                <circle cx={marker.x} cy={marker.y} r={DOCK_SIZE * 1.6} fill="none" stroke="#4363d8" strokeWidth={2} />
              )}
              {docksMode && verts.map((v, end) => (
                <circle
                  key={end}
                  cx={v.x}
                  cy={v.y}
                  r={DOCK_GRIP_R}
                  fill="#0a2434"
                  fillOpacity={0.55}
                  stroke="#fff"
                  strokeWidth={1}
                  style={{ cursor: 'grab' }}
                />
              ))}
              {docksMode && dock.coast.length === 1 && coast.length > 1 && (
                <circle
                  cx={coast[(((dock.coast[0] % coast.length) + coast.length) % coast.length + 1) % coast.length].x}
                  cy={coast[(((dock.coast[0] % coast.length) + coast.length) % coast.length + 1) % coast.length].y}
                  r={DOCK_GRIP_R}
                  fill="none"
                  stroke="#0a2434"
                  strokeWidth={1.2}
                  strokeDasharray="2 2"
                  style={{ cursor: 'grab' }}
                />
              )}
            </g>
          );
        })}
        {/* "+" handles on free coast vertices (docks tab only): click or
            drag one to place a new dock there. */}
        {docksMode && freeCoast.map((i) => (
          <g key={`free-${i}`} style={{ cursor: 'pointer' }}>
            <circle
              cx={coast[i].x}
              cy={coast[i].y}
              r={DOCK_GRIP_R}
              fill="#fff"
              fillOpacity={0.55}
              stroke="#0a2434"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <text
              x={coast[i].x}
              y={coast[i].y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={DOCK_GRIP_R * 1.4}
              fill="#0a2434"
              style={{ pointerEvents: 'none' }}
            >
              +
            </text>
          </g>
        ))}
        {/* Ghost dot at the coast vertex a dock drag would land on. */}
        {hoverDockIndex !== null && coast[hoverDockIndex] && (
          <circle
            cx={coast[hoverDockIndex].x}
            cy={coast[hoverDockIndex].y}
            r={DOCK_GRIP_R * 1.4}
            fill="#0a2434"
            fillOpacity={0.25}
          />
        )}

        {hoverKey && activeDragKind && (
          <DragPreview
            hoverKey={hoverKey}
            activeDragKind={activeDragKind}
            previewNumber={previewNumber}
            isToolbarTerrain={toolbarDrag?.kind === 'terrain'}
            toolbarTerrain={toolbarDrag?.kind === 'terrain' ? (toolbarDrag.value as Terrain) : null}
            map={map}
          />
        )}
      </svg>
      {/* Trash can: drop a dragged hex (deletes it) or number (clears it) here. */}
      <TrashCan ref={trashRef} draggingDeletable={dragKind === 'hex' || dragKind === 'number' || dragKind === 'dock' || dragKind === 'dockEnd'} overTrash={overTrash} />
    </div>
  );
};

export default BoardEditorCanvas;
