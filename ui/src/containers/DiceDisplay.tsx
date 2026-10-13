import React, { useEffect, useRef, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Dice from '../components/Dice';
import { DICE_RESULT_LINGER_MS } from '../constants';

/** The side length (px) of the giant dice. */
const GIANT_DICE_SIZE = 120;


/**
 * The one dice surface. During the Dice phase, before both dice are rolled,
 * it shows large centered dice the turn player clicks to roll (one click per
 * die); everyone else watches. Once the second die lands the giant dice
 * linger for DICE_RESULT_LINGER_MS so everyone sees the result, then it
 * renders nothing — the last roll stays visible in the corner pill.
 */
const DiceDisplay: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { rollDice } = useSocket();

  const roll = gameRoom?.roll;
  const bothRolled = !!roll && roll.die1 !== null && roll.die2 !== null;

  // Linger: when the roll completes (not-both → both), keep the giant dice up
  // briefly. The previous value starts as null so a reload with the roll
  // already complete doesn't trigger it.
  const [linger, setLinger] = useState(false);
  const prevBothRolled = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = prevBothRolled.current;
    prevBothRolled.current = bothRolled;
    if (prev !== false || !bothRolled) {
      if (!bothRolled) setLinger(false);
      return;
    }
    setLinger(true);
    const timer = window.setTimeout(() => setLinger(false), DICE_RESULT_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [bothRolled]);

  if (!gameRoom || !currentPlayer || !roll) return null;

  const turn = gameRoom.turnState;

  // Giant roller: while waiting for the roll, plus the linger after it. A 7
  // holds the Dice phase (robber move + steal still pending), so otherwise
  // hide as soon as both dice are in. Never once the game is over — nothing
  // is left to roll, and it would cover the results / final map.
  if (gameRoom.gameStatus !== 'finished' && ((turn.phase === 'Dice' && !bothRolled) || linger)) {
    const isDicePlayer = turn.player === currentPlayer.name;
    const status = bothRolled
      ? `${turn.player} rolled ${(roll.die1 ?? 0) + (roll.die2 ?? 0)}`
      : isDicePlayer
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
              canRoll={isDicePlayer && roll.die1 === null}
              onRoll={() => rollDice(gameRoom.id)}
            />
            <Dice
              value={roll.die2}
              size={GIANT_DICE_SIZE}
              canRoll={isDicePlayer && roll.die1 !== null && roll.die2 === null}
              onRoll={() => rollDice(gameRoom.id)}
            />
          </div>
        </div>
      </div>
    );
  }

  // Past the roll there's nothing here to show — the last roll lives in the
  // corner pill in Game.tsx.
  return null;
};

export default DiceDisplay;
