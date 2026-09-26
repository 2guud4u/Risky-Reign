import React from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Dice from '../components/Dice';

/** The side length (px) of the giant dice. */
const GIANT_DICE_SIZE = 120;

/**
 * Giant dice shown to everyone during the Dice phase, centered on the screen.
 * The dice player clicks each die to roll it (one per click); the other
 * players just watch. The overlay doesn't block the rest of the board.
 */
const GiantDiceOverlay: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { rollDice } = useSocket();

  if (!gameRoom || !currentPlayer) return null;
  const turn = gameRoom.turnState;
  if (turn.phase !== 'Dice') return null;

  const isDicePlayer = turn.player === currentPlayer.name;
  const roll = gameRoom.roll;
  const canRollDie1 = isDicePlayer && roll.die1 === null;
  const canRollDie2 = isDicePlayer && roll.die1 !== null && roll.die2 === null;

  const status = isDicePlayer
    ? 'Click each die to roll it'
    : `Waiting for ${turn.player} to roll`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center gap-4 bg-black/75 rounded-2xl px-10 py-8 shadow-2xl pointer-events-auto">
        <div className="text-white text-lg font-bold">{status}</div>
        <div className="flex items-center gap-6">
          <Dice
            value={roll.die1}
            size={GIANT_DICE_SIZE}
            canRoll={canRollDie1}
            onRoll={() => rollDice(gameRoom.id)}
          />
          <Dice
            value={roll.die2}
            size={GIANT_DICE_SIZE}
            canRoll={canRollDie2}
            onRoll={() => rollDice(gameRoom.id)}
          />
        </div>
      </div>
    </div>
  );
};

export default GiantDiceOverlay;
