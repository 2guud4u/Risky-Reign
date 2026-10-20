import React from 'react';
import { TrashCanProps } from './types';
import GameIcon from '../components/ui/GameIcon';

/**
 * Trash-can overlay: drop a dragged hex here to delete it, or a dragged number
 * to clear it. Highlights while hovered during a deletable drag.
 */
const TrashCan: React.FC<TrashCanProps> = ({ ref, draggingDeletable, overTrash }) => (
  <div
    ref={ref}
    className={`absolute top-3 right-3 flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 text-3xl select-none pointer-events-none transition-colors ${
      overTrash && draggingDeletable
        ? 'border-clay bg-clay-pale'
        : draggingDeletable
        ? 'border-ink-soft bg-canvas-raised'
        : 'border-ink-faint/50 bg-canvas-raised/90'
    }`}
    title="Drag a hex or a number here to delete it"
  >
    <span><GameIcon name="trash" size={20} /></span>
  </div>
);

export default TrashCan;
