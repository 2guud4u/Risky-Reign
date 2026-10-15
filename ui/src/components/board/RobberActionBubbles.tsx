import React from 'react';
import { Board } from 'common';
import { useRobberActions } from '../../hooks/useRobberActions';
import ActionBubbles, { BubbleAction } from './ActionBubbles';

/** Emoji shown in each collapsed robber bubble. */
const ROBBER_ICONS: Record<string, string> = {
  attack: '⚔️',
  move: '🥷',
};

/**
 * Bubbles for the robber (click it on the map): Attack — pick a soldier next
 * to it for the 1v1 fight — and Move — zoom out to the highlighted target
 * hexes while a move is pending, or spend a Knight card to start one.
 */
const RobberActionBubbles: React.FC<{ board: Board; hexId: string }> = ({ board, hexId }) => {
  const actions = useRobberActions(board, hexId);
  const bubbles: BubbleAction[] = actions.map((a) => ({
    key: a.key,
    icon: ROBBER_ICONS[a.key] ?? '❓',
    label: a.label,
    costText: a.costText,
    check: a.check,
    run: a.run,
    ...(a.choices
      ? {
          choices: a.choices.map((c) => ({
            key: c.key,
            icon: c.icon,
            label: c.label,
            costText: c.costText,
            check: c.check,
            run: c.run,
            eligible: c.eligible,
            direction: c.direction,
            angle: c.angle,
          })),
        }
      : {}),
  }));
  return <ActionBubbles actions={bubbles} resetKey={`robber-${hexId}`} />;
};

export default RobberActionBubbles;
