import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { readSavedSession, saveSession } from '../utils/session';
import { generateRoomCode } from 'common';
import Button from '../components/ui/Button';

const inputClass =
  'w-full px-3 py-2 border border-ink-faint/40 rounded-md text-sm bg-white text-ink placeholder:text-ink-faint focus:border-gold focus:outline-none';


interface LobbyProps {
  error: string | null;
}

const LobbyPage: React.FC<LobbyProps> = ({ error }) => {
  const [roomId, setRoomId] = useState('');
  const [password, setPassword] = useState('');
  const { isConnected, joinRoom: onJoinRoom, quickPlay: onQuickPlay } = useSocket();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      onJoinRoom('', roomId.trim(), undefined, undefined, password.trim() || undefined);
      // Persist the join so a reload auto-rejoins. The name is chosen after
      // joining; the session is updated once the name is set.
      const saved = readSavedSession();
      saveSession({ roomId: roomId.trim(), playerName: '', ...(saved?.roomId === roomId.trim() ? { token: saved.token } : {}) });
    }
  };

  // Creating a game = joining a fresh, server-free room code (the server
  // creates the room on first join). The code is surfaced in-game to share.
  const handleCreateRoom = () => {
    const code = generateRoomCode();
    onJoinRoom('', code);
    saveSession({ roomId: code, playerName: '' });
  };

  const canJoin = isConnected && !!roomId.trim();

  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="bg-canvas-raised rounded-xl shadow-card p-5 w-full max-w-[420px]">
        <h1 className="text-[28px] font-bold text-center mb-6 text-ink">Risky Reign Lobby</h1>

        {/* Create a brand-new game: generates a fresh room code. */}
        <Button
          variant="primary"
          size="lg"
          onClick={handleCreateRoom}
          disabled={!isConnected}
          className="w-full mb-4"
        >
          {isConnected ? 'Create Game' : 'Connecting...'}
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-ink-faint/40" />
          <span className="text-[12px] text-ink-faint font-semibold">or</span>
          <div className="flex-1 h-px bg-ink-faint/40" />
        </div>

        <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
          <div>
            <label className="block text-[13px] font-semibold mb-1.5 text-ink">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Enter room ID"
              required
              className={inputClass}
            />
            <p className="text-xs text-ink-faint mt-1">
              Enter the code a friend shared to join their game
            </p>
          </div>

          <div>
            <label className="block text-[13px] font-semibold mb-1.5 text-ink">
              Password <span className="text-ink-faint font-normal">(only if the room is private)</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for open rooms"
              className={inputClass}
            />
          </div>

          <Button
            variant="primary"
            type="submit"
            disabled={!canJoin}
            className="w-full"
          >
            {isConnected ? 'Join Game' : 'Connecting...'}
          </Button>
        </form>

        <Button
          variant="secondary"
          size="lg"
          onClick={onQuickPlay}
          disabled={!isConnected}
          className="w-full mt-3"
        >
          ⚡ Quick Play
        </Button>

        {error && (
          <div className="mt-4 p-3 bg-clay-pale border border-clay/40 text-clay rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="mt-5 text-center">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-[13px] font-semibold ${
              isConnected ? 'bg-moss-pale text-moss' : 'bg-clay-pale text-clay'
            }`}
          >
            {isConnected ? '✓ Connected to server!' : 'Disconnected'}
          </span>
        </div>

      </div>
    </div>
  );
};

export default LobbyPage;
