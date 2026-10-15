import React, { useEffect, useState } from 'react';
import { BuildCheck } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import GameIcon, { IconName } from '../ui/GameIcon';

/** One action shown as a bubble on the map. */
export interface BubbleAction {
  key: string;
  /** GameIcon name shown in the collapsed bubble. */
  icon: IconName;
  label: string;
  /** Cost shown when expanded (counts + resource icons, or plain text). */
  costText: React.ReactNode;
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
  /** Choice bubbles only: a player color swatch shown beside the label (attack target). */
  color?: string;
  /** Tutorial: a bobbing 👇 points at this bubble ("click here"). */
  coach?: boolean;
  /** Clear the map selection after confirming (placements that change the spot). */
  closeOnRun?: boolean;
  /** Runs on the first click (a toggle, not a purchase): no expand/confirm. */
  instant?: boolean;
}

interface ActionBubbleProps {
  action: BubbleAction;
  open: boolean;
  onClick: () => void;
}

/**
 * One round action bubble. Collapsed it shows the icon with a short caption
 * under it; expanded it shows the label plus the cost ("tap again to
 * confirm") or, when blocked, the reason.
 * Choice actions (e.g. heal) are rendered as a pill of choices instead, by
 * the container; the caller owns the expand/confirm state.
 */
export const ActionBubble: React.FC<ActionBubbleProps> = ({ action: a, open, onClick }) => {
  const ok = a.check.allowed;
  return (
    /* items-end (not items-center): an expanded pill is far wider than 56px,
       so centering would push its right edge past the column and off-screen.
       Right-anchoring keeps the pill's edge on the shared column axis. */
    <div className="relative flex flex-col items-end gap-1 w-14">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-label={open ? (ok ? `Confirm: ${a.label}` : `${a.label} unavailable`) : a.label}
        // h-14 collapsed; expanded grows to fit multi-line reason/cost text
        // (it still sits centered inside its fixed 86px slot).
        className={`flex items-center gap-2 rounded-full border-2 shadow-lg transition-all duration-200 cursor-pointer ${
          open ? 'pl-2 pr-4 py-1.5 min-h-14' : 'w-14 h-14 justify-center'
        } ${
          ok
            ? open
              ? 'bg-blue-600 border-blue-700 text-white'
              : 'bg-white border-gray-300 hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 hover:border-blue-500'
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
          <GameIcon name={a.icon} size={24} />
        </span>
        {open && (
          <span className="flex flex-col items-start text-left leading-tight whitespace-nowrap">
            <span className="text-[13px] font-bold">{a.label}</span>
            {ok ? (
              <span className="text-[12px] opacity-90">{a.costText} · tap again to confirm</span>
            ) : (
              <span className="text-[12px] text-red-600 max-w-[220px] whitespace-normal">
                {a.check.reason ?? 'Not allowed here'}
              </span>
            )}
          </span>
        )}
      </button>
      {/* Collapsed: a short caption so the icon is never a guess. */}
      {!open && (
        /* Out of flow: the caption is wider than the 56px bubble, so keeping
           it in flow would widen this slot and shift the button off the
           column's shared axis. Absolute under the button keeps every
           collapsed icon on one vertical line. */
        <span
          aria-hidden="true"
          className={`absolute top-full mt-1 right-0 px-1.5 py-px rounded bg-black/60 text-[10px] font-semibold text-white whitespace-nowrap ${ok ? '' : 'opacity-70'}`}
        >
          {a.label}
        </span>
      )}
    </div>
  );
};


interface ActionBubblesProps {
  actions: BubbleAction[];
  /** Changing this collapses any expanded bubble (e.g. the selected object id). */
  resetKey: string;
}

/**
 * Actions for the selected board object, docked as a vertical column on the
 * right edge of the map (vertically centered; the bottom edge stays free for
 * the hand tray). Two-step: the first click expands a bubble to show what it
 * does and what it costs; a second click on the expanded bubble confirms.
 * Unavailable actions stay visible but greyed — expanding one shows the
 * reason instead of a confirm. A trailing ✕ bubble clears the selection,
 * which zooms the board back to where it was before the click.
 */
const ActionBubbles: React.FC<ActionBubblesProps> = ({ actions, resetKey }) => {
  const { setSelectedObject } = useGameRoom();
  const [expanded, setExpanded] = useState<string | null>(null);

  // A new selection starts fresh.
  useEffect(() => setExpanded(null), [resetKey]);

  const onBubbleClick = (a: BubbleAction) => {
    if (a.instant && a.check.allowed) {
      a.run();
      setExpanded(null);
      return;
    }
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
    // A placement changes the spot itself (a road now sits on the edge): drop
    // the selection so the now-stale bubble doesn't linger greyed.
    if (a.closeOnRun) setSelectedObject(null);
  };

  return (
    <div
      // Right edge of the map, vertically centered — where the old resource
      // panel lived. The bottom edge stays free for the hand tray.
      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-end gap-3"
      // Don't let clicks here start a board pan or clear the selection.
      onMouseDown={(e) => e.stopPropagation()}
    >
      {actions.map((a) => {
        // A choice bubble shows its pill of eligible options when expanded;
        // with none eligible it behaves as a normal greyed bubble (reason).
        const hasChoices = !!a.choices && a.choices.some((c) => c.eligible);
        const isPill = hasChoices && expanded === a.key;
        // Every item lives in a fixed-height slot: the collapsed bubble +
        // its caption is ~86px tall, and the expanded pill is centered inside
        // the same slot — siblings never shift when a bubble opens.
        if (!isPill) {
          const bubble = (
            <ActionBubble key={a.key} action={a} open={expanded === a.key} onClick={() => onBubbleClick(a)} />
          );
          return (
            <div key={a.key} className="relative h-[86px] flex items-center justify-center">
              {a.coach && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 drop-shadow-lg"
                >
                  <span className="pointer-finger inline-block">
                    <GameIcon name="pointer" size={44} style={{ transform: 'scaleY(-1)' }} />
                  </span>
                </span>
              )}
              {bubble}
            </div>
          );
        }
        // Expanded choice bubble: the bubble stays put (lit) and its eligible
        // options pop leftward as a stack of chips — column is a fixed-width
        // region, so choices live off to the left instead of inside the pill.
        const options = a.choices?.filter((c) => c.eligible) ?? [];
        return (
          <div key={a.key} role="group" aria-label={a.label} className="relative h-[86px] flex flex-col items-center justify-center">
            <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 flex flex-col items-end gap-2">
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
                  className="bubble-pop flex items-center gap-2 h-10 pl-2 pr-4 rounded-full bg-white border-2 shadow-lg text-[14px] font-bold text-gray-800 whitespace-nowrap cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
                  style={{ borderColor: c.color ?? '#d1d5db', animationDelay: `${i * 50}ms` }}
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
                  ) : c.color ? (
                    <span
                      className="w-6 h-6 rounded-full border-2 border-white shadow-inner"
                      style={{ background: c.color }}
                      aria-hidden="true"
                    />
                  ) : c.icon ? (
                    <GameIcon name={c.icon} size={22} />
                  ) : null}
                  <span>{c.costText}</span>
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
              <GameIcon name={a.icon} size={24} />
            </button>
          </div>
        );
      })}
      {/* Close ✕ sits at the bottom of the column. */}
      <div className="h-[86px] flex flex-col items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => setSelectedObject(null)}
          aria-label="Close and zoom back out"
          title="Close"
          className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-gray-300 bg-white shadow-lg text-2xl leading-none text-gray-700 cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 hover:border-gray-500"
        >
          <GameIcon name="x" size={24} />
        </button>
        <span aria-hidden="true" className="px-1.5 py-px rounded bg-black/60 text-[10px] font-semibold text-white">
          Close
        </span>
      </div>
    </div>
  );
};

export default ActionBubbles;
