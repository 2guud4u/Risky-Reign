import React from 'react';
import { useGameRoom } from '../contexts/GameContext';
import Dice from '../components/Dice';
import { SIDEBAR_W } from '../constants';

/**
 * The two dice floating just above the turn status pill (always visible,
 * showing the current roll).
 */
const TurnDice: React.FC = () => {
  const { gameRoom } = useGameRoom();
  if (!gameRoom) return null;
  const roll = gameRoom.roll;

  return (
    <div
      className="fixed z-40 flex items-center gap-2"
      style={{ bottom: 76, right: SIDEBAR_W + 12 }}
    >
      <Dice value={roll.die1} size={40} />
      <Dice value={roll.die2} size={40} />
    </div>
  );
};

export default TurnDice;
