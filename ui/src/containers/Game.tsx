import React from 'react';
import { GAME_HEX_SIZE } from 'common';
import BoardView from './BoardView';
import EndTurnButton from './EndTurnButton';
import PlayersList from './PlayersList';
import { useGameRoom } from '../contexts/GameContext';
import Sidebar from './SideBar/Index';

/**
 * Main in-game layout: phase header, the board, and a sidebar with the turn
 * controls and the player list.
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
        <div className="bg-white rounded-lg shadow p-4">
          <BoardView hexSize={GAME_HEX_SIZE} />
        </div>

        <div className="flex flex-col gap-4 w-[280px]">
          <EndTurnButton />
          <Sidebar />
          <PlayersList players={gameRoom.players} currentPlayerId={currentPlayer.id} />
        </div>
      </div>
    </div>
  );
};

export default Game;
