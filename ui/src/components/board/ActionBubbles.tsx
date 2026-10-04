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
  /**
   * Optional sub-options: expanding this bubble turns it into a pill
   * containing them instead of a confirm (e.g. heal: pick Wheat or Sheep).
   */
  choices?: BubbleAction[];
  /**
   * Choices only: whether this option is usable. Ineligible options are not
   * shown in the pill at all (e.g. no Wheat to pay with).
   */
  eligible?: boolean;
  /**
   * Move choices only: compass direction (N / NE / … / NW) and the arrow
   * rotation (degrees, 0 = up) for the SVG arrow shown instead of an emoji.
   */
  direction?: string;
  angle?: number;
  /** Choice bubbles only: expand upward into a vertical column (attack). */
  column?: boolean;
  /** Column choices only: a player color swatch shown beside the label (attack target). */
  color?: string;
}

interface ActionBubbleProps {
  action: BubbleAction;
  open: boolean;
  onClick: () => void;
}

/**
 * One round action bubble. Collapsed it shows only the icon; expanded it shows
 * the label plus the cost ("tap to confirm") or, when blocked, the reason.
 * Choice actions (e.g. heal) are rendered as a pill of choices instead, by
 * the container; the caller owns the expand/confirm state.
 */
export const ActionBubble: React.FC<ActionBubbleProps> = ({ action: a, open, onClick }) => {
  const ok = a.check.allowed;
  return (
    <button
      type="button"
      onClick={onClick}
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
};

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
    // An open choice pill collapses when clicked; a regular bubble confirms.
    if (a.choices) {
      setExpanded(null);
      return;
    }
    if (!a.check.allowed) {
      setExpanded(null); // expanded + blocked: collapse (the reason was shown)
      return;
    }
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
        // A choice bubble shows its pill of eligible options when expanded;
        // with none eligible it behaves as a normal greyed bubble (reason).
        const hasChoices = !!a.choices && a.choices.some((c) => c.eligible);
        const isPill = hasChoices && expanded === a.key;
        if (!isPill) {
          return (
            <ActionBubble key={a.key} action={a} open={expanded === a.key} onClick={() => onBubbleClick(a)} />
          );
        }
        // Expanded choice pill: the action's icon/label plus one button per
        // eligible choice (ineligible ones, e.g. no Wheat, are not shown).
        const isColumn = !!a.column;
        if (isColumn) {
          // Column (attack): the bubble stays put, lit up, and the options
          // pop up above it as a stack of name chips — nearest first.
          const options = a.choices?.filter((c) => c.eligible) ?? [];
          return (
            <div key={a.key} role="group" aria-label={a.label} className="relative flex flex-col items-center">
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-2">
                {options.map((c, i) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => {
                      c.run();
                      setExpanded(null);
                    }}
                    aria-label={`${a.label}: ${c.label}`}
                    title={c.label}
                    className="bubble-pop flex items-center gap-2 h-10 pl-2 pr-4 rounded-full bg-white border-2 shadow-lg text-[14px] font-bold text-gray-800 whitespace-nowrap cursor-pointer transition-transform duration-150 hover:scale-110"
                    style={{ borderColor: c.color ?? '#d1d5db', animationDelay: `${i * 50}ms` }}
                  >
                    <span
                      className="w-6 h-6 rounded-full border-2 border-white shadow-inner"
                      style={{ background: c.color ?? '#9ca3af' }}
                      aria-hidden="true"
                    />
                    {c.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onBubbleClick(a)}
                aria-expanded="true"
                aria-label={`Close ${a.label}`}
                title={a.label}
                className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-blue-700 bg-blue-600 ring-4 ring-blue-300/60 shadow-lg text-2xl leading-none cursor-pointer transition-all duration-200"
              >
                <span aria-hidden="true">{a.icon}</span>
              </button>
            </div>
          );
        }
        return (
          <div
            key={a.key}
            role="group"
            aria-label={a.label}
            className="flex items-center gap-2 pl-3 pr-4 h-14 rounded-full border-2 border-blue-700 bg-blue-600 text-white shadow-lg transition-all duration-200"
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-2xl leading-none" aria-hidden="true">
              {a.icon}
            </span>
            <span className="text-[13px] font-bold whitespace-nowrap">{a.label}</span>
            {a.choices
              ?.filter((c) => c.eligible)
              .map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => {
                    c.run();
                    setExpanded(null);
                  }}
                  aria-label={`Confirm: ${c.label}`}
                  title={`${c.label} — ${c.costText}`}
                  className="flex items-center justify-center gap-1 px-3 h-10 rounded-full bg-white/20 border border-white/40 text-xl leading-none cursor-pointer transition-all duration-150 hover:bg-white/35 hover:scale-105"
                >
                  {c.direction ? (
                    <svg
                      viewBox="0 0 24 24"
                      width="22"
                      height="22"
                      style={{ transform: `rotate(${c.angle ?? 0}deg)` }}
                      aria-hidden="true"
                    >
                      <path d="M12 3 L17 12 L13.5 12 L13.5 21 L10.5 21 L10.5 12 L7 12 Z" fill="currentColor" />
                    </svg>
                  ) : (
                    <span aria-hidden="true">{c.icon}</span>
                  )}
                  <span className="text-[12px] font-bold">{c.costText}</span>
                </button>
              ))}
          </div>
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
