import React, { useEffect, useState } from 'react';
import { useGameState } from '../contexts/GameContext';
import { useSetupCoach } from '../hooks/useSetupCoach';
import { setTutorialHints, useTutorialHints } from '../utils/tutorial';
import { affordableSummary } from '../utils/affordable';
import GameIcon from '../components/ui/GameIcon';
import Button from '../components/ui/Button';

/** Milliseconds of no input on your turn before "Need help?" slides in. */
const IDLE_HELP_MS = 30_000;

/** One-line "what to do now" for each phase (the idle help card). */
const PHASE_TIPS: Record<string, { title: string; body: string }> = {
  Dice: {
    title: 'Roll the dice',
    body: 'Click the big dice in the middle of the screen, one at a time. Every hex with the rolled number pays its resource to the settlements around it.',
  },
  Build: {
    title: 'Build phase',
    body: 'Click a vertex or an edge on the map to see what you can build there. The Trade button swaps cards with players or the bank; the info button lists every cost. Press End Turn (top) when you are done.',
  },
  Action: {
    title: 'Action phase',
    body: 'Click a vertex with your soldiers to move, heal, attack or capture with them. Recruit new soldiers on your settlements. Press End Turn (top) when you are done.',
  },
};

/**
 * Left-edge coach card. During your setup turn it walks you through each
 * placement (the board shows a bobbing 👇 at a suggested spot; once the build
 * bubble opens the card points at it instead). On later turns, if you do
 * nothing for IDLE_HELP_MS it slides in asking "Need help?" with a tip for the
 * current phase. "Hide tips" turns every hint off (remembered).
 */
const TutorialCoach: React.FC = () => {
  const { gameRoom, currentPlayer } = useGameState();
  const hintsOn = useTutorialHints();
  const coach = useSetupCoach(gameRoom?.board ?? null);
  const turn = gameRoom?.turnState;
  const myTurn = !!turn && turn.player === currentPlayer?.name && gameRoom?.gameStatus === 'playing';
  const phase = turn?.phase;

  // Idle detection: reset on any input or turn change; fire after IDLE_HELP_MS.
  const [idle, setIdle] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const idleWatch = hintsOn && myTurn && phase !== 'SetUp';
  useEffect(() => {
    setIdle(false);
    setDismissed(false);
    if (!idleWatch) return;
    let timer = setTimeout(() => setIdle(true), IDLE_HELP_MS);
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), IDLE_HELP_MS);
    };
    const events = ['mousedown', 'keydown', 'wheel', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, onInput, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const e of events) window.removeEventListener(e, onInput);
    };
  }, [idleWatch, phase, turn?.offset, turn?.player]);

  const [showTip, setShowTip] = useState(false);
  useEffect(() => setShowTip(false), [phase, turn?.player]);

  const tip = phase ? PHASE_TIPS[phase] : undefined;
  const helpCard = idleWatch && idle && !dismissed && tip;
  if (!coach && !helpCard) return null;

  return (
    <div
      role="dialog"
      aria-label="Tutorial"
      onMouseDown={(e) => e.stopPropagation()}
      // left-16 clears the top-left button column; right-16 keeps the card off
      // the right-edge resource strip on narrow screens; max-w keeps it tidy
      // on desktop. w-auto lets it shrink between the two edges on mobile.
      className="slide-in-left absolute left-16 right-16 top-4 z-30 w-auto max-w-[260px] rounded-xl border-2 border-sky bg-canvas-raised shadow-pop p-3 flex flex-col gap-2"
    >
      {coach ? (
        <>
          <div className="text-[11px] font-bold uppercase tracking-wide text-sky">Quick tutorial</div>
          <div className="text-[15px] font-bold text-ink">
            <GameIcon name={coach.key === 'settlement' ? 'settlement' : 'road'} size={15} className="inline -mt-0.5" /> {coach.title}
          </div>
          <p className="m-0 text-[13px] text-ink-soft">
            {coach.bubbleOpen
              ? `Now click the ${coach.key === 'settlement' ? 'home' : 'hammer'} button at the bottom, then click it again to confirm.`
              : coach.body}
          </p>
        </>
      ) : showTip && tip ? (
        <>
          <div className="text-[15px] font-bold text-ink"><GameIcon name="bulb" size={15} className="inline -mt-0.5" /> {tip.title}</div>
          <p className="m-0 text-[13px] text-ink-soft">{tip.body}</p>
          {gameRoom?.board && currentPlayer && phase && (() => {
            const lines = affordableSummary(gameRoom.board, currentPlayer, phase);
            return lines.length > 0 ? (
              <div className="flex flex-col gap-1 border-t border-ink-faint/40 pt-2">
                <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">With your cards</div>
                <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
                  {lines.map((l) => (
                    <li key={l.key} className="text-[13px] text-ink">
                      <GameIcon name={l.icon} size={14} className="inline -mt-0.5" /> {l.text}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null;
          })()}
          <Button
            size="sm"
            onClick={() => setDismissed(true)}
            className="self-start !bg-sky !text-white hover:!bg-sky-soft"
          >
            Got it
          </Button>
        </>
      ) : (
        <>
          <div className="text-[15px] font-bold text-ink"><GameIcon name="question" size={15} className="inline -mt-0.5" /> Need help?</div>
          <p className="m-0 text-[13px] text-ink-soft">Not sure what to do this turn?</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setShowTip(true)}
              className="flex-1 !bg-sky !text-white hover:!bg-sky-soft"
            >
              Show me
            </Button>
            <Button
              size="sm"
              onClick={() => setDismissed(true)}
              className="flex-1"
            >
              I'm fine
            </Button>
          </div>
        </>
      )}
      <Button
        variant="unstyled"
        onClick={() => setTutorialHints(false)}
        className="self-end text-[11px] text-ink-faint hover:text-ink-soft"
      >
        Hide tips
      </Button>
    </div>
  );
};

export default TutorialCoach;
