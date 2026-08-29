import React from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';

/**
 * Turn controls. SetUp and Dice phases advance automatically (setup once the
 * settlement + road are placed, dice once both dice are rolled), so they show
 * an info tip instead of an end-turn button.
 */
const EndTurnButton: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { endTurn: onEndTurn } = useSocket();

  // Label for the manual-advance phases (derived at render time).
  const phaseText = (phase: string): string => {
    switch (phase) {
      case 'Trade':
        return 'End Trade Phase';
      case 'Build':
        return 'End Build Phase';
      case 'Action':
        return 'End Action Phase';
      default:
        return 'End Turn';
    }
  };

  const handleClick = () => {
    if (!gameRoom) return;
    // Rolling the dice is done in DiceView (one die per click); this button
    // only advances the phase. The server derives the acting player from the
    // socket, so no playerId is sent.
    onEndTurn(gameRoom.id);
  };

  const isMyTurn = !!(gameRoom && currentPlayer && gameRoom.turnState.player === currentPlayer.name);

  if (!gameRoom || !gameRoom.turnState || !currentPlayer) return null;

  // Soldiers of the current player who still have an unspent action this
  // Action phase (not yet acted, not just created). Shown as a warning when
  // ending the phase.
  const soldiersWithActionsLeft = (() => {
    if (gameRoom.turnState.phase !== 'Action' || !isMyTurn) return 0;
    const turn = gameRoom.turnState;
    return Object.values(gameRoom.board?.soldiers ?? {}).filter(
      (s) =>
        s.owner === currentPlayer.name &&
        !turn.soldiersActedThisTurn.includes(s.id) &&
        !turn.soldiersCreatedThisTurn.includes(s.id)
    ).length;
  })();

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

  // Dice: rolling both dice advances the phase automatically — or, on a 7,
  // moving the robber does.
  if (gameRoom.turnState.phase === 'Dice') {
    const sevenPending = gameRoom.robberMove?.reason === 'seven';
    return (
      <div className="px-4 py-2 text-sm rounded-md border border-blue-200 bg-blue-50 text-blue-800">
        {isMyTurn ? (
          sevenPending ? (
            <>
              Move the robber to continue
              <span className="block text-xs text-blue-600 mt-0.5">
                You rolled a 7 — click a highlighted hex on the board.
              </span>
            </>
          ) : (
            <>
              Roll both dice to continue
              <span className="block text-xs text-blue-600 mt-0.5">
                The phase ends automatically once both dice are rolled.
              </span>
            </>
          )
        ) : (
          <>
            Waiting on {gameRoom.turnState.player} to{' '}
            {sevenPending ? 'move the robber' : 'roll the dice'}
          </>
        )}
      </div>
    );
  }

  const buttonClass = `w-full px-4 py-2 text-sm text-center rounded-md border border-gray-300 ${
    isMyTurn ? 'bg-blue-600 text-white cursor-pointer' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
  }`;

  const buttonLabel = isMyTurn
    ? phaseText(gameRoom.turnState.phase)
    : `Waiting on ${gameRoom.turnState.player}`;

  return (
    <div className="flex flex-col gap-1">
      <button onClick={handleClick} disabled={!isMyTurn} className={buttonClass}>
        {buttonLabel}
      </button>
      {gameRoom.turnState.phase === 'Action' && isMyTurn && soldiersWithActionsLeft > 0 && (
        <div className="px-2 py-1 text-xs text-center rounded border border-amber-200 bg-amber-50 text-amber-800">
          ⚠ {soldiersWithActionsLeft} soldier{soldiersWithActionsLeft > 1 ? 's' : ''} still have action(s) left
        </div>
      )}
    </div>
  );
};

export default EndTurnButton;
