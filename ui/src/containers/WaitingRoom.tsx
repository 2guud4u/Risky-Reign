import React, { useState } from 'react';
import { LOBBY_HEX_SIZE, MIN_PLAYERS } from 'common';
import { useGameActions, useGameState } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import ColorPicker from '../components/ColorPicker';
import BoardView from './BoardView';
import GameIcon from '../components/ui/GameIcon';
import { readSavedSession, saveSession, clearSavedSession } from '../utils/session';
import Button from '../components/ui/Button';
import { Settings, Link2, Check, LogOut } from 'lucide-react';

const inputClass =
  'w-full px-3 py-2 border border-ink-faint/40 rounded-md text-[15px] bg-canvas-raised text-ink placeholder:text-ink-faint focus:border-gold focus:outline-none disabled:opacity-60';

/** Bottom-left menu (gear) shared by the waiting room: leave the lobby. */
const LobbyMenu: React.FC<{
  open: boolean;
  onToggle: () => void;
  onLeave: () => void;
  roomId: string;
}> = ({ open, onToggle, onLeave, roomId }) => (
  <div className="fixed bottom-3 left-3 z-50">
    {open && (
      <div className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-ink-faint/40 bg-canvas-raised shadow-pop p-2 text-ink">
        <Button
          variant="ghost"
          onClick={onLeave}
          className="w-full !justify-start"
        >
          <LogOut size={15} /> Leave lobby
        </Button>
      </div>
    )}
    <Button
      variant="icon"
      onClick={onToggle}
      aria-label="Lobby menu"
      title="Lobby menu"
    >
      <Settings size={18} />
    </Button>
    <span className="sr-only">{roomId}</span>
  </div>
);

