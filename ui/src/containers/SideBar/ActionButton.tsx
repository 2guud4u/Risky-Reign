import React from 'react';
import { BuildCheck } from 'common';
import { buildButtonClass } from './styles';

interface ActionButtonProps {
  label: React.ReactNode;
  /** Eligibility from `useBuildRules` (the backend's own rule check). */
  check: BuildCheck;
  onDo: () => void;
  /** Called with the reason text when a greyed button is clicked. */
  onBlocked: (reason: string) => void;
}

/**
 * An action button that stays visible but greys out when unavailable.
 * Clicking a greyed button reports the reason via `onBlocked` instead of
 * running the action.
 */
export const ActionButton: React.FC<ActionButtonProps> = ({ label, check, onDo, onBlocked }) => (
  <button
    type="button"
    onClick={() => (check.allowed ? onDo() : onBlocked(check.reason ?? 'Not allowed here'))}
    aria-disabled={!check.allowed}
    className={`${buildButtonClass} ${
      check.allowed ? '' : 'bg-gray-300 border-gray-300 hover:bg-gray-300 cursor-not-allowed'
    }`}
  >
    {label}
  </button>
);

/** The inline reason popup shown under the actions when a greyed button is clicked. */
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
      ✕
    </button>
  </div>
);
