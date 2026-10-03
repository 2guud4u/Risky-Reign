import React, { useState } from 'react';
import { Board, VertexNode } from 'common';
import { priceLabel } from '../../utils/price';
import { useVertexBuild } from '../../hooks/useVertexBuild';
import { ActionButton, ReasonNotice } from './ActionButton';

/**
 * The vertex's build buttons in the sidebar — always shown, greyed out when
 * unavailable; clicking a greyed button surfaces the reason. Uses the same
 * `useVertexBuild` actions as the on-map bubbles, so both always agree.
 */
const VertexBuildActions: React.FC<{ board: Board; vertex: VertexNode }> = ({ board, vertex }) => {
  const actions = useVertexBuild(board, vertex);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1.5">
      {actions.map((a) => (
        <ActionButton
          key={a.key}
          label={
            <>
              {a.key === 'soldier' ? '⚔ ' : ''}
              {a.label} <span className="text-xs opacity-80">({priceLabel(a.price)})</span>
            </>
          }
          check={a.check}
          onDo={a.run}
          onBlocked={setNotice}
        />
      ))}
      {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
};

export default VertexBuildActions;
