import React, { Fragment } from 'react';
import { Board } from 'common';
import { MINI_ENDPOINT_R, MINI_SETTLEMENT_MARKER_R } from '../../constants';
import { EdgeMiniLayout } from '../../types/miniMap';
import { SettlementMarker } from './SettlementMarker';

/**
 * Selected-edge neighborhood: the edge line itself (road-owner tinted when a
 * road is built, blue selection otherwise) with an endpoint circle and
 * settlement marker at each vertex.
 */
export const EdgeNeighborhood: React.FC<{
  layout: EdgeMiniLayout;
  board: Board;
  playerColors?: Record<string, string>;
}> = ({ layout, board, playerColors }) => {
  const [a, b] = layout.endpoints;
  return (
    <>
      <line
        x1={a.position.x}
        y1={a.position.y}
        x2={b.position.x}
        y2={b.position.y}
        stroke={
          layout.roadOwnerId ? (playerColors?.[layout.roadOwnerId] ?? '#8B4513') : '#2563eb'
        }
        strokeWidth={6}
        strokeLinecap="round"
      />
      {layout.endpoints.map((v) => (
        <Fragment key={`v-${v.id}`}>
          <circle
            cx={v.position.x}
            cy={v.position.y}
            r={MINI_ENDPOINT_R}
            fill="#6b7280"
            stroke="#fff"
            strokeWidth={2}
          />
          <SettlementMarker
            vertex={v}
            r={MINI_SETTLEMENT_MARKER_R}
            board={board}
            playerColors={playerColors}
          />
        </Fragment>
      ))}
    </>
  );
};
