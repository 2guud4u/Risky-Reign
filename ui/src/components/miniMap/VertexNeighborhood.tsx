import React, { Fragment } from 'react';
import { Board } from 'common';
import {
  MINI_LABEL_FONT,
  MINI_NEIGHBOR_R,
  MINI_SELECT_CIRCLE_R,
  MINI_SELECT_RING_R,
  MINI_SETTLEMENT_MARKER_R,
} from '../../constants';
import { roadStroke } from '../../utils/miniMap';
import { MiniViewProps, VertexMiniLayout } from '../../types/miniMap';
import { SettlementMarker } from './SettlementMarker';
import SoldierGroup from '../SoldierGroup';

interface VertexNeighborhoodProps {
  layout: VertexMiniLayout;
  board: Board;
  playerColors?: Record<string, string>;
  onSoldierClick: MiniViewProps['onSoldierClick'];
  selectedSoldierIds?: ReadonlySet<string>;
  selectableSoldierIds?: ReadonlySet<string>;
  canActSoldierIds?: ReadonlySet<string>;
}

/**
 * Selected-vertex neighborhood: incident edges (roads tinted by owner),
 * neighbor circles with settlement markers and letter labels, the selected
 * vertex marker, and each owner's garrisoned-soldier cluster.
 */
export const VertexNeighborhood: React.FC<VertexNeighborhoodProps> = ({
  layout,
  board,
  playerColors,
  onSoldierClick,
  selectedSoldierIds,
  selectableSoldierIds,
  canActSoldierIds,
}) => (
  <>
    {layout.neighbors.map(({ edge, vertex, label, labelPos }) => {
      const stroke = roadStroke(board, edge, playerColors);
      return (
        <Fragment key={edge.id}>
          <line
            x1={layout.vertex.position.x}
            y1={layout.vertex.position.y}
            x2={vertex.position.x}
            y2={vertex.position.y}
            stroke={stroke.color}
            strokeWidth={stroke.width}
          />
          <circle
            cx={vertex.position.x}
            cy={vertex.position.y}
            r={MINI_NEIGHBOR_R}
            fill="#6b7280"
            stroke="#fff"
            strokeWidth={2}
          />
          <SettlementMarker
            vertex={vertex}
            r={MINI_SETTLEMENT_MARKER_R}
            board={board}
            playerColors={playerColors}
          />
          {label && labelPos && (
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={MINI_LABEL_FONT}
              fontWeight="bold"
              fill="#111827"
            >
              {label}
            </text>
          )}
        </Fragment>
      );
    })}

    {/* Garrisoned soldiers: each owner's troops stand in ranks below the
        vertex (healthy in front, injured behind), facing across the vertex. */}
    {layout.armies.map((a) => (
      <SoldierGroup
        key={`g-${a.ownerName}`}
        army={a}
        playerColors={playerColors}
        onSoldierClick={onSoldierClick}
        selectedSoldierIds={selectedSoldierIds}
        selectableSoldierIds={selectableSoldierIds}
        canActSoldierIds={canActSoldierIds}
      />
    ))}

    {/* Selected vertex: the owner's settlement marker when present, so the
        selection ring (blue) still reads as "selected" without hiding the
        occupancy; otherwise the plain blue dot. */}
    {layout.hasSettlement ? (
      <g>
        <SettlementMarker
          vertex={layout.vertex}
          r={MINI_SELECT_CIRCLE_R}
          board={board}
          playerColors={playerColors}
        />
        <circle
          cx={layout.vertex.position.x}
          cy={layout.vertex.position.y}
          r={MINI_SELECT_RING_R}
          fill="none"
          stroke="#2563eb"
          strokeWidth={3}
        />
      </g>
    ) : (
      <circle
        cx={layout.vertex.position.x}
        cy={layout.vertex.position.y}
        r={MINI_SELECT_CIRCLE_R}
        fill="#2563eb"
        stroke="#fff"
        strokeWidth={3}
      />
    )}
  </>
);
