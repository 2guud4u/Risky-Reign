import React from 'react';
import { miniMapViewBox, vertexMiniLayout } from '../utils/miniMap';
import { MiniViewProps } from '../types/miniMap';
import { MiniHexTile } from './miniMap/MiniHexTile';
import { VertexNeighborhood } from './miniMap/VertexNeighborhood';

/**
 * Small SVG preview of a vertex and its immediate neighborhood: the adjacent
 * hexes (terrain-colored, with tokens), the incident edges and neighboring
 * vertices — including owned roads (tinted in the road owner's color) and
 * settlements/cities (in the owner's color) — with the vertex highlighted.
 * Used as the battle arena.
 */
const MiniView: React.FC<MiniViewProps> = ({
  board,
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
}) => {
  const layout = vertexMiniLayout(board, id, showGarrisonedSoldiers);
  if (!layout) return null;

  // Center the view on the vertex, sized to fit everything while keeping it centered.
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
      <VertexNeighborhood
        layout={layout}
        board={board}
        playerColors={playerColors}
        onSoldierClick={onSoldierClick}
        selectedSoldierIds={selectedSoldierIds}
        selectableSoldierIds={selectableSoldierIds}
        canActSoldierIds={canActSoldierIds}
      />
      {children}
    </svg>
  );
};

export default MiniView;
