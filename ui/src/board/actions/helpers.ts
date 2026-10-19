import type { BuildCheck } from 'common';
import { BubbleAction } from '../../components/board/ActionBubbles';
import { ALLOWED } from './types';

/**
 * The "first eligible wins" result used across the catalog: the first
 * candidate whose check allows it, plus the check to report on the bubble —
 * that candidate's when one exists, otherwise the first candidate's reason
 * (or `fallback` when there are no candidates at all).
 */
export function firstAllowed<T>(
  candidates: T[],
  runCheck: (candidate: T) => BuildCheck,
  fallback: BuildCheck = { allowed: false, reason: 'Nothing can do that' }
): { candidate: T | null; check: BuildCheck } {
  const checks = candidates.map((candidate) => ({ candidate, check: runCheck(candidate) }));
  const ok = checks.find((c) => c.check.allowed);
  return {
    candidate: ok?.candidate ?? null,
    check: ok?.check ?? checks[0]?.check ?? fallback,
  };
}

/**
 * The choice-pill descriptor shape repeated across the catalog: a parent
 * bubble that expands into `choices` instead of confirming, enabled when at
 * least one choice is eligible, otherwise greyed with the first choice's
 * reason (or `fallback` when the pill is empty). `run` is a no-op — an
 * expanded bubble is a menu, not a button.
 */
export function choiceGroup(
  base: Omit<BubbleAction, 'check' | 'run' | 'choices'>,
  choices: BubbleAction[],
  fallback: BuildCheck
): BubbleAction {
  const anyEligible = choices.some((c) => c.eligible);
  return {
    ...base,
    check: anyEligible ? ALLOWED : choices[0]?.check ?? fallback,
    run: () => {},
    choices,
  };
}
