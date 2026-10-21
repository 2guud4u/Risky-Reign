import React, { useEffect, useMemo, useState } from 'react';
import { BuildCheck } from 'common';
import { useGameActions } from '../../contexts/GameContext';
import GameIcon, { IconName } from '../ui/GameIcon';
import Button from '../ui/Button';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { C } from '../../theme';

declare global {
  interface Window {
    /** Test/debug hook: force family grouping regardless of viewport. */
    __FORCE_GROUP__?: boolean;
  }
}


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
  /**
   * Overflow family this action collapses into when the flat column can't
   * fit the viewport budget (see ActionBubbles). Untagged actions never
   * group.
   */
  family?: 'build' | 'troops' | 'combat' | 'artillery' | 'ship';
  /**
   * Family parents only: the member actions. Opening the parent swaps the
   * column to these, as ordinary circle bubbles stacked above it.
   */
  children?: BubbleAction[];
  /** Running this chip leaves its pill open (a mode toggle, not a shot). */
  keepsOpen?: boolean;
  /** Toggle chips only: whether the mode is currently on (lit styling). */
  active?: boolean;
  /** Option chips only: show even when ineligible (greyed), for toggles. */
  pinned?: boolean;
}

interface ActionBubbleProps {
  action: BubbleAction;
  open: boolean;
  /** Hide the collapsed caption (a neighbor's chip stack is spread over it). */
  hideCaption?: boolean;
  onClick: () => void;
}

/**
 * One round action bubble. Collapsed it shows the icon with a short caption
 * under it; expanded it shows the label plus the cost ("tap again to
 * confirm") or, when blocked, the reason.
 * Choice actions (e.g. heal) are rendered as a pill of choices instead, by
 * the container; the caller owns the expand/confirm state.
 */
