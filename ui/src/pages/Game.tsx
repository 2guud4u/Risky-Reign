import React, { useState } from 'react';
import {
  LOBBY_HEX_SIZE,
  MIN_PLAYERS,
  DEFAULT_POINTS_TO_WIN,
  MAX_SETUP_CITIES,
  MIN_TURN_TIMER_S,
  MAX_TURN_TIMER_S,
  TURN_MODE_PRESETS,
  TurnMode,
} from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import ColorPicker from '../components/ColorPicker';
import BoardView from '../containers/BoardView';
import Game from '../containers/Game';
import VictoryOverlay from '../containers/VictoryOverlay';
import { readSavedSession, saveSession, clearSavedSession } from '../utils/session';
import Button from '../components/ui/Button';
import { Settings, Link2, Check, LogOut } from 'lucide-react';

const inputClass =
  'w-full px-3 py-2 border border-ink-faint/40 rounded-md text-[15px] bg-white text-ink placeholder:text-ink-faint focus:border-gold focus:outline-none disabled:opacity-60';

/** Segmented option button (turn-structure presets, setup-cities counts). */
const segClass = (active: boolean) =>
  `flex-1 py-1.5 px-1 rounded-md text-[13px] font-semibold border cursor-pointer transition-colors disabled:opacity-60 ${
    active ? 'border-gold bg-gold-pale text-ink' : 'border-ink-faint/40 bg-white text-ink-soft hover:bg-canvas-sunken'
  }`;

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
        <div className="px-2 py-1.5 text-[13px] font-semibold text-ink-soft">Room {roomId}</div>
        <Button variant="danger" size="sm" onClick={onLeave} icon={<LogOut size={14} />} className="w-full !justify-start">
          Leave game
        </Button>
      </div>
    )}
    <Button
      variant="icon"
      onClick={onToggle}
      className="!p-2"
      title="Menu"
      aria-label="Menu"
      aria-expanded={open}
    >
      <Settings size={20} />
    </Button>
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
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

