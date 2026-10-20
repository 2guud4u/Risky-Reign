import React from 'react';
import Button from './ui/Button';

/**
 * Slim banner shown while the socket is disconnected, so a dropped connection
 * mid-game is visible instead of leaving the board silently frozen. Socket.io
 * retries with backoff on its own — "Retry now" forces an attempt immediately,
 * and on reconnect the client re-joins the room automatically (RoomSession).
 */
const ConnectionBanner: React.FC<{ hidden: boolean; message?: string; onRetry?: () => void }> = ({
  hidden,
  message,
  onRetry,
}) => {
  if (hidden) return null;
  return (
    <div className="fixed top-[env(safe-area-inset-top)] left-1/2 -translate-x-1/2 z-[100] bg-gold text-white text-[13px] font-semibold px-4 py-1.5 rounded-b-md shadow-lg flex items-center gap-2">
      {message ?? 'Connection lost — reconnecting…'}
      {onRetry && (
        <Button
          variant="unstyled"
          onClick={onRetry}
          className="bg-canvas-raised/20 hover:bg-canvas-raised/30 rounded px-2 py-0.5"
        >
          Retry now
        </Button>
      )}
    </div>
  );
};

export default ConnectionBanner;
