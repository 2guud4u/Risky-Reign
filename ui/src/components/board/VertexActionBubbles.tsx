import React from 'react';
import { Board, VertexNode } from 'common';
import { useGameRoom } from '../../contexts/GameContext';
import { useVertexBuild, VertexBuildAction, useVertexSoldierSelectAll } from '../../hooks/useVertexBuild';
import { useSoldierActions, SoldierAction } from '../../hooks/useSoldierActions';
import { useSetupCoach } from '../../hooks/useSetupCoach';
import { priceLabel } from '../../utils/price';
import ActionBubbles, { BubbleAction } from './ActionBubbles';

/** Emoji shown in each collapsed build bubble. Knight spawn uses a shield
 *  ("reinforce") so it never reads as the ⚔️ attack bubble. */
const ICONS: Record<VertexBuildAction['key'], string> = {
  settlement: '🏠',
  city: '🏰',
  soldier: '🫵',
  knight: '🛡️',
};

/** Emoji shown in each collapsed soldier-action bubble. */
const SOLDIER_ICONS: Record<SoldierAction['kind'], string> = {
  move: '🏃‍➡️',
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
  const { gameRoom } = useGameRoom();
  const build = useVertexBuild(board, vertex);
  const soldier = useSoldierActions(board, vertex);
  const selectAll = useVertexSoldierSelectAll(board, vertex);
  const coach = useSetupCoach(board);
  const setup = gameRoom?.turnState.phase === 'SetUp';
  const actions: BubbleAction[] = [
    ...build.map((a) => ({
      key: a.key,
      icon: ICONS[a.key],
      label: a.label,
      costText: a.key === 'knight' ? 'Knight card' : setup ? 'Free' : priceLabel(a.price),
      check: a.check,
      run: a.run,
      coach: coach?.key === 'settlement' && a.key === 'settlement' && a.check.allowed,
      // Settling, upgrading or spawning changes the corner (or ends the card);
      // recruiting keeps the corner selected so you can recruit again or act.
      closeOnRun: a.key === 'settlement' || a.key === 'city' || a.key === 'knight',
    })),
    ...(selectAll ? [selectAll] : []),
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
              direction: c.direction,
              angle: c.angle,
              color: c.color,
            })),
          }
        : {}),
      ...(a.column ? { column: a.column } : {}),
    })),
  ];
  return <ActionBubbles actions={actions} resetKey={vertex.id} />;
};

export default VertexActionBubbles;
