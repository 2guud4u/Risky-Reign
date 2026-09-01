import React from 'react';
import { useGameRoom } from '../contexts/GameContext';

/**
 * Prompt shown while a robber move is pending (a 7 roll or a played knight
 * card). The pending player clicks a highlighted hex on the board to resolve
 * it; other players see who is waiting.
 */
const RobberPrompt: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameRoom();
  if (!gameRoom?.robberMove || !currentPlayer) return null;
  const { player, reason } = gameRoom.robberMove;
  const isMe = player === currentPlayer.name;
  const text = isMe
    ? reason === 'seven'
      ? 'You rolled a 7 — click a highlighted hex to move the robber.'
      : 'Knight: click a highlighted hex to place the robber and steal a card.'
    : `${player} must move the robber (${reason === 'seven' ? 'rolled a 7' : 'knight card'}).`;

  return (
    <div
      className={`fixed top-3 left-1/2 -translate-x-1/2 z-40 px-4 py-2 text-sm rounded-md border shadow-lg ${
        isMe ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-gray-200 bg-gray-50 text-gray-600'
      }`}
    >
      {text}
    </div>
  );
};
export default RobberPrompt;
