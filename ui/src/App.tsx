import React from 'react';
import { GameRoomProvider } from './contexts/GameContext';
import { SocketProvider } from './contexts/SocketContext';
import GameLogic from './components/GameLogic';

/**
 * Catches render errors from server-pushed room state (a malformed payload,
 * a missing board, a stale id) so a single bad update degrades to a recoverable
 * screen instead of unmounting the whole tree into a blank page. Reloading is
 * safe: the session auto-rejoin restores the room.
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
          <div className="bg-white rounded-lg shadow p-8 max-w-[480px] w-full text-center">
            <h1 className="text-2xl font-bold mb-3">Something went wrong</h1>
            <p className="text-gray-600 mb-5">
              The game hit an unexpected state. Reload to rejoin your room.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 px-4 border-0 rounded-md text-[15px] font-semibold text-white bg-blue-500 cursor-pointer"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Root component. Layers the providers (game room state + socket) and hands
 * off to GameLogic, which routes between the Lobby and the Game. An error
 * boundary wraps the tree so a single bad render degrades gracefully.
 */
function App() {
  return (
    <ErrorBoundary>
      <GameRoomProvider>
        <SocketProvider>
          <GameLogic />
        </SocketProvider>
      </GameRoomProvider>
    </ErrorBoundary>
  );
}

export default App;
