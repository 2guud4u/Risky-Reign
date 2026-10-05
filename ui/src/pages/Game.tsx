import React, { useState } from 'react';
import { LOBBY_HEX_SIZE, MIN_PLAYERS, DEFAULT_POINTS_TO_WIN, TURN_MODE_PRESETS, TurnMode } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import ColorPicker from '../components/ColorPicker';
import BoardView from '../containers/BoardView';
import Game from '../containers/Game';
import VictoryOverlay from '../containers/VictoryOverlay';
import { readSavedSession, saveSession, clearSavedSession } from '../utils/session';

/** Bottom-left menu (hamburger) shared by the waiting room: leave the lobby. */
const LobbyMenu: React.FC<{
  open: boolean;
  onToggle: () => void;
  onLeave: () => void;
  roomId: string;
}> = ({ open, onToggle, onLeave, roomId }) => (
  <div className="fixed bottom-3 left-3 z-50">
    {open && (
      <div className="absolute bottom-full left-0 mb-2 w-44 rounded-md border border-gray-300 bg-white shadow-lg p-2 text-gray-800">
        <div className="px-2 py-1.5 text-[13px] font-semibold text-gray-600">Room {roomId}</div>
        <button
          type="button"
          onClick={onLeave}
          className="w-full px-2 py-1.5 text-left text-[13px] font-semibold rounded-md bg-red-600 text-white cursor-pointer hover:bg-red-700"
        >
          Leave game
        </button>
      </div>
    )}
    <button
      type="button"
      onClick={onToggle}
      className="px-3 py-2 text-[20px] leading-none font-semibold rounded-md border border-gray-300 bg-white shadow cursor-pointer hover:bg-gray-100"
      title="Menu"
      aria-label="Menu"
      aria-expanded={open}
    >
      {'☰'}
    </button>
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
      <div className="flex items-center justify-center min-h-screen w-full p-4">
        <div className="bg-white rounded-lg shadow p-6 w-full max-w-[420px] text-center flex flex-col gap-3">
          <h1 className="text-xl font-bold m-0">The game went back to the lobby</h1>
          <button
            type="button"
            onClick={() => {
              saveSession({ roomId: gameRoom.id, playerName: '' });
              onJoinRoom('', gameRoom.id);
            }}
            className="py-2.5 rounded-md text-[15px] font-semibold text-white bg-blue-600 cursor-pointer hover:bg-blue-700"
          >
            Join as a player
          </button>
          <button type="button" onClick={leaveLobby} className="text-[13px] text-gray-500 hover:text-gray-800 cursor-pointer">
            ← Back to lobby
          </button>
        </div>
      </div>
    );
  }

  // Waiting room: players gather, pick their color, then the host starts the game.
  if (gameRoom.gameStatus === 'waiting') {
    // Name-first: join is name-optional, so ask for the name before the color.
    if (!currentPlayer.name.trim()) {
      return (
        <div className="flex items-start lg:items-center justify-center min-h-screen w-full p-4">
          <div className="bg-white rounded-lg shadow p-6 w-full max-w-[420px]">
            <h1 className="text-2xl font-bold text-center mb-2">Risky Reign</h1>
            <p className="text-center text-gray-600 mb-4">Room {gameRoom.id}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSetName();
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="block text-[13px] font-semibold mb-1.5">Your Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Enter your name"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={!nameInput.trim()}
                className={`py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white ${
                  nameInput.trim() ? 'bg-blue-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                Confirm
              </button>
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
      <div className="flex items-start lg:items-center justify-center min-h-screen w-full p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-start gap-4 w-full">
          <div className="hidden lg:block" />
          <div className="bg-white rounded-lg shadow p-4 w-full max-w-[520px] justify-self-center">
          <h1 className="text-2xl font-bold text-center mb-4">Waiting for Players</h1>
          <p className="text-center text-gray-600">
            Current Room ID: <strong>{gameRoom.id}</strong>
            <button
              type="button"
              onClick={copyJoinLink}
              title="Copy join link"
              aria-label="Copy join link"
              className="ml-1.5 align-middle text-[13px] text-gray-500 hover:text-gray-800 cursor-pointer"
            >
              {linkCopied ? '✓' : '🔗'}
            </button>
            {linkCopied && <span className="text-[11px] text-green-600"> link copied</span>}
          </p>
          <p className="text-center text-gray-600">
            Players: {gameRoom.players.map((p) => p.name).join(', ')}
          </p>

          <div className="mt-4">
            <label className="block text-[13px] font-semibold mb-1.5">Your Color</label>
            <ColorPicker
              value={currentPlayer.color}
              others={gameRoom.players
                .filter((p) => p.id !== currentPlayer.id)
                .map((p) => ({ name: p.name || 'Unnamed player', color: p.color }))}
              onChange={(color) => onUpdatePlayerColor(gameRoom.id, color)}
            />
          </div>

          {error && <p className="text-red-600 text-center mt-2">{error}</p>}
          {canStart && (
            <button
              onClick={() => onStartGame(gameRoom.id)}
              className="mt-4 w-full py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white bg-blue-500 cursor-pointer"
            >
              Start Game
            </button>
          )}
          <button
            onClick={() => onRefreshMap(gameRoom.id)}
            className="mt-2 w-full py-2.5 px-4 bg-green-500 text-white border-0 rounded-md cursor-pointer text-sm"
          >
            Refresh Map
          </button>
          {onCustomizeBoard && (
            <button
              onClick={onCustomizeBoard}
              className="mt-2 w-full py-2.5 px-4 bg-emerald-600 text-white border-0 rounded-md cursor-pointer text-sm"
            >
              Customize Board
            </button>
          )}
          <div className="mt-4 flex justify-center w-full">
            <BoardView hexSize={LOBBY_HEX_SIZE} />
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 max-w-[320px] justify-self-center lg:justify-self-end">
          <h2 className="text-xl font-bold text-center mb-4">Game Settings</h2>
          <label className="block text-[13px] font-semibold mb-1.5">Points to Win</label>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-[15px]"
          />
          <button
            onClick={() => onUpdatePointsToWin(gameRoom.id, DEFAULT_POINTS_TO_WIN)}
            className="mt-3 w-full py-2 px-4 border border-gray-300 bg-gray-100 rounded-md text-sm cursor-pointer"
          >
            Reset to Default
          </button>

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
                <label className="block text-[13px] font-semibold mb-1.5">{label}</label>
                <select
                  value={mode[key]}
                  disabled={!isHost}
                  onChange={(e) =>
                    onSetTurnMode(gameRoom.id, { ...mode, [key]: e.target.value as TurnMode['build'] })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-[15px] bg-white disabled:opacity-60"
                >
                  <option value="around">Around the table</option>
                  <option value="single">Single (one turn)</option>
                </select>
                <p className="mt-1 text-[11px] text-gray-500">{hint}</p>
              </div>
            );
            const presetBtn = (label: string, preset: TurnMode, active: boolean) => (
              <button
                onClick={() => isHost && onSetTurnMode(gameRoom.id, { ...preset })}
                disabled={!isHost}
                className={`flex-1 py-1.5 px-1 rounded-md text-[11px] font-semibold border cursor-pointer disabled:opacity-60 ${
                  active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600'
                }`}
              >
                {label}
              </button>
            );
            return (
              <div className="mt-5 border-t border-gray-200 pt-3 space-y-3">
                <p className="text-[13px] font-semibold">Turn Structure</p>
                <div className="flex gap-1.5">
                  {presetBtn(
                    'Regular',
                    TURN_MODE_PRESETS.catan,
                    mode.build === 'single' && mode.action === 'single',
                  )}
                  {presetBtn(
                    'Expanded',
                    TURN_MODE_PRESETS.expanded,
                    mode.build === 'around' && mode.action === 'around',
                  )}
                </div>
                {scopeSelect('build', 'Build phase', 'around = every player builds; single = only the dice roller')}
                {scopeSelect('action', 'Action phase', 'around = every player acts; single = only the dice roller')}
              </div>
            );
          })()}
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
