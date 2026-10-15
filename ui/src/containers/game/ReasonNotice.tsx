import React from 'react';
import GameIcon from '../../components/ui/GameIcon';

/** Inline reason popup shown when a greyed-out action is clicked. */
export const ReasonNotice: React.FC<{ reason: string; onDismiss: () => void }> = ({
  reason,
  onDismiss,
}) => (
  <div className="flex items-start gap-1.5 text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
    <span className="flex-1">{reason}</span>
    <button
      type="button"
      onClick={onDismiss}
      className="text-red-400 hover:text-red-600 leading-none cursor-pointer"
      aria-label="Dismiss"
    >
      <GameIcon name="x" size={13} />
    </button>
  </div>
);
