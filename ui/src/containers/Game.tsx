import React, { useEffect, useState } from 'react';
import { useGameActions, useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import BoardView from './BoardView';
import NoticeRail from './NoticeRail';
import StealPrompt from './StealPrompt';
import DiscardPrompt from './DiscardPrompt';
import WallGatePrompt from './WallGatePrompt';
import CannonShotModal from './CannonShotModal';
import DevCardPrompt from './DevCardPrompt';
import ResourceGainLayer from '../components/ResourceGainLayer';
import ResourceSpendLayer from '../components/ResourceSpendLayer';
import BattleModal from './BattleModal';
import ResourceDisplay from './ResourceDisplay';
import DiceDisplay from './DiceDisplay';
import Dice from '../components/ui/Dice';
import GameIcon from '../components/ui/GameIcon';
import ActionBubbles from '../components/board/ActionBubbles';
import { useBoardActions } from '../board/actions';
import TradeButton from '../components/board/TradeButton';
import RecipesButton from '../components/board/RecipesButton';
import PlayersButton from '../components/board/PlayersButton';
import ChatButton from '../components/board/ChatButton';
import TutorialCoach from './TutorialCoach';
import { setTutorialHints, useTutorialHints } from '../utils/tutorial';
import { GAME_HEX_SIZE } from 'common';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Settings, Lightbulb, Maximize, Minimize, Pause, LogOut } from 'lucide-react';


/**
 * The game screen: the board fills the whole window. Map controls (trade,
 * players, build bubbles, resources) sit on top of it; modals and overlays
 * (battle, prompts, turn status, dice) float above everything.
 */
