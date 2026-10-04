import React from 'react';
import { PortType, PixelCoord } from 'common';
import { RESOURCE_ICONS } from '../utils/resourceIcons';
import {
  PORT_FACE_FILL,
  PORT_GENERIC_FILL,
  PORT_LABEL_FILL,
  PORT_OFFSET,
  PORT_PIER,
  PORT_PIER_EDGE,
  PORT_PLANK_GAP,
  PORT_PLANK_W,
  PORT_RADIUS,
  PORT_RATIO_TEXT,
  PORT_SPECIAL_FILL,
  PORT_STROKE,
  PORT_TEXT,
  OPEN_TRADE_EVENT,
} from '../constants';
import { OpenTradeDetail } from '../types/openTrade';

/** Open the trade window preset to this port's bank trade. */
const openPortTrade = (port: PortType) =>
  window.dispatchEvent(new CustomEvent<OpenTradeDetail>(OPEN_TRADE_EVENT, { detail: { port } }));

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
  const ring = isGeneric ? PORT_GENERIC_FILL : PORT_SPECIAL_FILL;
  const glyph = isGeneric ? '⛵' : RESOURCE_ICONS[port as keyof typeof RESOURCE_ICONS];
  const ratio = isGeneric ? '3:1' : '2:1';
  return (
    <g>
      {/* Plank bridges from the harbor badge to each vertex it serves (one or two). */}
      {vertices.map((v, i) => <PlankBridge key={i} from={{ x, y }} to={v} size={size} />)}
      {/* Harbor medallion: soft drop shadow, colored ring, white coin face.
          Clicking it opens the trade window on this port's bank trade. */}
      <g
        role="button"
        aria-label={`Trade at ${isGeneric ? 'generic' : port} port (${ratio})`}
        style={{ cursor: 'pointer' }}
        // Keep the press from starting a board pan.
        onMouseDown={(e) => e.stopPropagation()}
        onClick={() => openPortTrade(port)}
      >
        <title>{`Trade at this port (${ratio})`}</title>
      <ellipse cx={x} cy={y + r * 0.12} rx={r} ry={r * 0.92} fill="#0a2434" opacity={0.18} />
      <circle cx={x} cy={y} r={r} fill={ring} stroke={PORT_STROKE} strokeWidth={1} />
      <circle cx={x} cy={y} r={r * 0.8} fill={PORT_FACE_FILL} />
      {/* Resource glyph on top, trade ratio beneath. */}
      <text
        x={x}
        y={y - r * 0.18}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * PORT_TEXT}
      >
        {glyph}
      </text>
      <text
        x={x}
        y={y + r * 0.52}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * PORT_RATIO_TEXT}
        fontWeight={700}
        fill={PORT_LABEL_FILL}
      >
        {ratio}
      </text>
      </g>
    </g>
  );
};
export const PortDock = React.memo(PortDockInner);
