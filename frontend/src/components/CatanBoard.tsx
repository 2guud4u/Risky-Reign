import React, { useState } from 'react';
import Hexagon from './Hexagon';
import Settlement from './Settlement';
import Intersection from './Intersection';
import { HexProps, terrainColors,generateHexes } from '../utils/hexUtils';
import {calculateHexagonVertices, generateIntersections} from '../utils/intersectUtils';
import { PixelCoord, calcEuclideanDistance } from '../utils/helperUtils';
import {generateGameBoard} from '../utils/gameUtils';
import { SettlementObj } from '../utils/settlementUtils';
import { Player } from './Player';
import { PlayerObj } from '../utils/playerUtils';
const hexSize = 100;
const boardRadius = 2;
const intersectSize = hexSize / 4;





const CatanBoard: React.FC = () => {
  const [{hexMap, intersectMap}] = useState(generateGameBoard(boardRadius, hexSize));
  const [settlements, setSettlements] = useState<SettlementObj[]>([]);
  const [players, setPlayers] = useState<PlayerObj[]>(
    [{id: 0, name: "hi", color: "red", resources: new Map(
      [["Wood", 0], ["Brick", 0], ["Sheep", 0], ["Wheat", 0], ["Ore", 0]]
    
      
    )}]
    );
  const svgSize = 1.1 * hexSize * (boardRadius * 2 + 1) * Math.sqrt(3);

  const handleIntersectDrop = (intersectId:number, action: string) => {
    const intersect = intersectMap.get(intersectId);
    if(intersect === undefined){
      return;
    }
    switch (action) {
      case 'buildSettlement':
        setSettlements([...settlements, {coord: intersect.coord, id: settlements.length, owner: "hi", upgraded: false}]);
        break;
      default:
        break;
    }
  };
  

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4">
        <div
          className="w-10 h-10 bg-red-500 cursor-move"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('action', 'buildSettlement')}
          role="img"
          aria-label="Draggable settlement piece"
        >drag me</div>
      </div>
      <svg width={svgSize} height={svgSize} viewBox={`${-svgSize/2} ${-svgSize/2} ${svgSize} ${svgSize}`}>
        
        {Array.from(hexMap.values()).map((hex, index) => (
          <Hexagon key={index} {...hex} size={hexSize}  />
        ))}
        {settlements.map((settlement, index) => {

          return <Settlement {...settlement}size={hexSize}/>;
        })}
        {Array.from(intersectMap.values()).map((intersect, index) => (
          <Intersection  {...intersect} size={intersectSize} onDrop={handleIntersectDrop}/>
        ))}
        
      </svg>
      <div className="mt-4 grid grid-cols-3 gap-2">
      {players.map((player, index) => (
          <Player key={index} {...player} />
        ))}
      </div>
    </div>
  );
};

export default CatanBoard;

