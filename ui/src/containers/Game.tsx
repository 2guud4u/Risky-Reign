import React from 'react';
import { GAME_HEX_SIZE } from 'common';
import BoardView from './BoardView';
import DiceView from './DiceView';
import EndTurnButton from './EndTurnButton';
import PlayersList from './PlayersList';
import DraggablePanel from '../components/DraggablePanel';
import { useGameRoom } from '../contexts/GameContext';
import Sidebar from './SideBar/Index';

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
    <div className="min-h-screen flex flex-col items-center p-4">
      <div className="text-2xl font-bold my-2 mb-4">
        Phase: {turn.phase} — {turn.player}
      </div>

      <div className="flex gap-6 items-start flex-wrap justify-center">
        <DraggablePanel className="bg-white rounded-lg shadow p-4" title="Drag to move the board">
          <BoardView hexSize={GAME_HEX_SIZE} />
        </DraggablePanel>

        <div className="flex flex-col gap-4 w-[280px]">
          <DraggablePanel className="bg-white rounded-lg shadow p-3" title="Drag to move">
            <EndTurnButton />
          </DraggablePanel>
          <DraggablePanel className="bg-white rounded-lg shadow p-3" title="Drag to move">
            <DiceView />
          </DraggablePanel>
          <Sidebar />
          <DraggablePanel className="bg-white rounded-lg shadow p-3" title="Drag to move">
            <PlayersList players={gameRoom.players} currentPlayerId={currentPlayer.id} />
          </DraggablePanel>
        </div>
      </div>
    </div>
  );
};

export default Game;
