import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { readSavedSession, saveSession } from '../utils/session';
import { generateRoomCode } from '../utils/roomCode';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm';

interface LobbyProps {
  error: string | null;
}

const LobbyPage: React.FC<LobbyProps> = ({ error }) => {
  const [roomId, setRoomId] = useState('');
  const { isConnected, joinRoom: onJoinRoom } = useSocket();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      onJoinRoom('', roomId.trim());
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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow p-4 w-full max-w-[420px]">
        <h1 className="text-[28px] font-bold text-center mb-6">Risky Reign Lobby</h1>

        {/* Create a brand-new game: generates a fresh room code. */}
        <button
          type="button"
          onClick={handleCreateRoom}
          disabled={!isConnected}
          className={`w-full py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white mb-4 ${
            isConnected ? 'bg-green-600 cursor-pointer hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          {isConnected ? 'Create Game' : 'Connecting...'}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-gray-300" />
          <span className="text-[12px] text-gray-400 font-semibold">or</span>
          <div className="flex-1 h-px bg-gray-300" />
        </div>

        <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="Enter room ID"
              required
              className={inputClass}
            />
            <p className="text-xs text-gray-400 mt-1">
              Enter the code a friend shared to join their game
            </p>
          </div>

          <button
            type="submit"
            disabled={!canJoin}
            className={`py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white ${
              canJoin ? 'bg-blue-600 cursor-pointer hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isConnected ? 'Join Game' : 'Connecting...'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="mt-5 text-center">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-[13px] ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
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
