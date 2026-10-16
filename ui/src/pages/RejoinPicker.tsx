import React, { useEffect, useState } from 'react';
import { RejoinSeat } from 'common';
import { useSocket } from '../contexts/SocketContext';
import { saveSession, clearSavedSession, readSavedSession } from '../utils/session';
import Button from '../components/ui/Button';
import { Eye } from 'lucide-react';
import GameIcon from '../components/ui/GameIcon';

interface RejoinPickerProps {
  roomId: string;
  /** Seats whose player dropped out; empty = nobody left, spectate only. */
  seats: RejoinSeat[];
  onBack: () => void;
}

/**
 * Shown when you open a link to a game that already started and the browser
 * holds no seat for it: pick which player you were (only seats whose player
 * has dropped out are offered), or just watch. If nobody has left, watching is
 * the only option.
 */
const RejoinPicker: React.FC<RejoinPickerProps> = ({ roomId, seats, onBack }) => {
  const { claimSeat, spectateRoom, socket } = useSocket();
  const [watchPassword, setWatchPassword] = useState('');
  // Private rooms gate spectating too: the server rejects the first
  // spectateRoom, we surface a password field and retry with it.
  const [watchNeedsPassword, setWatchNeedsPassword] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const onError = (e: { message: string; code?: string }) => {
      if (e.code === 'PASSWORD_REQUIRED') setWatchNeedsPassword(true);
    };
    socket.on('error', onError);
    return () => {
      socket.off('error', onError);
    };
  }, [socket]);

  const claim = (name: string) => {
    // The server answers with a fresh seat token (`joined`), saved onto this.
    saveSession({ roomId, playerName: name });
    claimSeat(roomId, name);
  };
  const watch = () => {
    const pw = watchPassword.trim();
    saveSession({
      roomId,
      playerName: '',
      spectating: true,
      ...(pw ? { password: pw } : readSavedSession()?.roomId === roomId ? { password: readSavedSession()?.password } : {}),
    });
    spectateRoom(roomId, pw || undefined);
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="bg-canvas-raised rounded-xl shadow-card p-5 w-full max-w-[420px] flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-center m-0 text-ink">Game in progress</h1>
          <p className="text-center text-ink-soft text-sm mt-1 mb-0">Room {roomId}</p>
        </div>

        {seats.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-soft m-0">Who were you? Pick your player to jump back in:</p>
            {seats.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => claim(s.name)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-md border-2 border-ink-faint/40 bg-white text-left cursor-pointer hover:border-gold hover:bg-gold-pale transition-colors"
              >
                <span className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ background: s.color }} />
                <span className="text-[15px] font-semibold text-ink">{s.name}</span>
                <span className="ml-auto text-[12px] text-ink-faint">offline · rejoin</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft m-0">
            Every player is still connected, so there's no seat to take. You can watch the game.
          </p>
        )}

        {watchNeedsPassword && (
          <div>
            <label className="block text-[13px] font-semibold mb-1.5 text-ink">
              <GameIcon name="lock" size={12} className="inline -mt-0.5" /> Room Password
            </label>
            <input
              type="password"
              value={watchPassword}
              onChange={(e) => setWatchPassword(e.target.value)}
              placeholder="This room is private"
              autoFocus
              className="w-full px-3 py-2 rounded-md border-2 border-ink-faint/40 bg-white text-ink text-[15px] focus:border-gold focus:outline-none"
            />
          </div>
        )}

        <Button
          variant={seats.length > 0 ? 'secondary' : 'primary'}
          onClick={watch}
          icon={<Eye size={16} />}
          className="w-full"
        >
          Just watch
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            clearSavedSession();
            onBack();
          }}
        >
          <GameIcon name="arrowLeft" size={13} className="inline -mt-0.5" /> Back to lobby
        </Button>
      </div>
    </div>
  );
};

export default RejoinPicker;
