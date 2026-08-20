import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { PLAYER_COLORS } from 'common';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm';

/** Native color input + quick-pick swatches from the shared palette. */
const ColorPicker: React.FC<{ value: string; onChange: (color: string) => void }> = ({
  value,
  onChange,
}) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-9 h-9 rounded cursor-pointer border border-gray-300 p-0.5"
      title="Pick your color"
    />
    <div className="flex flex-wrap gap-1.5">
      {PLAYER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c}
          className={`w-5 h-5 rounded-full cursor-pointer border-2 ${
            value.toLowerCase() === c.toLowerCase() ? 'border-gray-800' : 'border-transparent'
          }`}
          style={{ background: c }}
        />
      ))}
    </div>
  </div>
);

const LobbyPage: React.FC<{ error: string | null }> = ({ error }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [color, setColor] = useState('#e6194B');
  const { isConnected, joinRoom: onJoinRoom } = useSocket();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && roomId.trim()) {
      onJoinRoom(playerName.trim(), roomId.trim(), color);
    }
  };

  const generateRoomId = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(randomId);
  };

  const canJoin = isConnected && !!playerName.trim() && !!roomId.trim();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow p-4 w-full max-w-[420px]">
        <h1 className="text-[28px] font-bold text-center mb-6">Risky Catan Lobby</h1>

        <form onSubmit={handleJoinRoom} className="flex flex-col gap-4">
          <div>
            <label className="block text-[13px] font-semibold mb-1.5">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-[13px] font-semibold mb-1.5">Room ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter room ID"
                required
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={generateRoomId}
                title="Generate random room ID"
                className="px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-pointer"
              >
                🎲
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Share this room ID with a friend to play together
            </p>
          </div>

          <div>
            <label className="block text-[13px] font-semibold mb-1.5">Your Color</label>
            <ColorPicker value={color} onChange={setColor} />
            <p className="text-xs text-gray-400 mt-1">
              Your settlements and roads on the board will use this color.
            </p>
          </div>

          <button
            type="submit"
            disabled={!canJoin}
            className={`py-2.5 px-4 border-0 rounded-md text-[15px] font-semibold text-white ${
              isConnected ? 'bg-blue-600 cursor-pointer' : 'bg-gray-400 cursor-not-allowed'
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
            <span
              className={`w-2 h-2 rounded-full mr-2 ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">How to Play:</h3>
          <ul className="text-[13px] text-blue-950 pl-[18px] m-0">
            <li>Enter your name, pick a color, and create/join a room</li>
            <li>Share the room ID with a friend</li>
            <li>Take turns placing settlements and roads</li>
            <li>Roll the dice, trade, and build each turn</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;
