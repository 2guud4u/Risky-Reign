import React from 'react';
import { PortType, PixelCoord } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';
import {
  PORT_GENERIC_FILL,
  PORT_OFFSET,
  PORT_PIER,
  PORT_PIER_EDGE,
  PORT_PLANK_GAP,
  PORT_PLANK_W,
  PORT_RADIUS,
  PORT_SPECIAL_FILL,
  PORT_STROKE,
  PORT_TEXT,
} from '../constants';

/**
 * A plank bridge from the port badge to one vertex it serves: a wooden deck
 * (dark edge + lighter top) with evenly spaced cross planks, so it reads as a
 * little boardwalk rather than a plain line.
 */
const PlankBridge: React.FC<{ from: PixelCoord; to: PixelCoord; size: number }> = ({
  from,
  to,
  size,
}) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  // Unit vector perpendicular to the bridge, for laying planks across it.
  const nx = -uy;
  const ny = ux;
  const halfDeck = (size * 0.7) / 2; // half the deck width
  const gap = size * PORT_PLANK_GAP;
  const plankW = size * PORT_PLANK_W;

  const planks = [];
  for (let t = gap; t < len; t += gap) {
    const cx = from.x + ux * t;
    const cy = from.y + uy * t;
    planks.push(
      <line
        key={t.toFixed(2)}
        x1={cx - nx * halfDeck}
        y1={cy - ny * halfDeck}
        x2={cx + nx * halfDeck}
        y2={cy + ny * halfDeck}
        stroke={PORT_PIER_EDGE}
        strokeWidth={plankW}
      />
    );
  }

  return (
    <g>
      {/* Deck: dark edge under a lighter wood top. */}
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={PORT_PIER_EDGE}
        strokeWidth={size * 0.7}
        strokeLinecap="round"
      />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={PORT_PIER}
        strokeWidth={size * 0.5}
        strokeLinecap="round"
      />
      {planks}
    </g>
  );
};

/**
 * A trade port (harbor) marker. A dock serves 1 or 2 adjacent coastal
 * vertices. For a single-vertex dock the icon sits on the coast at that
 * vertex; for a two-vertex dock a single icon sits at the midpoint and a
 * little plank bridge is drawn from the port to each of the two vertices it
 * serves. Positioned radially outward from the board center so it sits in
 * the water, never on top of a hex.
 */
const PortDockInner: React.FC<{
  vertices: PixelCoord[];
  port: PortType;
  size: number;
}> = ({ vertices, port, size }) => {
  const anchor =
    vertices.length === 1
      ? vertices[0]
      : { x: (vertices[0].x + vertices[1].x) / 2, y: (vertices[0].y + vertices[1].y) / 2 };
  const dist = Math.hypot(anchor.x, anchor.y);
  const offset = size * PORT_OFFSET;
  const x = dist > 0 ? anchor.x + (anchor.x / dist) * offset : anchor.x;
  const y = dist > 0 ? anchor.y + (anchor.y / dist) * offset : anchor.y;
  const isGeneric = port === 'generic';
  const r = size * PORT_RADIUS;
  return (
    <g>
      {/* Plank bridges from the harbor badge to each vertex it serves. */}
      {vertices.length === 2 &&
        vertices.map((v, i) => <PlankBridge key={i} from={{ x, y }} to={v} size={size} />)}
      {/* Dock badge: white ring for contrast, soft fill, top highlight, glyph. */}
      <circle cx={x} cy={y} r={r} fill={isGeneric ? PORT_GENERIC_FILL : PORT_SPECIAL_FILL} stroke={PORT_STROKE} strokeWidth={1} />
      <ellipse cx={x} cy={y - r * 0.45} rx={r * 0.55} ry={r * 0.32} fill="#ffffff" opacity={0.22} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={size * PORT_TEXT}>
        {isGeneric ? '⛵' : RESOURCE_ICONS[port as keyof typeof RESOURCE_ICONS]}
      </text>
    </g>
  );
};
export const PortDock = React.memo(PortDockInner);