export const ActionBubble: React.FC<ActionBubbleProps> = ({ action: a, open, hideCaption, onClick }) => {
  const ok = a.check.allowed;
  return (
    /* items-end (not items-center): an expanded pill is far wider than 56px,
       so centering would push its right edge past the column and off-screen.
       Right-anchoring keeps the pill's edge on the shared column axis. */
    <div className="relative flex flex-col items-end gap-1 w-14">
      <Button
        variant="unstyled"
        onClick={onClick}
        aria-expanded={open}
        aria-label={open ? (ok ? `Confirm: ${a.label}` : `${a.label} unavailable`) : a.label}
        // h-14 collapsed; expanded grows to fit multi-line reason/cost text
        // (it still sits centered inside its fixed 86px slot).
        className={`flex shrink-0 items-center gap-2 rounded-full border-2 shadow-lg transition-all duration-200 ${
          open ? 'w-max pl-2 pr-4 py-1.5 min-h-14' : 'w-14 h-14 justify-center'
        } ${
          ok
            ? open
              ? 'bg-sky border-sky text-white'
              : 'bg-canvas-raised border-ink-faint/50 hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 hover:border-sky'
            : open
              ? 'bg-canvas-raised border-ink-faint/50 text-ink'
              : 'bg-canvas-sunken border-ink-faint/50'
        }`}
      >
        <span
          className={`flex shrink-0 items-center justify-center text-2xl leading-none ${
            open ? 'w-10 h-10 rounded-full bg-canvas-raised/20' : ''
          } ${ok ? '' : 'grayscale opacity-50'}`}
          aria-hidden="true"
        >
          <GameIcon name={a.icon} size={24} />
        </span>
        {open && (
          <span className="flex shrink-0 flex-col items-start text-left leading-tight whitespace-nowrap">
            <span className="text-[13px] font-bold">{a.label}</span>
            {ok ? (
              <span className="text-[12px] opacity-90">{a.costText} · tap again to confirm</span>
            ) : (
              <span className="text-[12px] text-clay max-w-[220px] whitespace-normal">
                {a.check.reason ?? 'Not allowed here'}
              </span>
            )}
          </span>
        )}
      </Button>
      {/* Collapsed: a short caption so the icon is never a guess. */}
      {!open && !hideCaption && (
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

/** Parent bubble look per overflow family. */
const FAMILY_META: Record<
  NonNullable<BubbleAction['family']>,
  { icon: IconName; label: string }
> = {
  build: { icon: 'build', label: 'Build' },
  troops: { icon: 'move', label: 'Troops' },
  combat: { icon: 'attack', label: 'Combat' },
  artillery: { icon: 'cannon', label: 'Artillery' },
  ship: { icon: 'ship', label: 'Ship' },
};

/**
 * Collapse a flat action list into family parent bubbles. Parents appear at
 * the position of their first member; order inside a family follows the
 * catalog order. Only called when the flat column can't fit the viewport —
 * with room, the renderer shows the actions flat and ignores `family`.
 */
const groupIntoFamilies = (actions: BubbleAction[]): BubbleAction[] => {
  const parents: Partial<Record<NonNullable<BubbleAction['family']>, BubbleAction>> = {};
  const out: BubbleAction[] = [];
  for (const a of actions) {
    if (!a.family) {
      out.push(a);
      continue;
    }
    let parent = parents[a.family];
    if (!parent) {
      const meta = FAMILY_META[a.family];
      parent = {
        key: `family-${a.family}`,
        icon: meta.icon,
        label: meta.label,
        costText: '',
        check: { allowed: true, reason: null },
        run: () => {},
        children: [],
      };
      parents[a.family] = parent;
      out.push(parent);
    }
    parent.children!.push(a);
    // A coached child's finger rides on the parent so the hint survives
    // grouping.
    if (a.coach) parent.coach = true;
  }
  return out;
};

/**
 * How many 86px slots the column gets: half the viewport height. The result
 * already excludes the always-visible Close bubble's slot.
 */
const useMaxSlots = (): number => {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return Math.max(0, Math.floor((height * 0.5) / 86) - 1);
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
  const { setSelectedObject } = useGameActions();
  /** The open family parent: the column shows its children instead. */
  const [openFamilyKey, setOpenFamilyKey] = useState<string | null>(null);
  /** The expanded bubble in the current column (cost/reason or chip stack). */
  const [expanded, setExpanded] = useState<string | null>(null);
  /** The open chip inside a chip stack (a nested level: aim → target). */
  const [expandedGrand, setExpandedGrand] = useState<string | null>(null);
  const maxSlots = useMaxSlots();
  const reduce = useReducedMotion();

  // A new selection starts fresh.
  useEffect(() => {
    setOpenFamilyKey(null);
    setExpanded(null);
    setExpandedGrand(null);
  }, [resetKey]);

  // Flat first: while every action (plus the Close slot, already removed
  // from maxSlots) fits in half the viewport, the column shows the actions
  // one per slot as always. Past that they collapse into family parents.
  // Tiny selections (1–2 actions) never group.
  const display = useMemo(
    () => (
      (window.__FORCE_GROUP__ ? actions.length > 1 : actions.length > 2) &&
      actions.length > (window.__FORCE_GROUP__ ? -1 : maxSlots)
        ? groupIntoFamilies(actions)
        : actions
    ),
    [actions, maxSlots]
  );

  // Grouped drill-down: opening a family hides its siblings and stacks its
  // children as circle bubbles above it; `layout` slides the parent down to
  // the bottom of that stack, just over Close. Tapping it again goes back.
  const openFamily = display.find((a) => !!a.children && a.key === openFamilyKey) ?? null;
  const column = openFamily ? [...(openFamily.children ?? []), openFamily] : display;
  // A chip stack is centered on its owner's slot and spreads leftward. A
  // one-chip stack fits beside the owner; a taller one reaches over the
  // neighbors' slots, so only their captions hide (the bubble icons stay).
  const stackIdx = column.findIndex(
    (a) => a !== openFamily && expanded === a.key && !!a.choices?.some((c) => c.eligible)
  );
  const stackTall =
    stackIdx >= 0 && (column[stackIdx].choices ?? []).filter((c) => c.eligible || c.pinned).length > 1;
  const captionCovered = (i: number) => stackTall && Math.abs(i - stackIdx) === 1;

  // Column item motion: `layout` glides survivors to their new slots; new
  // bubbles pop in. No exit animation — hidden siblings vanish at once (an
  // exit that never completes would leave ghosts).
  const spring = reduce ? { duration: 0.1 } : ({ type: 'spring', stiffness: 480, damping: 34 } as const);
  const itemMotion = {
    layout: true as const,
    initial: reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    transition: spring,
  };

  const collapse = () => {
    setExpanded(null);
    setExpandedGrand(null);
  };

  /** After an action runs: unwind everything; placements drop the selection. */
  const finish = (a: BubbleAction) => {
    collapse();
    setOpenFamilyKey(null);
    if (a.closeOnRun) setSelectedObject(null);
  };

  const onBubbleClick = (a: BubbleAction) => {
    if (a.children) {
      setOpenFamilyKey(openFamilyKey === a.key ? null : a.key);
      collapse();
      return;
    }
    // A toggle (e.g. pick all soldiers): runs at once, family stays open.
    if (a.instant && a.check.allowed) {
      a.run();
      collapse();
      return;
    }
    if (expanded !== a.key) {
      setExpanded(a.key);
      setExpandedGrand(null);
      return;
    }
    // An open chip stack collapses when its bubble is tapped again; a blocked
    // bubble collapses (its reason was shown); a regular bubble confirms.
    if (a.choices || !a.check.allowed) {
      collapse();
      return;
    }
    a.run();
    finish(a);
  };

  /**
   * Chip face: direction arrow, color swatch or icon, then text. A bare
   * move-direction chip stays compact (arrow + "N"); every other chip names
   * itself and puts the cost on a second line, so a target chip says who,
   * not just "free".
   */
  const chipFace = (c: BubbleAction) => (
    <>
      {c.direction ? (
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          className="shrink-0"
          style={{ transform: `rotate(${c.angle ?? 0}deg)` }}
          aria-hidden="true"
        >
          <path d="M12 3 L17 12 L13.5 12 L13.5 21 L10.5 21 L10.5 12 L7 12 Z" fill="currentColor" />
        </svg>
      ) : c.color ? (
        <span
          className="w-6 h-6 shrink-0 rounded-full border-2 border-white shadow-inner"
          style={{ background: c.color }}
          aria-hidden="true"
        />
      ) : c.icon ? (
        <GameIcon name={c.icon} size={22} className="shrink-0" />
      ) : null}
      {c.direction && c.costText === c.direction ? (
        <span>{c.costText}</span>
      ) : (
        <span className="flex flex-col items-start leading-tight">
          <span className="text-[13px]">{c.label}</span>
          {c.costText ? <span className="text-[11px] font-semibold opacity-70">{c.costText}</span> : null}
        </span>
      )}
    </>
  );

  const chipClass =
    'bubble-pop flex w-max shrink-0 items-center gap-2 min-h-10 py-1 pl-2 pr-4 rounded-full bg-canvas-raised border-2 shadow-lg text-[14px] font-bold text-ink whitespace-nowrap cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100';

  /**
   * One tap on a chip. Blocked chips show their reason (pinned toggles) or
   * do nothing; picker chips open their own stack one level further left;
   * everything else runs — a keepsOpen toggle leaves its stack open.
   */
  const onOptionClick = (o: BubbleAction) => {
    if (!o.check.allowed) {
      if (o.pinned) setExpandedGrand(expandedGrand === o.key ? null : o.key);
      return;
    }
    if (o.choices) {
      setExpandedGrand(expandedGrand === o.key ? null : o.key);
      return;
    }
    o.run();
    if (!o.keepsOpen) finish(o);
  };

  /**
   * One chip in a leftward stack (level 2 = a bubble's options, level 3 =
   * a picker option's own picks). `open` decides whether a blocked pinned
   * chip shows its reason and whether a picker is lit.
   */
  const optionChip = (o: BubbleAction, level: 2 | 3, parentLabel: string, index: number) => {
    const open = level === 2 && expandedGrand === o.key;
    return (
      <Button
        key={o.key}
        variant="unstyled"
        onClick={() => onOptionClick(o)}
        aria-expanded={open}
        aria-label={o.check.allowed ? `${parentLabel}: ${o.label}` : `${parentLabel}: ${o.label} unavailable`}
        title={o.label}
        className={`${chipClass} ${
          !o.check.allowed
            ? 'bg-canvas-sunken text-ink-faint'
            : open || o.active
              ? 'border-sky bg-sky-pale'
              : ''
        }`}
        style={{ borderColor: o.color ?? (o.active ? C['sky'] : C['board.fallback']), animationDelay: `${index * 50}ms` }}
      >
        {!o.check.allowed && o.pinned && open ? (
          <span className="max-w-[220px] whitespace-normal text-left text-[12px] font-semibold text-clay">
            {o.check.reason ?? 'Not allowed here'}
          </span>
        ) : (
          chipFace(o)
        )}
      </Button>
    );
  };

  /** A chip column popped leftward off a slot: pill options at `level`
      (2 = direct children layer, 3 = nested target picks). While it is
      open, covered neighbor captions hide (see `captionCovered`) so the stack never
      collides with them. An open picker's own picks form a second grid
      column to its left, starting on the picker's row: they clear the whole
      options column (never tucking under a wider neighbor chip) and read as
      the picker's continuation. */
  const renderChipStack = (
    opts: BubbleAction[],
    level: 2 | 3,
    parentLabel: string,
  ) => {
    const openPicker = level === 2 ? opts.find((o) => expandedGrand === o.key) : undefined;
    const picks = openPicker?.choices?.filter((c) => c.eligible) ?? [];
    const pickerRow = openPicker ? opts.indexOf(openPicker) + 1 : 0;
    return (
      <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 z-30 grid grid-flow-row auto-rows-min items-center justify-items-end gap-x-3 gap-y-2">
        {opts.map((o, j) => (
          <div key={o.key} style={{ gridColumn: 2, gridRow: j + 1 }}>
            {optionChip(o, level, parentLabel, j)}
          </div>
        ))}
        {picks.map((x, k) => (
          <div key={x.key} style={{ gridColumn: 1, gridRow: pickerRow + k }}>
            {optionChip(x, 3, `${parentLabel}: ${openPicker!.label}`, k)}
          </div>
        ))}
      </div>
    );
  };

  /** A lit (open) bubble: open family parent or open chip-stack owner. The
      family parent keeps its caption (it names the open group); a stack
      owner drops it, since its chips sit right over that spot. */
  const litBubble = (a: BubbleAction, ariaLabel: string, caption: boolean) => (
    <div className="relative flex flex-col items-end gap-1 w-14">
      <Button
        variant="unstyled"
        onClick={() => onBubbleClick(a)}
        aria-expanded="true"
        aria-label={ariaLabel}
        title={a.label}
        className="flex items-center justify-center w-14 h-14 rounded-full border-2 border-sky bg-sky text-white ring-4 ring-sky-soft/60 shadow-lg cursor-pointer transition-all duration-200"
      >
        <GameIcon name={a.icon} size={24} />
      </Button>
      {caption && (
        <span
          aria-hidden="true"
          className="absolute top-full mt-1 right-0 px-1.5 py-px rounded bg-sky text-[10px] font-semibold text-white whitespace-nowrap"
        >
          {a.label}
        </span>
      )}
    </div>
  );

  return (
    <div
      // Right edge of the map, vertically centered — where the old resource
      // panel lived. The bottom edge stays free for the hand tray. No
      // overflow clipping here: expanded pills, captions and chip stacks
      // all extend left of the 56px column.
      className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-end gap-3"
      // Don't let clicks here start a board pan or clear the selection.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <AnimatePresence initial={false} key={resetKey}>
        {column.map((a, i) => {
          // Open family parent: a lit circle at the bottom of its children;
          // tapping it returns to the family list.
          if (a === openFamily) {
            return (
              <motion.div key={a.key} {...itemMotion} className="relative h-[86px] flex items-center justify-center">
                {litBubble(a, `Back from ${a.label}`, !captionCovered(i))}
              </motion.div>
            );
          }
          // A choice bubble shows its stack of eligible options when expanded;
          // with none eligible it behaves as a normal greyed bubble (reason).
          const hasChoices = !!a.choices && a.choices.some((c) => c.eligible);
          const isPill = hasChoices && expanded === a.key;
          // Every item lives in a fixed-height slot: the collapsed bubble +
          // its caption is ~86px tall, and the expanded pill is centered inside
          // the same slot — siblings never shift when a bubble opens.
          if (!isPill) {
            return (
              <motion.div key={a.key} {...itemMotion} className="relative h-[86px] flex items-center justify-center">
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
                <ActionBubble action={a} open={expanded === a.key} hideCaption={captionCovered(i)} onClick={() => onBubbleClick(a)} />
              </motion.div>
            );
          }
          // Expanded choice bubble: the bubble stays put (lit) and its options
          // pop leftward as a stack of chips.
          const options = a.choices?.filter((c) => c.eligible || c.pinned) ?? [];
          return (
            <motion.div key={a.key} {...itemMotion} role="group" aria-label={a.label} className="relative h-[86px] flex items-center justify-center">
              {renderChipStack(options, 2, a.label)}
              {litBubble(a, `Close ${a.label}`, false)}
            </motion.div>
          );
        })}
      </AnimatePresence>
      {/* Close ✕ sits at the bottom of the column. */}
      <motion.div layout transition={spring} className="h-[86px] flex flex-col items-center justify-center gap-1">
        <Button
          variant="unstyled"
          onClick={() => setSelectedObject(null)}
          aria-label="Close and zoom back out"
          title="Close"
          className="w-14 h-14 rounded-full border-2 border-ink-faint/50 bg-canvas-raised shadow-lg text-2xl leading-none text-ink-soft transition-all duration-200 hover:scale-110 active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100 hover:border-ink-soft"
        >
          <GameIcon name="x" size={24} />
        </Button>
        <span aria-hidden="true" className="px-1.5 py-px rounded bg-black/60 text-[10px] font-semibold text-white">
          Close
        </span>
      </motion.div>
    </div>
  );
};

export default ActionBubbles;
