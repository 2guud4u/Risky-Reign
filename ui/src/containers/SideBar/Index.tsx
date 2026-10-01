import React, { useEffect } from 'react';
import { useGameRoom } from '../../contexts/GameContext';
import { SIDEBAR_W } from '../../constants';
import Vertex from './Vertex';
import Edge from './Edge';
import TradeTab from './TradeTab';
import PlayersList from './PlayersList';
import { cardClass, mutedTextClass } from './styles';
type Tab = 'board' | 'players' | 'trade';

/**
 * Sidebar with tabs: Board (selected vertex/edge viewer, including soldier
 * selection & actions), Players (all players' resources & bonuses), and Trade
 * (trade & accept offers on your turn). The dice live in the turn snackbar
 * (and as a giant overlay during the Dice phase). A fixed-width, full-height
 * column on the right of the game screen.
 */
const Sidebar: React.FC = () => {
  const [tab, setTab] = React.useState<Tab>('board');
  const { gameRoom, currentPlayer, selectedObject } = useGameRoom();
  const board = gameRoom?.board ?? null;

  // Selecting a vertex or edge on the board jumps the sidebar to the Board tab.
  useEffect(() => {
    if (selectedObject) setTab('board');
  }, [selectedObject]);


  if (!gameRoom || !currentPlayer || !board) {
    return null;
  }


  const incomingCount = (gameRoom.tradeOffers ?? []).filter(
    (o) => o.to === currentPlayer.name && o.status === 'pending'
  ).length;

  const tabClass = (active: boolean): string =>
    `flex-1 py-1.5 text-[13px] font-semibold border-b-2 cursor-pointer ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  const switchTab = (next: Tab) => {
    setTab(next);
  };

  const renderBoardTab = () => {
    if (!selectedObject) {
      return (
        <p className={`${mutedTextClass} m-0`}>
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

  const renderTab = () => {
    switch (tab) {
      case 'board':
        return renderBoardTab();
      case 'players':
        return (
          <PlayersList
            players={gameRoom.players}
            board={gameRoom.board}
            bonuses={gameRoom.bonuses}
            currentPlayerId={currentPlayer.id}
          />
        );
      default:
        return <TradeTab />;
    }
  };
  return (
    <aside
      className={`${cardClass} h-full shrink-0 rounded-none border-y-0 border-r-0 overflow-hidden`}
      style={{ width: SIDEBAR_W }}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex -mt-1 shrink-0">
          <button type="button" className={tabClass(tab === 'board')} onClick={() => switchTab('board')}>
            Board
          </button>
          <button type="button" className={tabClass(tab === 'trade')} onClick={() => switchTab('trade')}>
            Trade{incomingCount > 0 && (
              <span className="ml-1.5 inline-block px-1.5 rounded-full bg-blue-600 text-white text-[11px]">
                {incomingCount}
              </span>
            )}
          </button>
          <button type="button" className={tabClass(tab === 'players')} onClick={() => switchTab('players')}>
            Players
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {renderTab()}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
