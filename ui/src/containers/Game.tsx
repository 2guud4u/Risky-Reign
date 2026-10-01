import React, { useEffect, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import BoardView from './BoardView';
import Sidebar from './SideBar/Index';
import TurnOverlay from './TurnOverlay';
import NoticeRail from './NoticeRail';
import StealPrompt from './StealPrompt';
import DiscardPrompt from './DiscardPrompt';
import DevCardPrompt from './DevCardPrompt';
import ResourceGainLayer from '../components/ResourceGainLayer';
import ResourceSpendLayer from '../components/ResourceSpendLayer';
import BattleModal from './BattleModal';
import ResourceDisplay from './ResourceDisplay';
import DiceDisplay from './DiceDisplay';
import { GAME_HEX_SIZE } from 'common';
import { clearSavedSession } from '../utils/session';

/**
 * The game screen: the board fills the left area and the sidebar is a fixed
 * column on the right (`SideBar/Index`). Modals and overlays (battle, prompts,
 * turn pill, dice) float above both.
 */
const Game: React.FC = () => {
  const { gameRoom, currentPlayer, setGameRoom, setCurrentPlayer } = useGameRoom();
  const { leaveGame: emitLeaveGame } = useSocket();
  const [menuOpen, setMenuOpen] = useState(false);
  // Browser tab title: flag when it's the player's turn so a backgrounded tab
  // is easy to spot. Restores the app title when it isn't / on unmount.
  const APP_TITLE = 'Risky Reign';
  useEffect(() => {
    const isMyTurn =
      !!gameRoom && !!currentPlayer && gameRoom.turnState.player === currentPlayer.name;
    document.title = isMyTurn ? `🎲 Your turn — ${APP_TITLE}` : APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [gameRoom, currentPlayer]);

  const leaveGame = () => {
    if (gameRoom && currentPlayer) emitLeaveGame(gameRoom.id);
    clearSavedSession();
    setGameRoom(null);
    setCurrentPlayer(null);
  };
  if (!gameRoom || !currentPlayer) {
    return <p className="text-center text-gray-500">Loading game...</p>;
  }

  return (
    <div>
      <div className="fixed bottom-3 left-3 z-50">
        {menuOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-48 rounded-md border border-gray-300 bg-white shadow-lg p-2 text-gray-800">
            <div className="px-2 py-1.5 text-[13px] font-semibold text-gray-600">
              Room {gameRoom.id}
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                leaveGame();
              }}
              className="w-full px-2 py-1.5 text-left text-[13px] font-semibold rounded-md bg-red-600 text-white cursor-pointer hover:bg-red-700"
            >
              Leave game
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="px-3 py-2 text-[20px] leading-none font-semibold rounded-md border border-gray-300 bg-white shadow cursor-pointer hover:bg-gray-100"
          title="Menu"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          {'☰'}
        </button>
      </div>

      <div className="fixed inset-0 flex">
        <div className="relative flex-1 min-w-0 bg-white">
          <BoardView hexSize={GAME_HEX_SIZE} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
            <ResourceDisplay />
          </div>
        </div>
        <Sidebar />
      </div>

      {/* Steal prompt: the thief picks a face-down card from a victim. */}
      <StealPrompt />

      {/* 7-discard prompt: players with 8+ resource cards hand in half. */}
      <DiscardPrompt />

      {/* Development card choice: Year of Plenty / Monopoly. */}
      <DevCardPrompt />

      {/* Resource gain animation: cards fly from the source to the panel. */}
      <ResourceGainLayer />
      {/* Resource spend animation: cards fly from the panel to the build location. */}
      <ResourceSpendLayer />

      {/* Separate battle window that opens for all players while combat is active. */}
      <BattleModal />
      {/* Turn overlay: phase + control on the board's bottom edge, colored by phase. */}
      <TurnOverlay />
      {/* Top-center notice rail: your-turn toast + all waiting/action notices. */}
      <NoticeRail />
      {/* The dice: giant while rolling, compact above the turn pill after. */}
      <DiceDisplay />
    </div>
  );
};

export default Game;
