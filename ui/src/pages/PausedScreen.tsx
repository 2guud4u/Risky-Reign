import React, { useState } from 'react';
import { PausedGameInfo } from 'common';
import { useSocket } from '../contexts/SocketContext';
import { useGameRoom } from '../contexts/GameContext';
import { saveSession, clearSavedSession, readSavedSession } from '../utils/session';
import { PASSWORD_MAX } from 'common';
import Button from '../components/ui/Button';

const inputClass =
  'w-full px-3 py-2 rounded-md border-2 border-ink-faint/40 bg-white text-ink text-[15px] placeholder:text-ink-faint focus:border-gold focus:outline-none';

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
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="bg-canvas-raised rounded-xl shadow-card p-5 w-full max-w-[420px] flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-center m-0 text-ink">
            {info.status === 'paused' ? '⏸️ Game paused' : '▶️ Rejoining game'}
          </h1>
          <p className="text-center text-ink-soft text-sm mt-1 mb-0">
            Room {info.roomId} · {expiryText}
          </p>
        </div>

        {info.status === 'paused' ? (
          <>
            <p className="text-sm text-ink-soft m-0">
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
                className={inputClass}
              />
              <Button
                variant="primary"
                onClick={reopen}
                disabled={!hostPassword}
                className="w-full"
              >
                Start Lobby Again (host)
              </Button>
            </div>
          </>
        ) : (
          <>
            {info.players.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-ink-soft m-0">Pick your player to get back in:</p>
                {info.players.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    disabled={p.connected || !unlocked}
                    onClick={() => claim(p.name)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-md border-2 border-ink-faint/40 bg-white text-left cursor-pointer hover:border-gold hover:bg-gold-pale transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span
                      className="w-5 h-5 rounded-full border-2 border-white shadow"
                      style={{ background: p.color }}
                    />
                    <span className="text-[15px] font-semibold text-ink">{p.name}</span>
                    <span className="ml-auto text-[12px] text-ink-faint">
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
                    className={inputClass}
                  />
                )}
                <Button
                  variant="primary"
                  onClick={unlock}
                  disabled={info.requiresLobbyPassword && !lobbyPassword}
                  className="w-full"
                >
                  {info.requiresLobbyPassword ? 'Unlock lobby' : 'Show seats'}
                </Button>
              </div>
            ) : (
              hadSeat && (
                <p className="text-[13px] text-ink-faint m-0 text-center">
                  Your saved seat re-joins automatically when it's free — or pick it above.
                </p>
              )
            )}
            {/* The host continues the game once every seat is back; anyone
                else just waits for that broadcast. */}
            {isHostSeat && (
              <Button
                variant="primary"
                onClick={() => startGame(info.roomId)}
                disabled={!everyoneBack}
                className="w-full !bg-moss hover:!bg-moss-soft"
              >
                {everyoneBack ? '▶️ Continue game' : 'Waiting for everyone to rejoin…'}
              </Button>
            )}
            {/* The host (seat 0) can cancel the lobby back to paused. The
                server re-checks by socket regardless of this button. */}
            {isHostSeat && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => closeResumeLobby(info.roomId)}
              >
                Close this lobby (host)
              </Button>
            )}
          </>
        )}

        {error && <p className="text-[13px] text-clay m-0 text-center">{error}</p>}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearSavedSession();
            onBack();
          }}
        >
          ← Back to lobby
        </Button>
      </div>
    </div>
  );
};

export default PausedScreen;
