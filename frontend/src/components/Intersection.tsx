import React from "react";
import { IntersectNode } from "../utils/intersectUtils";
import { SoldierType, SoldierObj } from "../utils/soldierUtils";
import {groupBy} from '../utils/helperUtils';
export interface IntersectionProps extends IntersectNode {
  soldierGroups: Record<string, SoldierObj[]>;
  colorSoldierGroups: colorSoldierGroups[];
  size: number;
  onDrop: (target: string, targetId: number, action: string) => void;
  onClick: (target: string, targetId: number) => void;
}
interface colorSoldierGroups {
  color: string;
  soldiers: SoldierObj[];
}
interface SoldierDisp {
  number: number;
  coord: { x: number; y: number };
  size: number;
  type: SoldierType;
  color: string;
}
const Intersection: React.FC<IntersectionProps> = ({ id ,coord, size, onDrop, onClick, soldierGroups, colorSoldierGroups}) => {
  const { x, y } = coord;
  const [soldierComps, setSoldierComps] = React.useState<SoldierDisp[]>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    let action = e.dataTransfer.getData("action");
    onDrop("intersection", id, action);
  };
  const handleClick = (e: React.MouseEvent) => {
    // onClick(id);
    onClick("intersection", id);

  }
  // create soldier circles
  React.useEffect(() => {

    const groupedSoldiersList = Object.values(colorSoldierGroups)
    const orbitRadius = size; // Radius of the circle on which the other circles will surround
    const numGroups = groupedSoldiersList.length; // Number of intersection points to surround the center
    const multiEnemySize = size/3;
    const enemySize = size/2;

    if (groupedSoldiersList.length === 1) {
      setSoldierComps([
        {
          number: groupedSoldiersList[0].soldiers.length,
          coord: { x, y },
          size: enemySize,
          type: groupedSoldiersList[0].soldiers[0].type,
          color: groupedSoldiersList[0].color,
        },
      ]);
      return;
    }

    const soldierComps = groupedSoldiersList.map(( group, index) => {
      const angle = (index * (2 * Math.PI)) / numGroups; // Evenly spaced angles
      const x =  coord.x + orbitRadius * Math.cos(angle);
      const y = -10 + coord.y + orbitRadius * Math.sin(angle);

      return {
        number: group.soldiers.length,
        coord: { x, y },
        size: multiEnemySize, // You can adjust the size
        type: group.soldiers[0].type,
        color: group.color,
      };
    });
    setSoldierComps(soldierComps);
  }, [soldierGroups, coord, size]);

return (
  
  <g >
        
        <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#000"
        fontSize={size / 3}
      >
        {id}
      </text>
      <circle         onDragOver={handleDragOver}
        onDrop={handleDrop} cx={x} cy={y} r={size} fill="red" fillOpacity="0.3" onClick={handleClick}/>
        
        {soldierComps.map((soldier, index) => (
          <g >
            <circle
              key={index}
              cx={soldier.coord.x}
              cy={soldier.coord.y}
              r={soldier.size}
              fill={soldier.color}
              
            />
            <text
              x={soldier.coord.x}
              y={soldier.coord.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={size / 3}
            >
              {soldier.number}
            </text>
          </g>
        ))}
    </g>
    
  
    
);
}

export default Intersection;