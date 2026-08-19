import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

const LobbyPage: React.FC<{ error: string | null }> = ({ error }) => {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const { isConnected, joinRoom: onJoinRoom } = useSocket();

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim() && roomId.trim()) {
      onJoinRoom(playerName.trim(), roomId.trim());
    }
  };

  const generateRoomId = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomId(randomId);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ccc',
    borderRadius: 6,
    boxSizing: 'border-box',
    fontSize: 14,
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div className="board-frame" style={{ width: '100%', maxWidth: 420 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 24 }}>
          Catan Lobby
        </h1>

        <form onSubmit={handleJoinRoom} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Room ID
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter room ID"
                required
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={generateRoomId}
                title="Generate random room ID"
                style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: 6, background: '#f0f0f0', cursor: 'pointer' }}
              >
                🎲
              </button>
            </div>
            <p style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              Share this room ID with a friend to play together
            </p>
          </div>

          <button
            type="submit"
            disabled={!isConnected || !playerName.trim() || !roomId.trim()}
            style={{
              padding: '10px 16px',
              background: isConnected ? '#2563eb' : '#9ca3af',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: isConnected ? 'pointer' : 'not-allowed',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            {isConnected ? 'Join Game' : 'Connecting...'}
          </button>
        </form>

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              background: '#fee2e2',
              border: '1px solid #f87171',
              color: '#b91c1c',
              borderRadius: 6,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 12px',
              borderRadius: 999,
              fontSize: 13,
              background: isConnected ? '#dcfce7' : '#fee2e2',
              color: isConnected ? '#166534' : '#b91c1c',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                marginRight: 8,
                background: isConnected ? '#22c55e' : '#ef4444',
              }}
            />
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: '#eff6ff', borderRadius: 8 }}>
          <h3 style={{ fontWeight: 600, color: '#1e40af', marginBottom: 8 }}>How to Play:</h3>
          <ul style={{ fontSize: 13, color: '#1e3a8a', paddingLeft: 18, margin: 0 }}>
            <li>Enter your name and create/join a room</li>
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
