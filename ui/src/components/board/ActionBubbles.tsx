import React, { useEffect, useState } from 'react';
import { BuildCheck } from 'common';
import { useGameRoom } from '../../contexts/GameContext';

/** One action shown as a bubble on the map. */
export interface BubbleAction {
  key: string;
  /** Emoji shown in the collapsed bubble. */
  icon: string;
  label: string;
  /** Cost text shown when expanded (e.g. "1 🪵, 1 🧱" or "FREE 🛤️"). */
  costText: string;
  /** The backend's own rule check: allowed, or the reason it isn't. */
  check: BuildCheck;
  run: () => void;
}

interface ActionBubblesProps {
  actions: BubbleAction[];
  /** Changing this collapses any expanded bubble (e.g. the selected object id). */
  resetKey: string;
}

/**
 * Actions for the selected board object, shown as round bubbles along the
 * bottom of the map. Two-step: the first click expands a bubble to show what
 * it does and what it costs; a second click on the expanded bubble confirms.
 * Unavailable actions stay visible but greyed — expanding one shows the reason
 * instead of a confirm. A trailing ✕ bubble clears the selection, which zooms
 * the board back to where it was before the click.
 */
const ActionBubbles: React.FC<ActionBubblesProps> = ({ actions, resetKey }) => {
  const { setSelectedObject } = useGameRoom();
  const [expanded, setExpanded] = useState<string | null>(null);

  // A new selection starts fresh.
  useEffect(() => setExpanded(null), [resetKey]);

  const onBubbleClick = (a: BubbleAction) => {
    if (expanded !== a.key) {
      setExpanded(a.key);
      return;
    }
    if (!a.check.allowed) return; // expanded + blocked: the reason is already shown
    a.run();
    setExpanded(null);
  };

  return (
    <div
      // Bottom center of the map (the turn status bar lives top center).
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-end gap-3"
      // Don't let clicks here start a board pan or clear the selection.
      onMouseDown={(e) => e.stopPropagation()}
    >
      {actions.map((a) => {
        const open = expanded === a.key;
        const ok = a.check.allowed;
        return (
          <button
            key={a.key}
            type="button"
            onClick={() => onBubbleClick(a)}
            aria-expanded={open}
            aria-label={open ? (ok ? `Confirm: ${a.label}` : `${a.label} unavailable`) : a.label}
            title={open ? undefined : a.label}
            className={`flex items-center gap-2 h-14 rounded-full border-2 shadow-lg transition-all duration-200 cursor-pointer ${
              open ? 'pl-2 pr-4' : 'w-14 justify-center'
            } ${
              ok
                ? open
                  ? 'bg-blue-600 border-blue-700 text-white'
                  : 'bg-white border-gray-300 hover:scale-110 hover:border-blue-500'
                : open
                  ? 'bg-white border-gray-300 text-gray-800'
                  : 'bg-gray-200 border-gray-300'
            }`}
          >
            <span
              className={`flex items-center justify-center text-2xl leading-none ${
                open ? 'w-10 h-10 rounded-full bg-white/20' : ''
              } ${ok ? '' : 'grayscale opacity-50'}`}
              aria-hidden="true"
            >
              {a.icon}
            </span>
            {open && (
              <span className="flex flex-col items-start text-left leading-tight whitespace-nowrap">
                <span className="text-[13px] font-bold">{a.label}</span>
                {ok ? (
                  <span className="text-[12px] opacity-90">{a.costText} · tap to confirm</span>
                ) : (
                  <span className="text-[12px] text-red-600 max-w-[220px] whitespace-normal">
                    {a.check.reason ?? 'Not allowed here'}
                  </span>
                )}
              </span>
            )}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => setSelectedObject(null)}
        aria-label="Close and zoom back out"
        title="Close"
        className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-gray-300 bg-white shadow-lg text-2xl leading-none text-gray-700 cursor-pointer transition-all duration-200 hover:scale-110 hover:border-gray-500"
      >
        {'✕'}
      </button>
    </div>
  );
};

export default ActionBubbles;
