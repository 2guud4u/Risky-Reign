import React from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import Dice from '../components/Dice';
import {
  HAMBURGER_MENU_GAP_PX,
  HAMBURGER_MENU_SIZE_PX,
  MAP_CORNER_INSET_PX,
} from '../constants';

/** The side length (px) of the giant dice. */
const GIANT_DICE_SIZE = 120;
/** The side length (px) of the compact dice resting above the hamburger menu. */
const COMPACT_DICE_SIZE = 40;

/**
 * The one dice surface. During the Dice phase, before both dice are rolled,
 * it shows large centered dice the turn player clicks to roll (one click per
 * die); everyone else watches. Once the roll is complete — or in any other
 * phase — it collapses to a compact pair just above the hamburger menu
 * (bottom-left).
 */
const DiceDisplay: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  const { rollDice } = useSocket();
  if (!gameRoom || !currentPlayer) return null;

  const turn = gameRoom.turnState;
  const roll = gameRoom.roll;
  const bothRolled = roll.die1 !== null && roll.die2 !== null;

  // Giant roller: only while waiting for the roll. A 7 holds the Dice phase
  // (robber move + steal still pending), so hide as soon as both dice are in.
  if (turn.phase === 'Dice' && !bothRolled) {
    const isDicePlayer = turn.player === currentPlayer.name;
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

  // Compact: the current roll just above the hamburger menu (bottom-left).
  // bottom = menu's bottom inset + menu height + gap; left matches the menu's.
  return (
    <div
      className="fixed z-40 flex items-center gap-2 flex-col"
      style={{
        bottom: MAP_CORNER_INSET_PX + HAMBURGER_MENU_SIZE_PX + HAMBURGER_MENU_GAP_PX,
        left: MAP_CORNER_INSET_PX,
      }}
    >
      <Dice value={roll.die1} size={COMPACT_DICE_SIZE} />
      <Dice value={roll.die2} size={COMPACT_DICE_SIZE} />
    </div>
  );
};

export default DiceDisplay;
