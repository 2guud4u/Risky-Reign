import React, { useEffect, useState } from 'react';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import BoardView from './BoardView';
import NoticeRail from './NoticeRail';
import StealPrompt from './StealPrompt';
import DiscardPrompt from './DiscardPrompt';
import DevCardPrompt from './DevCardPrompt';
import ResourceGainLayer from '../components/ResourceGainLayer';
import ResourceSpendLayer from '../components/ResourceSpendLayer';
import BattleModal from './BattleModal';
import ResourceDisplay from './ResourceDisplay';
import DiceDisplay from './DiceDisplay';
import VertexActionBubbles from '../components/board/VertexActionBubbles';
import EdgeActionBubbles from '../components/board/EdgeActionBubbles';
import TradeButton from '../components/board/TradeButton';
import RecipesButton from '../components/board/RecipesButton';
import PlayersButton from '../components/board/PlayersButton';
import ChatButton from '../components/board/ChatButton';
import TutorialCoach from './TutorialCoach';
import { setTutorialHints, useTutorialHints } from '../utils/tutorial';
import { GAME_HEX_SIZE } from 'common';


/**
 * The game screen: the board fills the whole window. Map controls (trade,
 * players, build bubbles, resources) sit on top of it; modals and overlays
 * (battle, prompts, turn status, dice) float above everything.
 */
