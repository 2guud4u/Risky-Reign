import React, { useState } from 'react';
import { useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Modal from '../components/ui/Modal';
import GameIcon from '../components/ui/GameIcon';
import Button from '../components/ui/Button';

/**
 * Victory overlay: shown on top of the board when the game ends. Displays the
 * winner, the final standings, and a "Play Again" button (which returns the
 * room to the lobby). "View map" collapses it to a small bottom banner so
 * players can still pan/zoom and look around the final board.
 */
const VictoryOverlay: React.FC = () => {
  const { gameRoom } = useGameState();
  const { resetGame } = useSocket();
  const [viewingMap, setViewingMap] = useState(false);
  if (!gameRoom) return null;

  if (viewingMap) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-xl shadow-pop bg-canvas-raised border border-ink-faint/40">
        <span className="text-[15px] font-bold"><GameIcon name="trophy" size={15} className="inline -mt-0.5" /> {gameRoom.winner} wins!</span>
        <Button size="sm" onClick={() => setViewingMap(false)}>
          Show results
        </Button>
        <Button
          size="sm"
          onClick={() => resetGame()}
          className="!bg-sky !text-white"
        >
          Play Again
        </Button>
      </div>
    );
  }

  const standings = [...gameRoom.players].sort((a, b) => b.victoryPoints - a.victoryPoints);

  return (
    <Modal open aria-label="Game over" width="max-w-[520px]">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2"><GameIcon name="trophy" size={26} className="inline -mt-1" /> {gameRoom.winner} wins!</h1>
        <p className="text-ink-soft mb-6">
          First to {gameRoom.pointsToWin} victory points — or the last player standing — wins the game.
        </p>
        <div className="space-y-2 mb-6">
          {standings.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-3 py-2 rounded-md bg-canvas-sunken"
            >
              <span className="font-semibold" style={{ color: p.color }}>
                {p.name}
              </span>
              <span className="text-gold-deep font-semibold">
                {p.eliminated && <span className="text-ink-faint mr-2"><GameIcon name="skull" size={12} className="inline -mt-0.5" /> Knocked out</span>}<GameIcon name="star" size={13} className="inline -mt-0.5" /> {p.victoryPoints} VP
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setViewingMap(true)}
            className="flex-1"
          >
            View map
          </Button>
          <Button
            variant="unstyled"
            onClick={() => resetGame()}
            className="flex-1 py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white bg-sky transition-all active:scale-95 motion-reduce:active:scale-100"
          >
            Play Again
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default VictoryOverlay;
