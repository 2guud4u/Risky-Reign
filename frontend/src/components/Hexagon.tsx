import React from 'react';
import { HexProps, cubeToPixel, terrainColors } from '../utils/hexUtils';
import Intersection from './Intersection';

interface HexagonProps extends HexProps {
  size: number;
  onDrop: (q: number, r: number, s: number) => void;
}

const Hexagon: React.FC<HexagonProps> = ({ q, r, s, terrain, size, onDrop }) => {
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
      </text>
      {/* {hexPoints.map(([px, py], index) => (
        <Intersection index={index} x={px} y={py} size={size} onDrop={onDrop}/>
      ))} */}
    </g>
    
  );
};

export default Hexagon;

