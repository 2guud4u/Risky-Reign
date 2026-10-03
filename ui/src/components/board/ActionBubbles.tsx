import React, { useEffect, useState } from 'react';
import { BuildCheck } from 'common';

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

/**
 * Distance of the bubble row from the bottom of the map (px). Clears the
 * bottom control row: turn pill (~44 px tall at `bottom-3`) and the compact
 * dice above it (`bottom: 76`, 40 px tall).
 */
const BUBBLES_BOTTOM_PX = 128;

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
 * instead of a confirm.
 */
const ActionBubbles: React.FC<ActionBubblesProps> = ({ actions, resetKey }) => {
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
      // Sits above the bottom row (☰ menu bottom-left, turn pill + dice
      // bottom-right) so they can't overlap on narrow windows.
      className="absolute left-1/2 -translate-x-1/2 z-20 flex items-end gap-3"
      style={{ bottom: BUBBLES_BOTTOM_PX }}
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
    </div>
  );
};

export default ActionBubbles;