const Game: React.FC = () => {
  const { gameRoom, currentPlayer, setGameRoom, setCurrentPlayer, selectedObject } = useGameRoom();
  const { leaveGame: emitLeaveGame, pauseGame: emitPauseGame } = useSocket();
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // True after the user asked for full screen but the browser can't grant it
  // (iPhone Safari has no element-level fullscreen — Add to Home Screen is the
  // only way to lose its chrome there).
  const [fsHint, setFsHint] = useState(false);
  // Host's pause-for-later dialog (two passwords: reopen + seat claims).
  const [pauseOpen, setPauseOpen] = useState(false);
  const [hostPassword, setHostPassword] = useState('');
  const [lobbyPassword, setLobbyPassword] = useState('');
  const hintsOn = useTutorialHints();
  // Track the real fullscreen state so the label stays right when the user
  // leaves it with a gesture or Esc.
  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const leaveGame = () => {
    // The server keeps the seat (marked disconnected) like a dropped
    // connection, so keep the saved session/token: rejoining this room
    // re-attaches to the same seat instead of joining as a new player.
    if (gameRoom) emitLeaveGame(gameRoom.id);
    setGameRoom(null);
    setCurrentPlayer(null);
  };

  const toggleFullscreen = async () => {
    setFsHint(false);
    // Older Safari exposes the prefixed form only.
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void;
    };
    const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
    try {
      if (document.fullscreenElement) {
        await (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.());
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else {
        setFsHint(true);
      }
    } catch {
      setFsHint(true);
    }
  };
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


  // Spectators (no seat) see the same board read-only: every seat-only panel
  // (resources, trade, prompts, bubbles) renders nothing without a player.
  if (!gameRoom) {
    return <p className="text-center text-gray-500">Loading game...</p>;
  }
  const spectating = !currentPlayer;
  const isHost = !!currentPlayer && gameRoom.players[0]?.name === currentPlayer.name;
  const canPause = isHost && gameRoom.gameStatus === 'playing';
  const submitPause = () => {
    emitPauseGame(gameRoom.id, hostPassword, lobbyPassword);
    setMenuOpen(false);
    setPauseOpen(false);
    setHostPassword('');
    setLobbyPassword('');
  };
  const selectedVertex =
    selectedObject?.type === 'vertex' ? gameRoom.board?.vertices[selectedObject.id] ?? null : null;
  const selectedEdge =
    selectedObject?.type === 'edge' ? gameRoom.board?.edges[selectedObject.id] ?? null : null;
  return (
    <div>
      {/* Menu button: safe-inset keeps it above the home-indicator / off a
          landscape notch; the menu pops up from it. */}
      <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-50">
        {menuOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-48 rounded-md border border-gray-300 bg-white shadow-lg p-2 text-gray-800">
            <div className="px-2 py-1.5 text-[13px] font-semibold text-gray-600">
              Room {gameRoom.id}
            </div>
            <button
              type="button"
              onClick={() => setTutorialHints(!hintsOn)}
              className="w-full mb-1 px-2 py-1.5 text-left text-[13px] font-semibold rounded-md cursor-pointer hover:bg-gray-100"
            >
              {hintsOn ? '💡 Turn tips off' : '💡 Turn tips on'}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-full mb-1 px-2 py-1.5 text-left text-[13px] font-semibold rounded-md cursor-pointer hover:bg-gray-100"
            >
              {fullscreen ? '⤶ Leave full screen' : '⛶ Full screen'}
            </button>
            {fsHint && (
              <p className="m-0 mb-1 px-2 py-1 text-[11px] leading-snug text-amber-700 bg-amber-50 rounded-md">
                This browser can't hide its bars. On iPhone, open the Share menu and choose{' '}
                <b>Add to Home Screen</b> for a bar-free game.
              </p>
            )}
            {canPause && (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setPauseOpen(true);
                }}
                className="w-full mb-1 px-2 py-1.5 text-left text-[13px] font-semibold rounded-md cursor-pointer hover:bg-gray-100"
              >
                ⏸️ Pause game…
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                leaveGame();
              }}
              className="w-full px-2 py-1.5 text-left text-[13px] font-semibold rounded-md bg-red-600 text-white cursor-pointer hover:bg-red-700"
            >
              {spectating ? 'Stop watching' : 'Leave game'}
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

      {/* Pause dialog: the host picks the reopen password (host) and the
          seat-claim password (lobby). The game keeps running for nobody —
          the room closes and the link shows the paused screen. */}
      {pauseOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-[380px] flex flex-col gap-3">
            <h2 className="text-lg font-bold m-0">Pause this game</h2>
            <p className="m-0 text-[13px] text-gray-600">
              The board is saved and the room closes. Reopen it later with the host password;
              players rejoin their seats with the lobby password.
            </p>
            <input
              type="password"
              value={hostPassword}
              onChange={(e) => setHostPassword(e.target.value)}
              placeholder="Host password (reopens the game)"
              className="w-full px-3 py-2 rounded-md border-2 border-gray-200 text-[15px] focus:border-blue-500 outline-none"
            />
            <input
              type="password"
              value={lobbyPassword}
              onChange={(e) => setLobbyPassword(e.target.value)}
              placeholder="Lobby password (players rejoin)"
              className="w-full px-3 py-2 rounded-md border-2 border-gray-200 text-[15px] focus:border-blue-500 outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPauseOpen(false)}
                className="flex-1 py-2 rounded-md bg-gray-100 text-gray-700 text-[14px] font-semibold cursor-pointer hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitPause}
                disabled={!hostPassword || !lobbyPassword}
                className="flex-1 py-2 rounded-md bg-blue-600 text-white text-[14px] font-semibold cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pause game
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 flex safe-inset">
        <div className="relative flex-1 min-w-0 bg-white">
          {spectating && (
            <div className="absolute top-3 left-16 z-30 px-3 py-1.5 rounded-lg bg-gray-900/80 text-white text-[13px] font-semibold shadow-lg">
              👀 Spectating
            </div>
          )}
          <BoardView hexSize={GAME_HEX_SIZE} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
            <ResourceDisplay />
          </div>
          {/* Trade window, opened from the 🔄 button in the top-left corner. */}
          <TradeButton />
          {/* Build-recipe reference, opened from the ℹ️ button under 🔄. */}
          <RecipesButton />
          {/* Room chat, toggled by the 💬 button under ℹ️ (above 👤). */}
          <ChatButton />
          {/* Player info column, toggled by the 👤 button under 💬. */}
          <PlayersButton />
          {/* Build actions for the selected vertex/edge, as bubbles on the map. */}
          {!spectating && selectedVertex && gameRoom.board && (
            <VertexActionBubbles board={gameRoom.board} vertex={selectedVertex} />
          )}
          {!spectating && selectedEdge && gameRoom.board && (
            <EdgeActionBubbles board={gameRoom.board} edge={selectedEdge} />
          )}
          {/* Setup walkthrough + idle "Need help?" card (left edge of the map). */}
          <TutorialCoach />
        </div>
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
      {/* Top-center rail: turn status bar, your-turn toast, waiting/action notices. */}
      <NoticeRail />
      {/* The dice: giant while rolling, compact in the bottom-right corner after. */}
      <DiceDisplay />
    </div>
  );
};

export default Game;
