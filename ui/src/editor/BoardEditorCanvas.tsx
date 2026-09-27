import React from 'react';
import { Terrain, hexCoordsForRadius } from 'common';
import { BoardEditorCanvasProps } from './types';
import { GRID_RADIUS, HEX_SIZE } from './constants';
import { coordKey, pixelToCube } from './utils';
import { useEditorCanvas } from './useEditorCanvas';
import EditorHexCell from './EditorHexCell';
import DragPreview from './DragPreview';
import TrashCan from './TrashCan';

/**
 * The infinite-grid board editor canvas. Renders a window of the hex grid
 * (re-centered on the view as you pan), with pan + zoom. Clicking an empty
 * cell adds a hex with the selected terrain; clicking a placed cell selects
 * it. Dragging (beyond a small threshold) pans the view; the wheel zooms.
 */
const BoardEditorCanvas: React.FC<BoardEditorCanvasProps> = (props) => {
  const { map, selectedCoord, onRemove, toolbarDrag } = props;
  const {
    svgRef,
    trashRef,
    center,
    viewWidth,
    viewHeight,
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
  } = useEditorCanvas(props);

  // Re-center the grid window on the view center so it feels infinite.
  const centerCube = pixelToCube(center.x, center.y, HEX_SIZE);
  const windowCoords = hexCoordsForRadius(GRID_RADIUS).map(
    (c) => ({ q: c.q + centerCube.q, r: c.r + centerCube.r, s: c.s + centerCube.s })
  );

  // Drag preview: a ghost at the hovered cell showing the drop target.
  // Works for both in-canvas drags (dragKind) and toolbar drags (toolbarDrag).
  const activeDragKind = dragKind ?? (toolbarDrag ? toolbarDrag.kind : null);
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
              isHover={hoverKey === key && dragKind !== null}
              isDragSource={dragKind !== null && !!placed && coordKey(placed.coord) === key}
              dragKind={dragKind}
              onRemove={onRemove}
            />
          );
        })}
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
      <TrashCan ref={trashRef} draggingDeletable={dragKind === 'hex' || dragKind === 'number'} overTrash={overTrash} />
    </div>
  );
};

export default BoardEditorCanvas;
