import React from 'react';
import { edgeMiniLayout, miniMapViewBox, vertexMiniLayout } from '../utils/miniMap';
import { MiniViewProps } from '../types/miniMap';
import { MiniHexTile } from './miniMap/MiniHexTile';
import { VertexNeighborhood } from './miniMap/VertexNeighborhood';
import { EdgeNeighborhood } from './miniMap/EdgeNeighborhood';

/**
 * Small SVG preview of the selected board object and its immediate
 * neighborhood: the adjacent hexes (terrain-colored, with tokens), the
 * incident edges and neighboring vertices — including owned roads (tinted
 * in the road owner's color) and settlements/cities (in the owner's
 * color) — with the selection highlighted.
 */
const MiniView: React.FC<MiniViewProps> = ({
  board,
  type,
  id,
  playerColors,
  onSoldierClick,
  selectedSoldierIds,
  selectableSoldierIds,
  canActSoldierIds,
  showGarrisonedSoldiers = true,
  children,
  svgRef,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  minViewSize,
  currentPlayer,
}) => {
  const vertexLayout =
    type === 'vertex' ? vertexMiniLayout(board, id, showGarrisonedSoldiers) : null;
  const edgeLayout = type === 'edge' ? edgeMiniLayout(board, id) : null;
  const layout = vertexLayout ?? edgeLayout;
  if (!layout) return null;

  // Center the view on the selected object (vertex position or edge
  // midpoint), sized to fit everything while keeping the focus centered.
  const viewBox = miniMapViewBox(layout.points, layout.focus, minViewSize);
  if (!viewBox) return null;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="auto"
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.size} ${viewBox.size}`}
      className="mx-auto rounded-md bg-gray-50"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {layout.hexes.map((h) => (
        <MiniHexTile key={h.id} hex={h} />
      ))}
      {vertexLayout ? (
        <VertexNeighborhood
          layout={vertexLayout}
          board={board}
          playerColors={playerColors}
          onSoldierClick={onSoldierClick}
          selectedSoldierIds={selectedSoldierIds}
          selectableSoldierIds={selectableSoldierIds}
          canActSoldierIds={canActSoldierIds}
        />
      ) : (
        edgeLayout && (
          <EdgeNeighborhood layout={edgeLayout} board={board} playerColors={playerColors} />
        )
      )}
      {children}
    </svg>
  );
};

export default MiniView;
