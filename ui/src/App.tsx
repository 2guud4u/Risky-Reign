import React from 'react';
import { GameRoomProvider } from './contexts/GameContext';
import { SocketProvider } from './contexts/SocketContext';
import GameLogic from './components/GameLogic';

/**
 * Root component. Layers the providers (game room state + socket) and hands
 * off to GameLogic, which routes between the Lobby and the Game.
 */
function App() {
  return (
    <GameRoomProvider>
      <SocketProvider>
        <GameLogic />
      </SocketProvider>
    </GameRoomProvider>
  );
}

export default App;
