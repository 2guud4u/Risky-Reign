import React, { useEffect } from 'react';
import { useGameRoom } from '../../contexts/GameContext';
import DraggablePanel from '../../components/DraggablePanel';
import { DefaultRect } from '../../types';
import Vertex from './Vertex';
import Edge from './Edge';
import TradeTab from './TradeTab';
import PlayersList from './PlayersList';
import ResourceCardsPanel from './ResourceCardsPanel';
import DiceView from './DiceView';
import RobberBagView from './RobberBagView';
import EndTurnButton from './EndTurnButton';
import { cardClass } from './styles';
type Tab = 'board' | 'dice' | 'players' | 'cards' | 'trade';


/**
 * Sidebar with tabs: Board (selected vertex/edge viewer, including soldier
 * selection & actions), Dice (dice roll and the end-turn control), Players
 * (all players' resources & bonuses), Cards (your resource & development
 * cards), and Trade (trade & accept offers on your turn). The current phase
 * & player live in the turn snackbar. The whole panel can be dragged by its
 * grip handle (see DraggablePanel).
 */
interface SidebarProps {
  layout: DefaultRect | null;
  onMeasure?: (size: { w: number; h: number }) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ layout, onMeasure }) => {
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

  const renderTab = () => {
    switch (tab) {
      case 'board':
        return renderBoardTab();
      case 'dice':
        return (
          <div className="flex flex-col gap-3">
            <DiceView />
            <RobberBagView />
            <EndTurnButton />
          </div>
        );
      case 'players':
        return (
          <PlayersList
            players={gameRoom.players}
            board={gameRoom.board}
            bonuses={gameRoom.bonuses}
            currentPlayerId={currentPlayer.id}
          />
        );
      case 'cards':
        return <ResourceCardsPanel />;
      default:
        return <TradeTab />;
    }
  };
  return (
    <DraggablePanel id="sidebar" layout={layout} onMeasure={onMeasure} minHeight={110} className={`${cardClass} w-[280px]`}>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex -mt-1 shrink-0">
          <button type="button" className={tabClass(tab === 'board')} onClick={() => switchTab('board')}>
            Board
          </button>
          <button type="button" className={tabClass(tab === 'dice')} onClick={() => switchTab('dice')}>
            Dice
          </button>
          <button type="button" data-cards-tab="true" className={tabClass(tab === 'cards')} onClick={() => switchTab('cards')}>
            Cards
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
    </DraggablePanel>
  );
};

export default Sidebar;
