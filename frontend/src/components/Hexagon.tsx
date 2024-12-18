import React from 'react';
import { HexProps, terrainColors } from '../utils/hexUtils';
import { cubeToPixel } from '../utils/helperUtils';

interface HexagonProps extends HexProps {
  size: number;
  rollNumber: number | null;
  onDrop: (q: number, r: number, s: number) => void;
}

const Hexagon: React.FC<HexagonProps> = ({ q, r, s, terrain, size, onDrop, rollNumber }) => {
  const { x, y } = cubeToPixel({ q, r, s }, size);



    const hexPoints = [
      [0, -1], [Math.sqrt(3)/2, -0.5], [Math.sqrt(3)/2, 0.5],
      [0, 1], [-Math.sqrt(3)/2, 0.5], [-Math.sqrt(3)/2, -0.5]
    ]
      .map(([px, py]) => [px * size + x, py * size + y])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(q, r, s);
  };

  return (
    <g>
      <polygon
        points={hexPoints.map(([px, py]) => `${px},${py}`).join(' ')}
        fill={terrainColors[terrain]}
        stroke="#000"
        strokeWidth="2"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />

      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#000"
        fontSize={size / 3}
      >
        {terrain}
        {rollNumber}
      </text>
      <circle  cx={x} cy={y} r={size} fill="blue" fillOpacity="0.3" />
    </g>
    
  );
};

export default Hexagon;

