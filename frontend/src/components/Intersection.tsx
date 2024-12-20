import React from "react";
import { IntersectNode } from "../utils/intersectUtils";
export interface IntersectionProps extends IntersectNode {

  size: number;
  onDrop: (target: string, targetId: number, action: string) => void;
  onClick: (target: string, targetId: number) => void;
}

const Intersection: React.FC<IntersectionProps> = ({ id ,coord, size, onDrop, onClick}) => {
  const { x, y } = coord;
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
  // const orbitRadius = size; // Radius of the circle on which the other circles will surround
  // const numIntersections = 6; // Number of intersection points to surround the center
  // const enemySize = size/3;

  // const soldiers = Array.from({ length: numIntersections }).map((_, index) => {
  //   const angle = (index * (2 * Math.PI)) / numIntersections; // Evenly spaced angles
  //   const x =  coord.x + orbitRadius * Math.cos(angle);
  //   const y = -10 + coord.y + orbitRadius * Math.sin(angle);

  //   return {
  //     id: index + 1,
  //     coord: { x, y },
  //     size: enemySize, // You can adjust the size
  //   };
  // });
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
        {/* {soldiers.map((soldier) => (
          <g >

            <circle
              key={soldier.id}
              cx={soldier.coord.x}
              cy={soldier.coord.y}
              r={soldier.size}
              fill="blue"
              
            />
            <text
              x={soldier.coord.x}
              y={soldier.coord.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize={size / 3}
            >
              {id}
            </text>
          </g>
        ))} */}
    </g>
    
  
    
);
}

export default Intersection;