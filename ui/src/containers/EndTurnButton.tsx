import React, { useEffect, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';

/**
 * Turn controls. SetUp and Dice phases advance automatically (setup once the
 * settlement + road are placed, dice once both dice are rolled), so they show
 * an info tip instead of an end-turn button.
 */
const EndTurnButton: React.FC = () => {
  const [phaseText, setPhaseText] = useState<string>('');
  const { gameRoom, currentPlayer } = useGameRoom();
  const { endTurn: onEndTurn } = useSocket();

  useEffect(() => {
    if (!gameRoom || !gameRoom.turnState) return;
    switch (gameRoom.turnState.phase) {
      case 'Trade':
        setPhaseText('End Trade Phase');
        break;
      case 'Build':
        setPhaseText('End Build Phase');
        break;
      case 'Action':
        setPhaseText('End Action Phase');
        break;
      default:
        setPhaseText('End Turn');
    }
  }, [gameRoom]);

  const handleClick = () => {
    if (!gameRoom || !currentPlayer) return;
    // Rolling the dice is done in DiceView (one die per click); this button
    // only advances the phase.
    onEndTurn(currentPlayer.id, gameRoom.id);
  };

  const isMyTurn = !!(gameRoom && currentPlayer && gameRoom.turnState.player === currentPlayer.name);

  if (!gameRoom || !gameRoom.turnState || !currentPlayer) return null;

  // SetUp: show a hint of what's still needed instead of an end-turn button.
  if (gameRoom.turnState.phase === 'SetUp') {
    const needs = [
      gameRoom.turnState.placedSettlement ? null : 'settlement',
      gameRoom.turnState.placedRoad ? null : 'road',
    ].filter(Boolean);

    return (
      <div className="px-4 py-2 text-sm rounded-md border border-blue-200 bg-blue-50 text-blue-800">
        {isMyTurn ? (
          needs.length > 0 ? (
            <>
              Place: {needs.join(' + ')}
              <span className="block text-xs text-blue-600 mt-0.5">
                Setup ends automatically once both are placed.
              </span>
            </>
          ) : (
            'Setup complete — advancing...'
          )
        ) : (
          <>Waiting on {gameRoom.turnState.player} to place their settlement & road</>
        )}
      </div>
    );
  }

  // Dice: rolling both dice advances the phase automatically.
  if (gameRoom.turnState.phase === 'Dice') {
    return (
      <div className="px-4 py-2 text-sm rounded-md border border-blue-200 bg-blue-50 text-blue-800">
        {isMyTurn ? (
          <>
            Roll both dice to continue
            <span className="block text-xs text-blue-600 mt-0.5">
              The phase ends automatically once both dice are rolled.
            </span>
          </>
        ) : (
          <>Waiting on {gameRoom.turnState.player} to roll the dice</>
        )}
      </div>
    );
  }

  const buttonClass = `px-4 py-2 text-sm rounded-md border border-gray-300 ${
    isMyTurn ? 'bg-blue-600 text-white cursor-pointer' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
  }`;

  return (
    <button onClick={handleClick} disabled={!isMyTurn} className={buttonClass}>
      {isMyTurn ? phaseText : `Waiting on ${gameRoom.turnState.player}`}
    </button>
  );
};

export default EndTurnButton;
