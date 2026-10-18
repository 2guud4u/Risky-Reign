import React from 'react';
import { Board, PixelCoord, ShipObj, troopsAboard } from 'common';
import { BOARD_VERTEX_SIZE } from '../../constants';
import { TintedSprite } from '../TintedSprite';
import { SHIP_ART } from '../../utils/tintedArt';

/** Ship sprite width, in multiples of the vertex dot. */
const SHIP_SCALE = 6.4;
/** ship.png's canvas aspect (height / width) — 433×456 pixels. */
const SHIP_ASPECT = 456 / 433;
/** Fraction of the sprite height (from the top) that sits on the vertex: mid-hull. */
const SHIP_ANCHOR_Y = 0.78;
/** Troop-count badge radius, in multiples of the vertex dot. */
const BADGE_SCALE = 1.6;

/**
 * A ship drawn on its water vertex: the ship sprite with its sail and pennant
 * tinted in the owner's color. The whole glyph lives in a
 * clickable group (ship selection drives the Sail / Settle / Disembark
 * bubbles). Aboard troops render as a count badge — they ride the ship rather
 * than standing on land.
 */
const ShipPiece: React.FC<{
  ship: ShipObj;
  at: PixelCoord;
  color: string;
  troops: number;
  selected: boolean;
  onClick: (shipId: string) => void;
}> = ({ ship, at, color, troops, selected, onClick }) => {
  const w = BOARD_VERTEX_SIZE * SHIP_SCALE;
  const h = w * SHIP_ASPECT;
  const s = w / 2; // half-width, for badge placement
  return (
    <g
      style={{ cursor: 'pointer' }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick(ship.id);
      }}
    >
      <title>Ship — click for ship actions</title>
      {/* Selection ring */}
      {selected && (
        <circle
          cx={at.x}
          cy={at.y}
          r={BOARD_VERTEX_SIZE * 3.4}
          fill="none"
          stroke="#eb1010"
          strokeWidth={3}
          strokeDasharray="5,5"
          className="blink-circle"
        />
      )}
      <TintedSprite
        art={SHIP_ART}
        color={color}
        x={at.x - s}
        y={at.y - h * SHIP_ANCHOR_Y}
        width={w}
        height={h}
      />
      {/* Troop count badge: how many soldiers are aboard. */}
      {troops > 0 && (
        <g pointerEvents="none">
          <circle
            cx={at.x + s * 0.9}
            cy={at.y - s * 0.55}
            r={BOARD_VERTEX_SIZE * BADGE_SCALE}
            fill={color}
            stroke="#fff"
            strokeWidth={2}
          />
          <text
            x={at.x + s * 0.9}
            y={at.y - s * 0.55}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={BOARD_VERTEX_SIZE * 2}
            fontWeight="bold"
          >
            {troops}
          </text>
        </g>
      )}
    </g>
  );
};

/**
 * The ship layer: every ship on the board, drawn above the vertices so its
 * clicks reach the ship before the vertex dot underneath.
 */
export const ShipLayer = React.memo(function ShipLayer({
  board,
  selectedShipId,
  colorOf,
  onClick,
}: {
  board: Board;
  selectedShipId: string | null;
  colorOf: (ownerId: string | null) => string | undefined;
  onClick: (shipId: string) => void;
}) {
  return (
    <>
      {Object.values(board.ships ?? {}).map((ship) => {
        const vertex = board.vertices[ship.vertexId];
        if (!vertex) return null;
        return (
          <ShipPiece
            key={ship.id}
            ship={ship}
            at={vertex.position}
            color={colorOf(ship.ownerId) ?? '#8b5a2b'}
            troops={troopsAboard(board, ship.id).length}
            selected={ship.id === selectedShipId}
            onClick={onClick}
          />
        );
      })}
    </>
  );
});
