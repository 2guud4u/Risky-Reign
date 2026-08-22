import React, { useState } from 'react';
import { useGameRoom } from '../../contexts/GameContext';
import Vertex from './Vertex';
import Edge from './Edge';
import TradeTab from './TradeTab';
import BattleTab from './BattleTab';
import { cardClass } from './styles';

type Tab = 'board' | 'trade' | 'battle';

/**
 * Sidebar with tabs: Board (selected vertex/edge viewer, including soldier
 * selection & actions), Trade (draft offers anytime, accept on your turn),
 * and Battle (visible while combat is active).
 */
const Sidebar: React.FC = () => {
  const [tab, setTab] = useState<Tab>('board');
  const { gameRoom, currentPlayer, selectedObject } = useGameRoom();
  const board = gameRoom?.board ?? null;

  if (!gameRoom || !currentPlayer || !board) {
    return null;
  }

  const battle = gameRoom.battleState ?? null;

  const incomingCount = (gameRoom.tradeOffers ?? []).filter(
    (o) => o.to === currentPlayer.name && o.status === 'pending'
  ).length;

  const tabClass = (active: boolean): string =>
    `flex-1 py-1.5 text-[13px] font-semibold border-b-2 cursor-pointer ${
      active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  const renderBoardTab = () => {
    if (!selectedObject) {
      return (
        <p className="text-[13px] text-gray-500 m-0">
          Click a vertex or edge on the board to see its details and build options.
        </p>
      );
    }

    if (selectedObject.type === 'vertex') {
      const vertex = board.vertices[selectedObject.id];
      if (!vertex) return null;
      return <Vertex board={board} vertex={vertex} />;
    }

    const edge = board.edges[selectedObject.id];
    if (!edge) return null;
    return <Edge board={board} edge={edge} />;
  };

  return (
    <div className={cardClass}>
      <div className="flex mb-3 -mb-1">
        <button type="button" className={tabClass(tab === 'board')} onClick={() => setTab('board')}>
          Board
        </button>
        <button type="button" className={tabClass(tab === 'trade')} onClick={() => setTab('trade')}>
          Trade{incomingCount > 0 && (
            <span className="ml-1.5 inline-block px-1.5 rounded-full bg-blue-600 text-white text-[11px]">
              {incomingCount}
            </span>
          )}
        </button>
        {battle && (
          <button type="button" className={tabClass(tab === 'battle')} onClick={() => setTab('battle')}>
            ⚔ Battle
          </button>
        )}
      </div>

      {tab === 'board' ? (
        renderBoardTab()
      ) : tab === 'battle' && battle ? (
        <BattleTab board={board} battle={battle} />
      ) : (
        <TradeTab />
      )}
    </div>
  );
};

export default Sidebar;
