import React, { useState } from 'react';
import Hexagon from './Hexagon';
import Settlement from './Settlement';
import Intersection from './Intersection';
import { HexProps, terrainColors, cubeToPixel, pixelCoord } from '../utils/hexUtils';
import {IntersectionProps,calculateHexagonVertices} from '../utils/intersectUtils';

const hexSize = 100;
const boardRadius = 2;
const intersectSize = hexSize / 4;

const generateBoard = (): HexProps[] => {
  const board: HexProps[] = [];

  const terrainTypes = Object.keys(terrainColors);

  for (let q = -boardRadius; q <= boardRadius; q++) {
    for (let r = Math.max(-boardRadius, -q - boardRadius); r <= Math.min(boardRadius, -q + boardRadius); r++) {
      const s = -q - r;
      const terrain = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
      board.push({ q, r, s, terrain });
    }
  }

  return board;
};

const generateIntersections = (board: HexProps[], size: number): pixelCoord[] => {
  const intersections: pixelCoord[] = [];

  board.forEach(({ q, r, s }) => {
    const hexagonVertices = calculateHexagonVertices(q, r, s, size);
    intersections.push(
      ...hexagonVertices
    );
  });

  return intersections;
};

const CatanBoard: React.FC = () => {
  const [board] = useState(generateBoard);
  const [intersections] = useState(generateIntersections(board, hexSize));
  const [settlements, setSettlements] = useState<{ x:number, y:number }[]>([]);
  const svgSize = hexSize * (boardRadius * 2 + 1) * Math.sqrt(3);

  const handleDrop = (x: number, y:number) => {
    setSettlements([...settlements, { x, y }]);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4">
        <div
          className="w-10 h-10 bg-red-500 cursor-move"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', 'settlement')}
          role="img"
          aria-label="Draggable settlement piece"
        >drag me</div>
      </div>
      <svg width={svgSize} height={svgSize} viewBox={`${-svgSize/2} ${-svgSize/2} ${svgSize} ${svgSize}`}>
        {board.map((hex, index) => (
          <Hexagon key={index} {...hex} size={hexSize} onDrop={handleDrop} />
        ))}
        {settlements.map((settlement, index) => {
          const { x, y } = settlement;
          return <Settlement key={index} x={x} y={y} />;
        })}
        {intersections.map((intersection, index) => (
          <Intersection {...intersection} size={intersectSize} onDrop={handleDrop}/>
        ))}
      </svg>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {Object.entries(terrainColors).map(([terrain, color]) => (
          <div key={terrain} className="flex items-center">
            <div className="w-4 h-4 mr-2" style={{ backgroundColor: color }}></div>
            <span className="capitalize">{terrain}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CatanBoard;

