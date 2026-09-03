import React from 'react';
import { Board, Price, RollResult, computePayouts } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import { priceLabel } from '../utils/price';

const emptyPrice: Price = { Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0 };

/** Total of the two dice, or null until both are rolled. */
const rollTotal = (roll: RollResult): number | null =>
  roll.die1 !== null && roll.die2 !== null ? roll.die1 + roll.die2 : null;

/** Aggregate one player's resource gains for a roll total, by resource. */
const gainsForPlayer = (board: Board, total: number, playerName: string): Price => {
  const gains: Price = { ...emptyPrice };
  for (const p of computePayouts(board, total)) {
    if (p.playerName === playerName) gains[p.resource as keyof Price] += p.amount;
  }
  return gains;
};

/**
 * Two-dice roll control. During the Dice phase the dice player clicks each
 * die to roll it (one die per click, mirroring the backend). When both dice
 * are rolled the total and the resources the dice player gained are shown;
 * the backend has already applied the payout to the room.
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

  const total = rollTotal(roll);

  // Show what the dice player collected from this roll, using the same payout
  // rule the backend applied (settlement = 1, city = 2 of the hex's resource).
  const gains = isDicePhase && total !== null && gameRoom.board ? gainsForPlayer(gameRoom.board, total, turn.player) : null;

  const dieClass = (value: number | null, canRoll: boolean) =>
    `w-14 h-14 rounded-lg border-2 text-2xl font-bold flex items-center justify-center ${
      value !== null
        ? 'border-gray-300 bg-white text-gray-800 cursor-default'
        : canRoll
          ? 'border-blue-500 bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100'
          : 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed'
    }`;

  const sevenPending = gameRoom.robberMove?.reason === 'seven';
  const status = isDicePhase
    ? sevenPending
      ? isMyTurn
        ? 'You rolled a 7 — drag the black robber to a hex to move it.'
        : `${turn.player} rolled a 7 and must move the robber.`
      : isMyTurn
        ? 'Click each die to roll it.'
        : `Waiting for ${turn.player} to roll.`
    : 'Dice are rolled during the Dice phase.';

  return (
    <div className=" p-3.5 bg-white flex flex-col gap-2">
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
      {gains && (
        <div className="text-xs text-gray-600">
          <span className="text-gray-500">{isMyTurn ? 'You gained: ' : `${turn.player} gained: `}</span>
          <strong>{priceLabel(gains)}</strong>
        </div>
      )}
      <div className="text-xs text-gray-500">{status}</div>
    </div>
  );
};

export default DiceView;
