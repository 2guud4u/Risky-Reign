import React, { useState } from 'react';
import { PausedGameInfo } from 'common';
import { useSocket } from '../contexts/SocketContext';
import { useGameRoom } from '../contexts/GameContext';
import { saveSession, clearSavedSession, readSavedSession } from '../utils/session';
import { PASSWORD_MAX } from 'common';

interface PausedScreenProps {
  info: PausedGameInfo;
  onBack: () => void;
}

/**
 * What a persisted room code shows instead of the game: 'paused' waits for
 * the host to reopen it (host password); 'resuming' lists the original seats
 * and lets each player claim theirs back with the lobby password.
 */
const PausedScreen: React.FC<PausedScreenProps> = ({ info, onBack }) => {
  const { socket, openResumeLobby, unlockResumeLobby, claimSeat, closeResumeLobby, startGame } =
    useSocket();
  const { gameRoom } = useGameRoom();
  const [hostPassword, setHostPassword] = useState('');
  const [lobbyPassword, setLobbyPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The host (seat 0) gets the continue button once everyone claimed back in.
  const isHostSeat = !!gameRoom && gameRoom.players[0]?.id === socket?.id;
  const everyoneBack = info.players.length > 0 && info.players.every((p) => p.connected);

  // A seat token already saved for this room re-attaches silently — the
  // server bypasses the password for token holders.
  const saved = readSavedSession();
  const hadSeat = saved?.roomId === info.roomId && !!saved.token;

  const reopen = () => {
    setError(null);
    openResumeLobby(info.roomId, hostPassword);
  };
  const unlock = () => {
    setError(null);
    if (!info.requiresLobbyPassword) {
      setUnlocked(true);
      return;
    }
    unlockResumeLobby(info.roomId, lobbyPassword);
  };
  const claim = (name: string) => {
    saveSession({ roomId: info.roomId, playerName: name });
    claimSeat(info.roomId, name, info.requiresLobbyPassword ? lobbyPassword : undefined);
  };

  React.useEffect(() => {
    if (!socket) return;
    const onUnlocked = (d: { roomId: string }) => {
      if (d.roomId === info.roomId) setUnlocked(true);
    };
    const onError = (e: { message: string }) => setError(e.message);
    socket.on('resumeLobbyUnlocked', onUnlocked);
    socket.on('error', onError);
    return () => {
      socket.off('resumeLobbyUnlocked', onUnlocked);
      socket.off('error', onError);
    };
  }, [socket, info.roomId]);

  const expired = info.expiresAt;
  const expiryText = `Expires ${new Date(expired).toLocaleDateString()}`;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow p-5 w-full max-w-[420px] flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-center m-0">
            {info.status === 'paused' ? '⏸️ Game paused' : '▶️ Rejoining game'}
          </h1>
          <p className="text-center text-gray-500 text-sm mt-1 mb-0">
            Room {info.roomId} · {expiryText}
          </p>
        </div>

        {info.status === 'paused' ? (
          <>
            <p className="text-sm text-gray-700 m-0">
              This game was saved for later. The host can reopen it — everyone else keeps this
              link and comes back once the lobby is open.
            </p>
            <div className="flex flex-col gap-2">
              <input
                type="password"
                value={hostPassword}
                onChange={(e) => setHostPassword(e.target.value)}
                placeholder="Host password"
                maxLength={PASSWORD_MAX}
                className="w-full px-3 py-2 rounded-md border-2 border-gray-200 text-[15px] focus:border-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={reopen}
                disabled={!hostPassword}
                className="w-full py-2.5 rounded-md bg-blue-600 text-white text-[15px] font-semibold cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Lobby Again (host)
              </button>
            </div>
          </>
        ) : (
          <>
            {info.players.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-gray-700 m-0">Pick your player to get back in:</p>
                {info.players.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    disabled={p.connected || !unlocked}
                    onClick={() => claim(p.name)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md border-2 border-gray-200 bg-white text-left cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white shadow"
                      style={{ background: p.color }}
                    />
                    <span className="text-[15px] font-semibold text-gray-800">{p.name}</span>
                    <span className="ml-auto text-[12px] text-gray-400">
                      {p.connected ? 'back in ✓' : 'waiting…'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!unlocked ? (
              <div className="flex flex-col gap-2">
                {info.requiresLobbyPassword && (
                  <input
                    type="password"
                    value={lobbyPassword}
                    onChange={(e) => setLobbyPassword(e.target.value)}
                    placeholder="Lobby password"
                    maxLength={PASSWORD_MAX}
                    className="w-full px-3 py-2 rounded-md border-2 border-gray-200 text-[15px] focus:border-blue-500 outline-none"
                  />
                )}
                <button
                  type="button"
                  onClick={unlock}
                  disabled={info.requiresLobbyPassword && !lobbyPassword}
                  className="w-full py-2.5 rounded-md bg-blue-600 text-white text-[15px] font-semibold cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {info.requiresLobbyPassword ? 'Unlock lobby' : 'Show seats'}
                </button>
              </div>
            ) : (
              hadSeat && (
                <p className="text-[13px] text-gray-500 m-0 text-center">
                  Your saved seat re-joins automatically when it's free — or pick it above.
                </p>
              )
            )}
            {/* The host continues the game once every seat is back; anyone
                else just waits for that broadcast. */}
            {isHostSeat && (
              <button
                type="button"
                onClick={() => startGame(info.roomId)}
                disabled={!everyoneBack}
                className="w-full py-2.5 rounded-md bg-green-600 text-white text-[15px] font-semibold cursor-pointer hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {everyoneBack ? '▶️ Continue game' : 'Waiting for everyone to rejoin…'}
              </button>
            )}
            {/* The host (seat 0) can cancel the lobby back to paused. The
                server re-checks by socket regardless of this button. */}
            {isHostSeat && (
              <button
                type="button"
                onClick={() => closeResumeLobby(info.roomId)}
                className="text-[13px] text-gray-500 hover:text-gray-800 cursor-pointer"
              >
                Close this lobby (host)
              </button>
            )}
          </>
        )}

        {error && <p className="text-[13px] text-red-600 m-0 text-center">{error}</p>}
        <button
          type="button"
          onClick={() => {
            clearSavedSession();
            onBack();
          }}
          className="text-[13px] text-gray-500 hover:text-gray-800 cursor-pointer"
        >
          ← Back to lobby
        </button>
      </div>
    </div>
  );
};

export default PausedScreen;
