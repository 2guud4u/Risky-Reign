import React, { useState } from 'react';
import Hexagon from './Hexagon';
import Settlement from './Settlement';
import Intersection from './Intersection';
import { HexProps, terrainColors,generateBoard } from '../utils/hexUtils';
import {calculateHexagonVertices} from '../utils/intersectUtils';
import { PixelCoord } from '../utils/helperUtils';

const hexSize = 100;
const boardRadius = 2;
const intersectSize = hexSize / 4;



const generateIntersections = (board: HexProps[], size: number): PixelCoord[] => {
  const intersections: PixelCoord[] = [];

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
          onDragStart={(e) => e.dataTransfer.setData('type', 'settlement')}
          role="img"
          aria-label="Draggable settlement piece"
        >drag me</div>
      </div>
      <svg width={svgSize} height={svgSize} viewBox={`${-svgSize/2} ${-svgSize/2} ${svgSize} ${svgSize}`}>
        {board.map((hex, index) => (
          <Hexagon key={index} {...hex} size={hexSize} onDrop={handleDrop} />
        ))}
        {/* {settlements.map((settlement, index) => {
          const { x, y } = settlement;
          return <Settlement key={index} x={x} y={y} />;
        })} */}
        {intersections.map((intersection, index) => (
          <Intersection key={index} {...intersection} size={intersectSize}/>
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

