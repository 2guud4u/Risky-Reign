import React, { useEffect, useMemo, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import BoardView from './BoardView';
import Sidebar from './SideBar/Index';
import EndTurnButton from './SideBar/EndTurnButton';
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
/** Tailwind classes for the turn snackbar, keyed to the current phase. */
const phaseColor = (phase: string): string => {
  switch (phase) {
    case 'SetUp':
      return 'bg-blue-600';
    case 'Dice':
      return 'bg-amber-500';
    case 'Build':
      return 'bg-green-600';
    case 'Action':
      return 'bg-rose-600';
    default:
      return 'bg-gray-600';
  }
};

const Game: React.FC = () => {
  const { gameRoom, currentPlayer, setGameRoom, setCurrentPlayer } = useGameRoom();
  const { undoBuild, leaveGame: emitLeaveGame } = useSocket();
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

  // Undo is available only while it is this player's turn, in the Build or
  // Action phase, and there is at least one action this phase to undo.
  const canUndo =
    gameRoom.turnState.player === currentPlayer.name &&
    (gameRoom.turnState.phase === 'Build' || gameRoom.turnState.phase === 'Action') &&
    (gameRoom.turnState.undoLog?.length ?? 0) > 0;

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
              className="w-full px-2 py-1.5 text-left text-[13px] font-semibold rounded-md cursor-pointer hover:bg-gray-100"
              title="Chat"
            >
              {'💬'} Chat
            </button>
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
      {/* Turn snackbar: phase + control on the board's bottom edge, colored by phase. */}
      <div
        className={`fixed bottom-3 z-40 flex flex-col gap-1.5 px-4 py-2.5 rounded-xl shadow-lg text-white min-w-[240px] ${phaseColor(gameRoom.turnState.phase)}`}
        style={{ right: SIDEBAR_W + 12 }}
      >
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-md bg-white/20 text-[11px] font-bold uppercase tracking-wide">
            {gameRoom.turnState.phase}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {canUndo && (
              <button
                type="button"
                onClick={() => undoBuild(gameRoom.id)}
                className="px-2.5 py-1.5 text-[13px] font-semibold rounded-md bg-white/25 cursor-pointer hover:bg-white/40"
                title="Undo last action"
                aria-label="Undo last action"
              >
                {'↶'} Undo
              </button>
            )}
            <EndTurnButton variant="snackbar" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
