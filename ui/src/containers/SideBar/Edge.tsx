import React, { useState } from 'react';
import { Board, EdgeNode } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import MiniView from '../../components/MiniView';
import { useEdgeBuild } from '../../hooks/useEdgeBuild';
import { hexChipClass, panelTitleClass } from './styles';
import { ActionButton, ReasonNotice } from './ActionButton';
import { playerColorMap } from '../../utils/soldierPlacement';

/**
 * Sidebar panel for a selected edge: mini view of the edge and its
 * neighborhood, road details, and the Build Road action (greyed out with a
 * reason popup when it can't be built here). Uses the same `useEdgeBuild`
 * action as the on-map 🔨 bubble.
 */
const Edge: React.FC<{ board: Board; edge: EdgeNode }> = ({ board, edge }) => {
  const { gameRoom } = useGameRoom();
  const road = useEdgeBuild(board, edge);
  const [notice, setNotice] = useState<string | null>(null);

  const existing = edge.roadId ? board.roads[edge.roadId] : null;
  const hexes = edge.hexIds.map((hid) => board.hexes[hid]).filter(Boolean);

  return (
    <div className="flex flex-col gap-3">
      <h3 className={panelTitleClass}>Edge {edge.id}</h3>

      <MiniView board={board} type="edge" id={edge.id} playerColors={playerColorMap(gameRoom)} />

      <div className="text-[13px]">
        <strong>Road:</strong> {existing ? `owned by ${existing.ownerId}` : 'None'}
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

      <div className="flex flex-col gap-1.5">
        <ActionButton
          label={
            <>
              {road.label} <span className="text-xs opacity-80">({road.costText})</span>
            </>
          }
          check={road.check}
          onDo={road.run}
          onBlocked={setNotice}
        />
        {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
      </div>
    </div>
  );
};

export default Edge;