/** Legacy clipboard fallback for non-secure origins (no navigator.clipboard). */
function fallbackCopyText(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * The waiting room: players gather, confirm a name, pick a color, and the
 * host starts the game (or opens Customize Game). Shown by the room shell
 * (pages/Room) while `gameStatus === 'waiting'`.
 */
const WaitingRoom: React.FC<{ error: string | null; onCustomizeGame?: () => void }> = ({
  error,
  onCustomizeGame,
}) => {
  const { gameRoom, currentPlayer } = useGameState();
  const { clearRoomState } = useGameActions();
  const {
    startGame: onStartGame,
    updatePlayerColor: onUpdatePlayerColor,
    setRoomPassword: onSetRoomPassword,
    updatePlayerName: onUpdatePlayerName,
    leaveGame: emitLeaveGame,
  } = useSocket();

  const [nameInput, setNameInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');

  if (!gameRoom || !currentPlayer) return null;

  const handleSetName = () => {
    const name = nameInput.trim();
    if (!name) return;
    onUpdatePlayerName(name);
    // Keep the seat token so a reload re-attaches to this same player.
    const saved = readSavedSession();
    saveSession({
      ...(saved && saved.roomId === gameRoom.id ? { token: saved.token } : {}),
      roomId: gameRoom.id,
      playerName: name,
      color: currentPlayer.color,
    });
  };
  const leaveLobby = () => {
    emitLeaveGame();
    clearSavedSession();
    clearRoomState();
    setMenuOpen(false);
  };
  const copyJoinLink = async () => {
    const url = `${window.location.origin}/join?id=${gameRoom.id}`;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(url);
      else if (!fallbackCopyText(url)) return;
    } catch {
      if (!fallbackCopyText(url)) return;
    }
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1600);
  };

  // Name-first: join is name-optional, so ask for the name before the color.
  if (!currentPlayer.name.trim()) {
    return (
      <div className="flex items-start lg:items-center justify-center min-h-dvh w-full p-4">
        <div className="bg-canvas-raised rounded-xl shadow-card p-6 w-full max-w-[420px]">
          <h1 className="text-2xl font-bold text-center mb-2 text-ink">Risky Reign</h1>
          <p className="text-center text-ink-soft mb-4">Room {gameRoom.id}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSetName();
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label className="block text-[13px] font-semibold mb-1.5 text-ink">Your Name</label>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter your name"
                required
                className={inputClass}
              />
            </div>
            <Button variant="primary" type="submit" disabled={!nameInput.trim()}>
              Confirm
            </Button>
          </form>
        </div>
        <LobbyMenu
          open={menuOpen}
          onToggle={() => setMenuOpen((o) => !o)}
          onLeave={leaveLobby}
          roomId={gameRoom.id}
        />
      </div>
    );
  }

  const canStart =
    gameRoom.players[0]?.id === currentPlayer.id && gameRoom.players.length >= MIN_PLAYERS;
  return (
    <div className="flex items-start lg:items-center justify-center min-h-dvh w-full p-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-start gap-4 w-full">
        <div className="hidden lg:block" />
        <div className="bg-canvas-raised rounded-xl shadow-card p-4 w-full max-w-[520px] justify-self-center">
          <h1 className="text-2xl font-bold text-center mb-4 text-ink">Waiting for Players</h1>
          <p className="text-center text-ink-soft">
            Current Room ID: <strong>{gameRoom.id}</strong>
            <Button
              variant="unstyled"
              onClick={copyJoinLink}
              title="Copy join link"
              aria-label="Copy join link"
              className="ml-0.5 -my-2 align-middle min-w-[40px] min-h-[44px] text-[13px] text-ink-soft hover:text-ink"
            >
              {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
            </Button>
            {linkCopied && <span className="text-[11px] text-moss font-semibold"> link copied</span>}
          </p>
          <p className="text-center text-ink-soft">
            Players: {gameRoom.players.map((p) => p.name).join(', ')}
          </p>

          <div className="mt-4">
            <label className="block text-[13px] font-semibold mb-1.5 text-ink">Your Color</label>
            <ColorPicker
              value={currentPlayer.color}
              others={gameRoom.players
                .filter((p) => p.id !== currentPlayer.id)
                .map((p) => ({ name: p.name || 'Unnamed player', color: p.color }))}
              onChange={(color) => onUpdatePlayerColor(color)}
            />
          </div>
          {error && <p className="text-clay text-center mt-2 text-sm">{error}</p>}
          {canStart && (
            <Button variant="primary" onClick={() => onStartGame()} className="mt-4 w-full">
              Start Game
            </Button>
          )}
          {onCustomizeGame && (
            <Button variant="secondary" onClick={onCustomizeGame} className="mt-2 w-full">
              Customize Game
            </Button>
          )}
          <div className="mt-4 flex justify-center w-full">
            <BoardView hexSize={LOBBY_HEX_SIZE} />
          </div>
        </div>
        <div className="bg-canvas-raised rounded-xl shadow-card p-4 max-w-[320px] justify-self-center lg:justify-self-end">
          <h2 className="text-xl font-bold text-center mb-3 text-ink">Game Rules</h2>
          {(() => {
            const mode = gameRoom.turnMode;
            const turns =
              mode.build === 'single' && mode.action === 'single'
                ? 'Regular turns'
                : mode.build === 'around' && mode.action === 'around' && !mode.secondRoll
                  ? 'Expanded turns'
                  : `B: ${mode.build} · A: ${mode.action}${mode.secondRoll ? ' · second roll' : ''}`;
            const lines = [
              `${gameRoom.pointsToWin} VP to win`,
              turns,
              `${gameRoom.setupCities} setup ${gameRoom.setupCities === 1 ? 'city' : 'cities'}`,
            ];
            if (gameRoom.turnTimerMs > 0) lines.push(`${Math.round(gameRoom.turnTimerMs / 1000)}s turn timer`);
            return (
              <>
                <ul className="m-0 p-0 list-none text-[13px] text-ink-soft text-center space-y-1">
                  {lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {onCustomizeGame && (
                  <Button variant="ghost" size="sm" onClick={onCustomizeGame} className="mt-3 w-full">
                    Change in Customize Game
                  </Button>
                )}
              </>
            );
          })()}

          {/* Room password = privacy: set ⇒ friends join with code+password
              and Quick Play skips the room; empty ⇒ open to Quick Play. Host
              only — it is room access control, not a game rule, so it stays
              here and ignores the customization lock. */}
          <div className="mt-4 border-t border-ink-faint/30 pt-3">
            <label className="block text-[13px] font-semibold mb-1.5 text-ink">
              Room Password {gameRoom.hasPassword ? <GameIcon name="lock" size={12} className="inline -mt-0.5" /> : ''}
            </label>
            {(() => {
              const isHost = gameRoom.players[0]?.id === currentPlayer.id;
              return (
                <>
                  <input
                    type="password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                    placeholder={gameRoom.hasPassword ? 'New password (or clear to open)' : 'None set — room is open'}
                    disabled={!isHost}
                    className={inputClass}
                  />
                  {isHost && (
                    <div className="mt-2 flex gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => onSetRoomPassword(roomPassword.trim())}
                      >
                        {roomPassword.trim() ? 'Set password' : 'Clear password'}
                      </Button>
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-ink-faint">
                    {gameRoom.hasPassword
                      ? 'Private: friends join with code + password; Quick Play skips this room.'
                      : 'Open: anyone can join by code, and Quick Play may drop strangers in.'}
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>
      <LobbyMenu
        open={menuOpen}
        onToggle={() => setMenuOpen((o) => !o)}
        onLeave={leaveLobby}
        roomId={gameRoom.id}
      />
    </div>
  );
};

export default WaitingRoom;
