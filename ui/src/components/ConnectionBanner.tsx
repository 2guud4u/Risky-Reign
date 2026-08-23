import React from 'react';

/**
 * Slim banner shown while the socket is disconnected, so a dropped connection
 * mid-game is visible instead of leaving the board silently frozen.
 */
const ConnectionBanner: React.FC<{ hidden: boolean; message?: string }> = ({ hidden, message }) => {
  if (hidden) return null;
  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] bg-amber-500 text-white text-[13px] font-semibold px-4 py-1.5 rounded-b-md shadow-lg">
      {message ?? 'Connection lost — reconnecting…'}
    </div>
  );
};

export default ConnectionBanner;
