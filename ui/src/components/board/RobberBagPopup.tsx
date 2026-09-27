import React from 'react';
import { BoardHex } from 'common';
import RobberBagView from '../../containers/SideBar/RobberBagView';
import {
  PROJ_SIZE,
  ROBBER_BAG_HEIGHT,
  ROBBER_BAG_WIDTH,
  ROBBER_BAG_X_OFFSET,
  ROBBER_BAG_Y_OFFSET,
  ROBBER_Y_OFFSET_FRACTION,
} from '../../constants';

/**
 * The robber's bag: dialog popup over the hovered robber (rendered on the top
 * layer so it isn't covered by the hexes).
 */
export const RobberBagPopup: React.FC<{ hex: BoardHex | null }> = ({ hex }) => {
  if (!hex) return null;
  const { x, y } = hex.position;
  return (
    <foreignObject
      x={x + ROBBER_BAG_X_OFFSET}
      y={y - PROJ_SIZE * ROBBER_Y_OFFSET_FRACTION - ROBBER_BAG_Y_OFFSET}
      width={ROBBER_BAG_WIDTH}
      height={ROBBER_BAG_HEIGHT}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      <RobberBagView />
    </foreignObject>
  );
};
