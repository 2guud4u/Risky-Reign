import React from 'react';
import { useGameRoom } from '../../contexts/GameContext';
import DraggablePanel, { DefaultRect } from '../../components/DraggablePanel';
import Vertex from './Vertex';
import Edge from './Edge';
import TradeTab from './TradeTab';
import BattleTab from './BattleTab';
import { cardClass } from './styles';

type Tab = 'board' | 'trade' | 'battle';

/**
 * Sidebar with tabs: Board (selected vertex/edge viewer, including soldier
 * selection & actions), Trade (draft offers anytime, accept on your turn),
 * and Battle (visible while combat is active). The whole panel can be dragged
 * by its grip handle (see DraggablePanel).
 */
interface SidebarProps {
  layout: DefaultRect | null;
  onMeasure?: (size: { w: number; h: number }) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ layout, onMeasure }) => {
  const [tab, setTab] = React.useState<Tab>('board');
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

  return (
    <DraggablePanel id="sidebar" layout={layout} onMeasure={onMeasure} minHeight={110} className={`${cardClass} w-[280px]`}>
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
          {battle && (
            <button type="button" className={tabClass(tab === 'battle')} onClick={() => switchTab('battle')}>
              ⚔ Battle
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {tab === 'board' ? (
            renderBoardTab()
          ) : tab === 'battle' && battle ? (
            <BattleTab board={board} battle={battle} />
          ) : (
            <TradeTab />
          )}
        </div>
      </div>
    </DraggablePanel>
  );
};

export default Sidebar;
