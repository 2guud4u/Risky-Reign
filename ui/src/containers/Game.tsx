import React from 'react';
import { GAME_HEX_SIZE } from 'common/v2';
import BoardView from './BoardView';
import EndTurnButton from './EndTurnButton';
import PlayersList from './PlayersList';
import { useGameRoom } from '../contexts/GameContext';

/**
 * Main in-game layout: phase header, the board, and a sidebar with the turn
 * controls and the player list.
 */
const Game: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();

  if (!gameRoom || !currentPlayer) {
    return <p style={{ textAlign: 'center', color: '#666' }}>Loading game...</p>;
  }

  const turn = gameRoom.turnState;

  return (
    <div className="app-shell">
      <div className="app-header">
        Phase: {turn.phase} — {turn.player}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div className="board-frame">
          <BoardView hexSize={GAME_HEX_SIZE} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 260 }}>
          <EndTurnButton />
          <PlayersList players={gameRoom.players} currentPlayerId={currentPlayer.id} />
        </div>
      </div>
    </div>
  );
};

export default Game;
