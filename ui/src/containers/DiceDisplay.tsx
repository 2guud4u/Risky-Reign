import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Dice from '../components/ui/Dice';
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
  const { gameRoom, currentPlayer } = useGameState();
  const { rollDice } = useSocket();
  const reduce = useReducedMotion();

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

  // Keep the last live roll so the card can spring OUT when the phase
  // advances — AnimatePresence renders the exiting child with these props.
  const lastRoll = useRef<{ roll: { die1: number | null; die2: number | null }; player: string } | null>(null);
  const show =
    !!gameRoom &&
    !!currentPlayer &&
    !!roll &&
    gameRoom.gameStatus !== 'finished' &&
    ((gameRoom.turnState.phase === 'Dice' && !bothRolled) || linger);
  if (show && roll && gameRoom) lastRoll.current = { roll, player: gameRoom.turnState.player };

  const shown = lastRoll.current;
  const isDicePlayer = shown ? shown.player === currentPlayer?.name : false;
  const r = shown?.roll;
  const status = r
    ? r.die1 !== null && r.die2 !== null
      ? `${shown!.player} rolled ${r.die1 + r.die2}`
      : isDicePlayer
        ? 'Click each die to roll it'
        : `Waiting for ${shown!.player} to roll`
    : '';

  return (
    <AnimatePresence>
      {show && r && gameRoom && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-none">
          <motion.div
            className="flex flex-col items-center gap-4 bg-black/75 rounded-2xl px-10 py-8 shadow-2xl pointer-events-auto"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 10 }}
            transition={reduce ? { duration: 0.12 } : { type: 'spring', stiffness: 460, damping: 28 }}
          >
            <div className="text-white text-lg font-bold">{status}</div>
            <div className="flex items-center gap-6">
              <Dice
                value={r.die1}
                size={GIANT_DICE_SIZE}
                canRoll={isDicePlayer && r.die1 === null}
                onRoll={() => rollDice()}
              />
              <Dice
                value={r.die2}
                size={GIANT_DICE_SIZE}
                canRoll={isDicePlayer && r.die1 !== null && r.die2 === null}
                onRoll={() => rollDice()}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DiceDisplay;
