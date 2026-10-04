import React from 'react';
import { Board, EdgeNode } from 'common';
import { useEdgeBuild } from '../../hooks/useEdgeBuild';
import { useSetupCoach } from '../../hooks/useSetupCoach';
import ActionBubbles from './ActionBubbles';

/** Build Road for the selected edge, as a 🔨 bubble on the map. */
const EdgeActionBubbles: React.FC<{ board: Board; edge: EdgeNode }> = ({ board, edge }) => {
  const road = useEdgeBuild(board, edge);
  const coach = useSetupCoach(board);
  return (
    <ActionBubbles
      actions={[
        {
          key: 'road',
          icon: '🔨',
          label: road.label,
          costText: road.costText,
          check: road.check,
          run: road.run,
          coach: coach?.key === 'road' && road.check.allowed,
          closeOnRun: true,
        },
      ]}
      resetKey={edge.id}
    />
  );
};

export default EdgeActionBubbles;
