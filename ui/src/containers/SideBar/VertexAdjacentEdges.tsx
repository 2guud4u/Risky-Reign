import React from 'react';
import { Board, VertexNode } from 'common';
import { adjacentEdges } from '../../utils/vertexAdjacency';
import { neighborNicknames } from '../../utils/neighborLabels';
import { SETTLEMENT_OWNER_COLOR } from './constants';
import { sectionTitleClass } from './styles';

interface VertexAdjacentEdgesProps {
  board: Board;
  vertex: VertexNode;
  onSelectEdge: (edgeId: string) => void;
}

/**
 * "Adjacent Edges" list for the vertex sidebar: one row per edge touching the
 * vertex, showing the far-side vertex's nickname (matching the mini map
 * labels), its settlement owner, and who owns the road.
 */
const VertexAdjacentEdges: React.FC<VertexAdjacentEdgesProps> = ({ board, vertex, onSelectEdge }) => {
  // Nicknames (a, b, c, …) for the neighbor vertices — the same mapping the
  // mini map uses for its labels.
  const nicknames = neighborNicknames(board, vertex.id);

  return (
    <div>
      <div className={`${sectionTitleClass} mb-1.5`}>Adjacent Edges</div>
      <div className="flex flex-col gap-1.5">
        {adjacentEdges(board, vertex).map(({ edge, otherId }) => {
          if (!edge || otherId === null) return null;
          const road = edge.roadId ? board.roads[edge.roadId] : null;
          const other = board.vertices[otherId];
          const otherSettlement = other?.settlementId
            ? board.settlements[other.settlementId]
            : null;
          return (
            <div
              key={edge.id}
              className="border border-gray-200 rounded-md p-2 text-xs flex flex-col gap-1"
            >
              <button
                className="text-left hover:underline cursor-pointer"
                onClick={() => onSelectEdge(edge.id)}
                title="Show this edge"
              >
                <span className="text-gray-600">→ vertex </span>
                <strong>{nicknames[otherId] ?? otherId}</strong>
                <span className="text-gray-400"> ({otherId})</span>
                {otherSettlement && (
                  <span style={{ color: SETTLEMENT_OWNER_COLOR }}> ({otherSettlement.ownerId})</span>
                )}
              </button>
              <div className="text-gray-600">
                Road: {road ? `owned by ${road.ownerId}` : 'none'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VertexAdjacentEdges;
