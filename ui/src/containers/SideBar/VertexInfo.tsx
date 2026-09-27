import React from 'react';
import { HexNode, Player, SettlementObj } from 'common';
import { hexChipClass } from './styles';
import { UNKNOWN_OWNER_COLOR } from './constants';

interface VertexInfoProps {
  settlement: SettlementObj | null;
  /** The settlement's owning player (for the color dot), if it resolved. */
  owner: Player | null;
  /** The 1–3 hexes that meet at this vertex. */
  hexes: HexNode[];
}

/**
 * Settlement and hex info rows for the vertex sidebar: the settlement's
 * level and owner (with a player-color dot), and a chip per adjacent hex
 * showing terrain and roll number.
 */
const VertexInfo: React.FC<VertexInfoProps> = ({ settlement, owner, hexes }) => (
  <>
    <div className="text-[13px]">
      <strong>Settlement:</strong>{' '}
      {settlement
        ? `${settlement.level === 'city' ? 'City' : 'Settlement'} — ${settlement.ownerId}`
        : 'None'}
      {owner && (
        <span
          className="inline-block w-2.5 h-2.5 rounded-full ml-2"
          style={{ background: owner.color || UNKNOWN_OWNER_COLOR }}
        />
      )}
    </div>

    <div className="text-[13px]">
      <strong>Hexes:</strong>{' '}
      {hexes.map((h) => (
        <span key={h.id} className={hexChipClass}>
          {h.terrain}
          {h.rollNumber !== null ? ` (${h.rollNumber})` : ''}
        </span>
      ))}
    </div>
  </>
);

export default VertexInfo;
