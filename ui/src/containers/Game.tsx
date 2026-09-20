import React, { useEffect, useMemo, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import BoardView from './BoardView';
import Sidebar from './SideBar/Index';
import TurnOverlay from './TurnOverlay';
import RobberPrompt from './RobberPrompt';
import StealPrompt from './StealPrompt';
import DiscardPrompt from './DiscardPrompt';
import DevCardPrompt from './DevCardPrompt';
import ResourceGainLayer from '../components/ResourceGainLayer';
import ResourceSpendLayer from '../components/ResourceSpendLayer';
import BattleModal from './BattleModal';
import DraggablePanel from '../components/DraggablePanel';
import { resetAllPanels } from '../components/DraggablePanel';
import { GAME_HEX_SIZE } from 'common';
import { DefaultRect } from '../types';
import { SIDEBAR_W } from '../constants';
import { clearSavedSession } from '../utils/session';

/**
 * The game screen. Everything is floating: the board panel filling the
 * left area edge-to-edge, and the sidebar in its own column (with tabs
 * for board, turn, players, cards, trade, and battle). The board and
 * sidebar are positioned from the viewport, so they track window resizes.
 * Dragging a panel moves only that panel — the others never reflow.
 */

const Game: React.FC = () => {
  const { gameRoom, currentPlayer, setGameRoom, setCurrentPlayer } = useGameRoom();
  const { leaveGame: emitLeaveGame } = useSocket();
  const [vp, setVp] = useState({ vw: window.innerWidth, vh: window.innerHeight });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setVp({ vw: window.innerWidth, vh: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const layouts = useMemo(() => {
    const { vw, vh } = vp;
    const out: Record<string, DefaultRect | null> = {};
    // Board: fills the left area edge-to-edge (the board SVG scales to fit).
    out.board = { x: 0, y: 0, w: Math.max(200, vw - SIDEBAR_W), h: vh };
    // Sidebar: its own column, full height.
    out.sidebar = { x: vw - SIDEBAR_W, y: 0, w: SIDEBAR_W, h: vh };
    return out;
  }, [vp]);

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
    <div className="min-h-screen">
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
      <RobberPrompt />
      <button
        type="button"
        onClick={resetAllPanels}
        className="fixed top-3 right-3 z-40 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-gray-300 bg-white shadow cursor-pointer hover:bg-gray-100"
        title="Restore every panel to its default position"
      >
        {'⟲'} Reset displays
      </button>

      <DraggablePanel
        id="board"
        className="bg-white rounded-lg shadow"
        layout={layouts.board}
      >
        <BoardView hexSize={GAME_HEX_SIZE} />
      </DraggablePanel>

      <Sidebar layout={layouts.sidebar} />

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
    </div>
  );
};

export default Game;
