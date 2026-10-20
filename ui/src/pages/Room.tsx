import React from 'react';
import { useGameActions, useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import WaitingRoom from '../containers/WaitingRoom';
import Game from '../containers/Game';
import VictoryOverlay from '../containers/VictoryOverlay';
import GameIcon from '../components/ui/GameIcon';
import { readSavedSession, saveSession, clearSavedSession } from '../utils/session';
import Button from '../components/ui/Button';

/**
 * The room shell: whatever state the room is in, this picks the surface —
 * the waiting room while players gather, the game board once it starts, and
 * the victory overlay on top of the board when it ends. Spectators (no seat)
 * get the board read-only, or a join card if the room went back to waiting.
 */
const RoomPage: React.FC<{ error: string | null; onCustomizeGame?: () => void }> = ({ error, onCustomizeGame }) => {
  const { gameRoom, currentPlayer } = useGameState();
  const { clearRoomState } = useGameActions();
  const { leaveGame: emitLeaveGame, joinRoom: onJoinRoom } = useSocket();

  if (!gameRoom) {
    return <p className="text-center text-ink-faint">Loading game...</p>;
  }

  // Spectating (no seat): a started game renders read-only; if the room was
  // reset back to the lobby, offer to join it as a new player.
  if (!currentPlayer) {
    if (gameRoom.gameStatus !== 'waiting') return gameRoom.gameStatus === 'finished' ? <><Game /><VictoryOverlay /></> : <Game />;
    return (
      <div className="flex items-center justify-center min-h-dvh w-full p-4">
        <div className="bg-canvas-raised rounded-xl shadow-card p-6 w-full max-w-[420px] text-center flex flex-col gap-3">
          <h1 className="text-xl font-bold m-0 text-ink">The game went back to the lobby</h1>
          <Button
            variant="primary"
            onClick={() => {
              const kept = readSavedSession();
              saveSession({
                roomId: gameRoom.id,
                playerName: '',
                ...(kept?.roomId === gameRoom.id ? { password: kept.password } : {}),
              });
              onJoinRoom('', gameRoom.id);
            }}
          >
            Join as a player
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              emitLeaveGame();
              clearSavedSession();
              clearRoomState();
            }}
          >
            <GameIcon name="arrowLeft" size={13} className="inline -mt-0.5" /> Back to lobby
          </Button>
        </div>
      </div>
    );
  }

  // Waiting room: players gather, pick their color, then the host starts the game.
  if (gameRoom.gameStatus === 'waiting') {
    return <WaitingRoom error={error} onCustomizeGame={onCustomizeGame} />;
  }

  // Game over: the first player to reach WIN_VP victory points wins.
  // Shown as an overlay on top of the board (the board stays visible behind).
  if (gameRoom.gameStatus === 'finished') {
    return (
      <>
        <Game />
        <VictoryOverlay />
      </>
    );
  }

  return <Game />;
};

export default RoomPage;
