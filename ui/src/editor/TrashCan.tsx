import React from 'react';
import { TrashCanProps } from './types';

/**
 * Trash-can overlay: drop a dragged hex here to delete it, or a dragged number
 * to clear it. Highlights while hovered during a deletable drag.
 */
const TrashCan: React.FC<TrashCanProps> = ({ ref, draggingDeletable, overTrash }) => (
  <div
    ref={ref}
    className={`absolute top-3 right-3 flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 text-3xl select-none pointer-events-none transition-colors ${
      overTrash && draggingDeletable
        ? 'border-red-500 bg-red-100'
        : draggingDeletable
        ? 'border-gray-400 bg-white/80'
        : 'border-gray-300 bg-white/60'
    }`}
    title="Drag a hex or a number here to delete it"
  >
    <span>🗑️</span>
  </div>
);

export default TrashCan;