const GamePage: React.FC<{ error: string | null; onCustomizeBoard?: () => void }> = ({ error, onCustomizeBoard }) => {
  const { gameRoom, currentPlayer, setGameRoom, setCurrentPlayer } = useGameRoom();
  const {
    startGame: onStartGame,
    refreshMap: onRefreshMap,
    updatePlayerColor: onUpdatePlayerColor,
    updatePointsToWin: onUpdatePointsToWin,
    setTurnMode: onSetTurnMode,
    setSetupCities: onSetSetupCities,
    setTurnTimer: onSetTurnTimer,
    updatePlayerName: onUpdatePlayerName,
    leaveGame: emitLeaveGame,
    joinRoom: onJoinRoom,
  } = useSocket();

  const [nameInput, setNameInput] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const handleSetName = () => {
    const name = nameInput.trim();
    if (!name || !gameRoom || !currentPlayer) return;
    onUpdatePlayerName(gameRoom.id, name);
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
    if (gameRoom) emitLeaveGame(gameRoom.id);
    clearSavedSession();
    setGameRoom(null);
    setCurrentPlayer(null);
    setMenuOpen(false);
  };
  const copyJoinLink = async () => {
    if (!gameRoom) return;
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

  if (!gameRoom) {
    return <p className="text-center text-gray-500">Loading game...</p>;
  }

  // Spectating (no seat): a started game renders read-only; if the room was
  // reset back to the lobby, offer to join it as a new player.
  if (!currentPlayer) {
    if (gameRoom.gameStatus !== 'waiting') return gameRoom.gameStatus === 'finished' ? <><Game /><VictoryOverlay /></> : <Game />;
    return (
      <div className="flex items-center justify-center min-h-screen w-full p-4 bg-canvas">
        <div className="bg-canvas-raised rounded-xl shadow-card p-6 w-full max-w-[420px] text-center flex flex-col gap-3">
          <h1 className="text-xl font-bold m-0 text-ink">The game went back to the lobby</h1>
          <Button
            variant="primary"
            onClick={() => {
              saveSession({ roomId: gameRoom.id, playerName: '' });
              onJoinRoom('', gameRoom.id);
            }}
          >
            Join as a player
          </Button>
          <Button variant="ghost" size="sm" onClick={leaveLobby}>
            ← Back to lobby
          </Button>
        </div>
      </div>
    );
  }

  // Waiting room: players gather, pick their color, then the host starts the game.
  if (gameRoom.gameStatus === 'waiting') {
    // Name-first: join is name-optional, so ask for the name before the color.
    if (!currentPlayer.name.trim()) {
      return (
        <div className="flex items-start lg:items-center justify-center min-h-screen w-full p-4 bg-canvas">
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
      <div className="flex items-start lg:items-center justify-center min-h-screen w-full p-4 bg-canvas">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-start gap-4 w-full">
          <div className="hidden lg:block" />
          <div className="bg-canvas-raised rounded-xl shadow-card p-4 w-full max-w-[520px] justify-self-center">
          <h1 className="text-2xl font-bold text-center mb-4 text-ink">Waiting for Players</h1>
          <p className="text-center text-ink-soft">
            Current Room ID: <strong>{gameRoom.id}</strong>
            <button
              type="button"
              onClick={copyJoinLink}
              title="Copy join link"
              aria-label="Copy join link"
              className="ml-1.5 align-middle inline-flex items-center text-[13px] text-ink-soft hover:text-ink cursor-pointer"
            >
              {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
            </button>
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
              onChange={(color) => onUpdatePlayerColor(gameRoom.id, color)}
            />
          </div>
          {error && <p className="text-clay text-center mt-2 text-sm">{error}</p>}
          {canStart && (
            <Button variant="primary" onClick={() => onStartGame(gameRoom.id)} className="mt-4 w-full">
              Start Game
            </Button>
          )}
          <Button variant="secondary" onClick={() => onRefreshMap(gameRoom.id)} className="mt-2 w-full">
            Refresh Map
          </Button>
          {onCustomizeBoard && (
            <Button variant="secondary" onClick={onCustomizeBoard} className="mt-2 w-full">
              Customize Board
            </Button>
          )}
          <div className="mt-4 flex justify-center w-full">
            <BoardView hexSize={LOBBY_HEX_SIZE} />
          </div>
        </div>
        <div className="bg-canvas-raised rounded-xl shadow-card p-4 max-w-[320px] justify-self-center lg:justify-self-end">
          <h2 className="text-xl font-bold text-center mb-4 text-ink">Game Settings</h2>
          <label className="block text-[13px] font-semibold mb-1.5 text-ink">Points to Win</label>
          <input
            type="number"
            min={1}
            value={gameRoom.pointsToWin}
            onChange={(e) => {
              const value = parseInt(e.target.value, 10);
              if (!Number.isNaN(value) && value >= 1) {
                onUpdatePointsToWin(gameRoom.id, value);
              }
            }}
            className={inputClass}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onUpdatePointsToWin(gameRoom.id, DEFAULT_POINTS_TO_WIN)}
            className="mt-3 w-full"
          >
            Reset to Default
          </Button>

          {/* Turn structure: which phases act once per round vs go around the
              whole table. Host-only; other players see the current setting
              but can't change it (the backend also rejects non-host edits). */}
          {(() => {
            const isHost = gameRoom.players[0]?.id === currentPlayer.id;
            const mode = gameRoom.turnMode;
            const scopeSelect = (
              key: 'build' | 'action',
              label: string,
              hint: string,
            ) => (
              <div>
                <label className="block text-[13px] font-semibold mb-1.5 text-ink">{label}</label>
                <select
                  value={mode[key]}
                  disabled={!isHost}
                  onChange={(e) =>
                    onSetTurnMode(gameRoom.id, { ...mode, [key]: e.target.value as TurnMode['build'] })
                  }
                  className={inputClass}
                >
                  <option value="around">Around the table</option>
                  <option value="single">Single (one turn)</option>
                </select>
                <p className="mt-1 text-[11px] text-ink-faint">{hint}</p>
              </div>
            );
            const presetBtn = (label: string, preset: TurnMode, active: boolean) => (
              <button
                onClick={() => isHost && onSetTurnMode(gameRoom.id, { ...preset })}
                disabled={!isHost}
                className={segClass(active)}
              >
                {label}
              </button>
            );
            return (
              <div className="mt-5 border-t border-ink-faint/30 pt-3 space-y-3">
                <p className="text-[13px] font-semibold text-ink">Turn Structure</p>
                <div className="flex gap-1.5">
                  {presetBtn(
                    'Regular',
                    TURN_MODE_PRESETS.catan,
                    mode.build === 'single' && mode.action === 'single',
                  )}
                  {presetBtn(
                    'Expanded',
                    TURN_MODE_PRESETS.expanded,
                    mode.build === 'around' && mode.action === 'around' && !mode.secondRoll,
                  )}
                </div>
                {scopeSelect('build', 'Build phase', 'around = every player builds; single = only the dice roller')}
                {/* The second roll only exists after an around-the-table Build. */}
                {mode.build === 'around' && (
                  <label className="flex items-start gap-2 text-[13px] cursor-pointer text-ink">
                    <input
                      type="checkbox"
                      checked={mode.secondRoll}
                      disabled={!isHost}
                      onChange={(e) => onSetTurnMode(gameRoom.id, { ...mode, secondRoll: e.target.checked })}
                      className="mt-0.5 accent-gold"
                    />
                    <span>
                      <span className="font-semibold text-ink">Second roll</span>
                      <span className="block text-[11px] text-ink-faint">
                        After everyone builds, the same player rolls again before the Action phase.
                      </span>
                    </span>
                  </label>
                )}
                {scopeSelect('action', 'Action phase', 'around = every player acts; single = only the dice roller')}
              </div>
            );

          })()}

          {/* Setup cities: how many of each player's two setup placements may
              be a city (the player chooses which). Host-only, like the rest. */}
          <div className="mt-5 border-t border-ink-faint/30 pt-3">
            <label className="block text-[13px] font-semibold mb-1.5 text-ink">Setup Cities</label>
            <div className="flex gap-1.5">
              {Array.from({ length: MAX_SETUP_CITIES + 1 }, (_, n) => (
                <button
                  onClick={() => onSetSetupCities(gameRoom.id, n)}
                  disabled={gameRoom.players[0]?.id !== currentPlayer.id}
                  className={segClass(gameRoom.setupCities === n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-faint">
              How many setup placements each player may make a city instead of a settlement.
            </p>
          </div>

          {/* Turn timer: a per-phase clock for Build and Action (seconds;
              0/off = no limit). Fights pause it. Host-only. */}
          <div className="mt-5 border-t border-ink-faint/30 pt-3">
            {(() => {
              const isHost = gameRoom.players[0]?.id === currentPlayer.id;
              const on = gameRoom.turnTimerMs > 0;
              return (
                <>
                  <label className="flex items-center gap-2 text-[13px] cursor-pointer text-ink">
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={!isHost}
                      onChange={(e) =>
                        onSetTurnTimer(gameRoom.id, e.target.checked ? MIN_TURN_TIMER_S * 1000 : 0)
                      }
                    />
                    <span className="font-semibold text-ink">Turn Timer</span>
                  </label>
                  {on && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={MIN_TURN_TIMER_S}
                        max={MAX_TURN_TIMER_S}
                        step={5}
                        value={Math.round(gameRoom.turnTimerMs / 1000)}
                        disabled={!isHost}
                        onChange={(e) => {
                          const s = parseInt(e.target.value, 10);
                          if (
                            !Number.isNaN(s) &&
                            s >= MIN_TURN_TIMER_S &&
                            s <= MAX_TURN_TIMER_S
                          ) {
                            onSetTurnTimer(gameRoom.id, s * 1000);
                          }
                        }}
                        className="w-24 px-2 py-1.5 border border-ink-faint/40 rounded-md text-[13px] bg-white text-ink disabled:opacity-60 focus:border-gold focus:outline-none"
                      />
                      <span className="text-[13px] text-ink-soft">seconds per phase</span>
                    </div>
                  )}
                  <p className="mt-1 text-[11px] text-ink-faint">
                    Build and Action phases auto-end when the clock runs out. Pauses during fights.
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
  }

  // Game over: the first player to reach WIN_VP victory points wins.
  // Shown as an overlay on top of the board (the board stays visible behind).
  if (gameRoom.gameStatus === 'finished') {
    return (
      <>
        <Game />
        <VictoryOverlay />
      </>
    );
  }

  return <Game />;
};

export default GamePage;
