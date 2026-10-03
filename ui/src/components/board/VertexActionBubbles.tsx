import React from 'react';
import { Board, VertexNode } from 'common';
import { useVertexBuild, VertexBuildAction } from '../../hooks/useVertexBuild';
import { priceLabel } from '../../utils/price';
import ActionBubbles from './ActionBubbles';

/** Emoji shown in each collapsed bubble. */
const ICONS: Record<VertexBuildAction['key'], string> = {
  settlement: '🏠',
  city: '⬆️',
  soldier: '🧍',
};

/** Build settlement / upgrade to city / recruit soldier for the selected vertex. */
const VertexActionBubbles: React.FC<{ board: Board; vertex: VertexNode }> = ({ board, vertex }) => {
  const actions = useVertexBuild(board, vertex).map((a) => ({
    key: a.key,
    icon: ICONS[a.key],
    label: a.label,
    costText: priceLabel(a.price),
    check: a.check,
    run: a.run,
  }));
  return <ActionBubbles actions={actions} resetKey={vertex.id} />;
};

export default VertexActionBubbles;
