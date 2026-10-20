import React from 'react';
import GameIcon from '../../components/ui/GameIcon';
import Button from '../../components/ui/Button';

/** Inline reason popup shown when a greyed-out action is clicked. */
export const ReasonNotice: React.FC<{ reason: string; onDismiss: () => void }> = ({
  reason,
  onDismiss,
}) => (
  <div className="flex items-start gap-1.5 text-[12px] text-clay bg-clay-pale border border-clay-soft rounded-md px-2 py-1.5">
    <span className="flex-1">{reason}</span>
    <Button
      variant="unstyled"
      onClick={onDismiss}
      className="text-clay-soft hover:text-clay leading-none"
      aria-label="Dismiss"
    >
      <GameIcon name="x" size={13} />
    </Button>
  </div>
);
