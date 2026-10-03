import React from 'react';
import { Board, VertexNode } from 'common';
import { useVertexBuild, VertexBuildAction } from '../../hooks/useVertexBuild';
import { useSoldierActions, SoldierAction } from '../../hooks/useSoldierActions';
import { priceLabel } from '../../utils/price';
import ActionBubbles, { BubbleAction } from './ActionBubbles';

/** Emoji shown in each collapsed build bubble. */
const ICONS: Record<VertexBuildAction['key'], string> = {
  settlement: '🏠',
  city: '⬆️',
  soldier: '🧍',
};

/** Emoji shown in each collapsed soldier-action bubble. */
const SOLDIER_ICONS: Record<SoldierAction['kind'], string> = {
  heal: '❤️‍🩹',
  attack: '⚔️',
  capture: '🏴',
  robber: '🥷',
};

/**
 * Bubbles for the selected vertex: build settlement / upgrade to city /
 * recruit soldier, then the group actions (heal / attack / capture / fight
 * robber) for the soldiers picked by tapping them on the map.
 */
const VertexActionBubbles: React.FC<{ board: Board; vertex: VertexNode }> = ({ board, vertex }) => {
  const build = useVertexBuild(board, vertex);
  const soldier = useSoldierActions(board, vertex);
  const actions: BubbleAction[] = [
    ...build.map((a) => ({
      key: a.key,
      icon: ICONS[a.key],
      label: a.label,
      costText: priceLabel(a.price),
      check: a.check,
      run: a.run,
    })),
    ...soldier.map((a) => ({
      key: a.key,
      icon: SOLDIER_ICONS[a.kind],
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
            })),
          }
        : {}),
    })),
  ];
  return <ActionBubbles actions={actions} resetKey={vertex.id} />;
};

export default VertexActionBubbles;
