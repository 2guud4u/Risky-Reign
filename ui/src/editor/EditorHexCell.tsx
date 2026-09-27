import React from 'react';
import { cubeToPixel, terrainColors } from 'common';
import { hexPointsAt } from '../utils/hex';
import { EditorHexCellProps } from './types';
import {
  CELL_STROKE,
  DESERT_LABEL_FONT_SIZE,
  DRAG_SOURCE_OPACITY,
  EDITOR_COLORS,
  EMPTY_CELL_DASH,
  HEX_SCALE,
  HEX_SIZE,
  TOKEN_CIRCLE_RADIUS,
  TOKEN_FONT_SIZE,
  TOKEN_STROKE_WIDTH,
} from './constants';

/**
 * A single cell of the editor grid: a dashed outline when empty, or the placed
 * hex (terrain fill, optional roll-number token, "Desert" label). Right-click
 * and double-click delete a placed hex; the caller handles click/drag.
 */
const EditorHexCell: React.FC<EditorHexCellProps> = ({
  cellKey,
  coord,
  placed,
  isSelected,
  isHover,
  isDragSource,
  dragKind,
  onRemove,
}) => {
  const { x, y } = cubeToPixel(coord, HEX_SIZE);
  return (
    <g
      style={{ cursor: placed ? 'grab' : 'pointer' }}
      onDoubleClick={placed ? () => onRemove(cellKey) : undefined}
      onContextMenu={
        placed
          ? (e) => {
              e.preventDefault();
              onRemove(cellKey);
            }
          : undefined
      }
    >
      <polygon
        points={hexPointsAt(x, y, HEX_SIZE * HEX_SCALE)}
        fill={placed ? terrainColors[placed.terrain] ?? EDITOR_COLORS.hexFallbackFill : 'transparent'}
        stroke={
          isHover
            ? EDITOR_COLORS.hoverStroke
            : isSelected
            ? EDITOR_COLORS.selectedStroke
            : placed
            ? EDITOR_COLORS.placedStroke
            : EDITOR_COLORS.emptyCellStroke
        }
        strokeWidth={isHover || isSelected ? CELL_STROKE.active : placed ? CELL_STROKE.placed : CELL_STROKE.empty}
        strokeDasharray={placed ? undefined : EMPTY_CELL_DASH}
        opacity={dragKind === 'hex' && isDragSource ? DRAG_SOURCE_OPACITY : 1}
      />
      {placed && placed.rollNumber !== null && (
        <circle
          cx={x}
          cy={y}
          r={TOKEN_CIRCLE_RADIUS}
          fill={EDITOR_COLORS.tokenFill}
          stroke={EDITOR_COLORS.tokenStroke}
          strokeWidth={TOKEN_STROKE_WIDTH}
          opacity={dragKind === 'number' && isDragSource ? DRAG_SOURCE_OPACITY : 1}
        />
      )}
      {placed && placed.rollNumber !== null && (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={TOKEN_FONT_SIZE}
          fontWeight="bold"
          fill={EDITOR_COLORS.tokenStroke}
          opacity={dragKind === 'number' && isDragSource ? DRAG_SOURCE_OPACITY : 1}
        >
          {placed.rollNumber}
        </text>
      )}
      {placed && placed.terrain === 'Desert' && (
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={DESERT_LABEL_FONT_SIZE}
          fill={EDITOR_COLORS.desertLabel}
        >
          Desert
        </text>
      )}
    </g>
  );
};

export default EditorHexCell;