const Game: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const { clearRoomState } = useGameActions();
  const bubbles = useBoardActions();
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
    if (gameRoom) emitLeaveGame();
    clearRoomState();
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
    document.title = isMyTurn ? `Your turn — ${APP_TITLE}` : APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [gameRoom, currentPlayer]);


  // Spectators (no seat) see the same board read-only: every seat-only panel
  // (resources, trade, prompts, bubbles) renders nothing without a player.
  if (!gameRoom) {
    return <p className="text-center text-ink-faint">Loading game...</p>;
  }
  const spectating = !currentPlayer;
  const isHost = !!currentPlayer && gameRoom.players[0]?.name === currentPlayer.name;
  const canPause = isHost && gameRoom.gameStatus === 'playing';
  const submitPause = () => {
    emitPauseGame(hostPassword, lobbyPassword);
    setMenuOpen(false);
    setPauseOpen(false);
    setHostPassword('');
    setLobbyPassword('');
  };
  const roll = gameRoom.roll;
  return (
    <div>
      {/* Corner stack: the last roll above the ⚙️ menu button. The dice are
          white discs the same size as the gear, so the corner column reads as
          one consistent control stack. */}
      <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-50 flex flex-col items-center gap-2">
        {roll && roll.die1 !== null && roll.die2 !== null && (
          <div className="flex flex-col items-center gap-1.5">
            <Dice value={roll.die1} size={48} circle />
            <Dice value={roll.die2} size={48} circle />
          </div>
        )}
        {menuOpen && (
          <div className="absolute bottom-full left-0 mb-2 w-48 rounded-md border border-ink-faint/50 bg-canvas-raised shadow-lg p-2 text-ink">
            <div className="px-2 py-1.5 text-[13px] font-semibold text-ink-soft">
              Room {gameRoom.id}
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<Lightbulb size={15} />}
              onClick={() => setTutorialHints(!hintsOn)}
              className="w-full !justify-start !text-ink-soft !text-[13px] !font-semibold hover:!bg-canvas-sunken"
            >
              {hintsOn ? 'Turn tips off' : 'Turn tips on'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
              onClick={toggleFullscreen}
              className="w-full !justify-start !text-ink-soft !text-[13px] !font-semibold hover:!bg-canvas-sunken"
            >
              {fullscreen ? 'Leave full screen' : 'Full screen'}
            </Button>
            {fsHint && (
              <p className="m-0 mb-1 px-2 py-1 text-[11px] leading-snug text-clay bg-gold-pale rounded-md">
                This browser can't hide its bars. On iPhone, open the Share menu and choose{' '}
                <b>Add to Home Screen</b> for a bar-free game.
              </p>
            )}
            {canPause && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pause size={15} />}
                onClick={() => {
                  setMenuOpen(false);
                  setPauseOpen(true);
                }}
                className="w-full !justify-start !text-ink-soft !text-[13px] !font-semibold hover:!bg-canvas-sunken"
              >
                Pause game…
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut size={15} />}
              onClick={() => {
                setMenuOpen(false);
                leaveGame();
              }}
              className="w-full !justify-start !bg-clay !text-white !text-[13px] !font-semibold hover:!bg-clay-soft"
            >
              {spectating ? 'Stop watching' : 'Leave game'}
            </Button>
          </div>
        )}
        <Button
          variant="unstyled"
          onClick={() => setMenuOpen((open) => !open)}
          // White-circle backing, same look as the left-edge map buttons: the
          // bare icon was unreadable on the ocean/board texture.
          className="w-12 h-12 rounded-full border-2 border-ink-faint/50 bg-canvas-raised text-ink-soft shadow-lg leading-none hover:scale-110 hover:border-sky active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 transition-transform"
          title="Menu"
          aria-label="Menu"
          aria-expanded={menuOpen}
        >
          <Settings size={20} />
        </Button>
      </div>

      {/* Pause dialog: the host picks the reopen password (host) and the
          seat-claim password (lobby). The game keeps running for nobody —
          the room closes and the link shows the paused screen. */}
      <Modal
        open={pauseOpen}
        onClose={() => setPauseOpen(false)}
        title="Pause this game"
        width="max-w-[380px]"
        footer={
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setPauseOpen(false)}
              className="flex-1 !bg-canvas-sunken !text-ink-soft hover:!bg-canvas-sunken"
            >
              Cancel
            </Button>
            <Button
              onClick={submitPause}
              disabled={!hostPassword || !lobbyPassword}
              className="flex-1 !bg-sky !text-white !font-semibold hover:!bg-sky"
            >
              Pause game
            </Button>
          </div>
        }
      >
        <p className="m-0 text-[13px] text-ink-soft">
          The board is saved and the room closes. Reopen it later with the host password;
          players rejoin their seats with the lobby password.
        </p>
        <input
          type="password"
          value={hostPassword}
          onChange={(e) => setHostPassword(e.target.value)}
          placeholder="Host password (reopens the game)"
          className="w-full px-3 py-2 rounded-md border-2 border-ink-faint/40 text-[15px] focus:border-sky outline-none"
        />
        <input
          type="password"
          value={lobbyPassword}
          onChange={(e) => setLobbyPassword(e.target.value)}
          placeholder="Lobby password (players rejoin)"
          className="w-full px-3 py-2 rounded-md border-2 border-ink-faint/40 text-[15px] focus:border-sky outline-none"
        />
      </Modal>
      <div className="fixed inset-0 flex safe-inset">
        <div className="relative flex-1 min-w-0 bg-canvas-raised">
          {spectating && (
            <div className="absolute top-3 left-16 z-30 px-3 py-1.5 rounded-lg bg-ink text-white text-[13px] font-semibold shadow-lg">
              <GameIcon name="eye" size={13} className="inline -mt-0.5" /> Spectating
            </div>
          )}
          <BoardView hexSize={GAME_HEX_SIZE} />
          <ResourceDisplay />
          {/* Trade window, opened from the 🔄 button in the top-left corner. */}
          <TradeButton />
          {/* Build-recipe reference, opened from the ℹ️ button under 🔄. */}
          <RecipesButton />
          {/* Room chat, toggled by the 💬 button under ℹ️ (above 👤). */}
          <ChatButton />
          {/* Player info column, toggled by the 👤 button under 💬. */}
          <PlayersButton />
          {/* Actions for the selected vertex/edge/robber, as bubbles on the map. */}
          {bubbles && <ActionBubbles actions={bubbles.actions} resetKey={bubbles.resetKey} />}
          {/* Setup walkthrough + idle "Need help?" card (left edge of the map). */}
          <TutorialCoach />
        </div>
      </div>

      {/* Steal prompt: the thief picks a face-down card from a victim. */}
      <StealPrompt />

      {/* 7-discard prompt: players with 8+ resource cards hand in half. */}
      <DiscardPrompt />

      {/* Wall gate: the crosser guesses, then the wall owner rolls the die. */}
      <WallGatePrompt />

      {/* Cannon fire: everyone sees the resolved shot for a few seconds. */}
      <CannonShotModal />

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
      {/* The dice: giant while rolling. The last roll lives in the corner pill. */}
      <DiceDisplay />
    </div>
  );
};

export default Game;
