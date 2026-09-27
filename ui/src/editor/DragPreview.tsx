import React from 'react';
import { CubeCoord, terrainColors, cubeToPixel } from 'common';
import { hexPointsAt } from '../utils/hex';
import { DragPreviewProps } from './types';
import {
  EDITOR_COLORS,
  HEX_SCALE,
  HEX_SIZE,
  PREVIEW_DASH,
  PREVIEW_FILL_OPACITY,
  PREVIEW_OPACITY,
  PREVIEW_STROKE_WIDTH,
  PREVIEW_TOKEN_STROKE_WIDTH,
  TOKEN_CIRCLE_RADIUS,
  TOKEN_FONT_SIZE,
} from './constants';
import { canCarryNumber } from './utils';

/**
 * Drag preview: a ghost at the hovered cell showing the drop target.
 * Works for both in-canvas drags and toolbar drags. Green outline when the
 * drop is valid, red when it isn't; toolbar terrain drags preview their fill.
 */
const DragPreview: React.FC<DragPreviewProps> = ({
  hoverKey,
  activeDragKind,
  previewNumber,
  isToolbarTerrain,
  toolbarTerrain,
  map,
}) => {
  const hv = hoverKey.split(',').map(Number);
  const cube: CubeCoord = { q: hv[0], r: hv[1], s: hv[2] };
  const { x, y } = cubeToPixel(cube, HEX_SIZE);
  const occupied = !!map[hoverKey];
  const isNumber = activeDragKind === 'number';
  const valid = isNumber ? occupied && canCarryNumber(map[hoverKey]!.terrain) : !occupied;

  if (isNumber) {
    return (
      <g opacity={PREVIEW_OPACITY}>
        <circle
          cx={x}
          cy={y}
          r={TOKEN_CIRCLE_RADIUS}
          fill={EDITOR_COLORS.tokenFill}
          stroke={valid ? EDITOR_COLORS.hoverStroke : EDITOR_COLORS.invalidStroke}
          strokeWidth={PREVIEW_TOKEN_STROKE_WIDTH}
        />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={TOKEN_FONT_SIZE}
          fontWeight="bold"
          fill={EDITOR_COLORS.tokenStroke}
        >
          {previewNumber}
        </text>
      </g>
    );
  }

  return (
    <polygon
      points={hexPointsAt(x, y, HEX_SIZE * HEX_SCALE)}
      fill={isToolbarTerrain && toolbarTerrain ? terrainColors[toolbarTerrain] ?? EDITOR_COLORS.hexFallbackFill : 'none'}
      fillOpacity={isToolbarTerrain ? PREVIEW_FILL_OPACITY : 0}
      stroke={valid ? EDITOR_COLORS.hoverStroke : EDITOR_COLORS.invalidStroke}
      strokeWidth={PREVIEW_STROKE_WIDTH}
      strokeDasharray={PREVIEW_DASH}
    />
  );
};

export default DragPreview;
