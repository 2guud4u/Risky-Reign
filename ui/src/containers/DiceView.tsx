import React from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';

/**
 * Two-dice roll control. During the Dice phase the dice player clicks each
 * die to roll it (one die per click, mirroring the backend). When both dice
 * are rolled the total is shown and the backend has already paid out the
 * resources for the total.
 */
const DiceView: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { rollDice: onRollDice } = useSocket();

  if (!gameRoom || !currentPlayer) return null;

  const turn = gameRoom.turnState;
  const isDicePhase = turn.phase === 'Dice';
  const isMyTurn = turn.player === currentPlayer.name;
  const roll = gameRoom.roll;

  const canRollDie1 = isDicePhase && isMyTurn && roll.die1 === null;
  const canRollDie2 = isDicePhase && isMyTurn && roll.die1 !== null && roll.die2 === null;

  const handleRoll = () => onRollDice(gameRoom.id);

  const total = roll.die1 !== null && roll.die2 !== null ? roll.die1 + roll.die2 : null;

  const dieClass = (value: number | null, canRoll: boolean) =>
    `w-14 h-14 rounded-lg border-2 text-2xl font-bold flex items-center justify-center ${
      value !== null
        ? 'border-gray-300 bg-white text-gray-800 cursor-default'
        : canRoll
        ? 'border-blue-500 bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100'
        : 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed'
    }`;

  const status = isDicePhase
    ? isMyTurn
      ? 'Click each die to roll it.'
      : `Waiting for ${turn.player} to roll.`
    : 'Dice are rolled during the Dice phase.';

  return (
    <div >
      <div className="text-sm font-semibold">Dice</div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleRoll}
          disabled={!canRollDie1}
          className={dieClass(roll.die1, canRollDie1)}
          title="Roll die 1"
        >
          {roll.die1 ?? '🎲'}
        </button>
        <button
          onClick={handleRoll}
          disabled={!canRollDie2}
          className={dieClass(roll.die2, canRollDie2)}
          title="Roll die 2"
        >
          {roll.die2 ?? '🎲'}
        </button>
        {total !== null && (
          <div className="text-sm">
            <span className="text-gray-500">Total: </span>
            <strong>{total}</strong>
          </div>
        )}
      </div>
      <div className="text-xs text-gray-500">{status}</div>
    </div>
  );
};

export default DiceView;
