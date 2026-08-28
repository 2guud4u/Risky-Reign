import React from 'react';
import { GAME_HEX_SIZE } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import DraggablePanel, { resetAllPanels } from '../components/DraggablePanel';
import BoardView from './BoardView';
import DiceView from './DiceView';
import EndTurnButton from './EndTurnButton';
import PlayersList from './PlayersList';
import ResourceCardsPanel from './ResourceCardsPanel';
import Sidebar from './SideBar/Index';
import BattleModal from './BattleModal';

/**
 * Main in-game layout: phase header, the board, and panels for turn controls,
 * dice, sidebar tabs, and the player list. Every panel is draggable via its
 * grip handle (see DraggablePanel).
 */
const Game: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();

  if (!gameRoom || !currentPlayer) {
    return <p className="text-center text-gray-500">Loading game...</p>;
  }

  const turn = gameRoom.turnState;

  return (
    <div className="h-screen overflow-hidden flex flex-col items-center p-4">
      <button
        type="button"
        onClick={resetAllPanels}
        className="fixed top-3 right-3 z-[60] px-3 py-1.5 text-[13px] font-semibold bg-white border border-gray-300 rounded-md shadow cursor-pointer text-gray-600 hover:text-gray-900"
        title="Reset the position and size of all panels"
      >
        ⟲ Reset layout
      </button>
      <div className="text-2xl font-bold my-2 mb-4">
        Phase: {turn.phase} — {turn.player}
      </div>

      <div className="flex gap-6 items-start flex-wrap justify-center">
        <DraggablePanel
          id="board"
          className="bg-white rounded-lg shadow p-4 h-[72vh]"
          title="Drag to move the board"
        >
          <BoardView hexSize={GAME_HEX_SIZE} />
        </DraggablePanel>

        <div className="flex flex-col gap-4 w-[280px]">
          <DraggablePanel id="turn" className="bg-white rounded-lg shadow p-3" title="Drag to move">
            <EndTurnButton />
          </DraggablePanel>
          <DraggablePanel id="dice" className="bg-white rounded-lg shadow p-3" title="Drag to move">
            <DiceView />
          </DraggablePanel>
          <Sidebar />
          <DraggablePanel id="resourceCards" className="bg-white rounded-lg shadow p-3" title="Drag to move">
            <ResourceCardsPanel />
          </DraggablePanel>
          <DraggablePanel id="players" className="bg-white rounded-lg shadow p-3" title="Drag to move">
            <PlayersList players={gameRoom.players} currentPlayerId={currentPlayer.id} />
          </DraggablePanel>
        </div>
      </div>

      {/* Separate battle window that opens for all players while combat is active. */}
      <BattleModal />
    </div>
  );
};

export default Game;
