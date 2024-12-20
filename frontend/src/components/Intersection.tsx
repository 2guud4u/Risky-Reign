import React from "react";
import { IntersectNode } from "../utils/intersectUtils";
export interface IntersectionProps extends IntersectNode {

  size: number;
  onDrop: (id: number, action:string) => void;
  onClick: (id: number) => void;
}

const Intersection: React.FC<IntersectionProps> = ({ id ,coord, size, onDrop, onClick}) => {
  const { x, y } = coord;
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    let action = e.dataTransfer.getData("action");
    console.log("dropped", id, action);
    onDrop(id, action);
  };
  const handleClick = (e: React.MouseEvent) => {
    onClick(id);
    console.log("clicked", id);

  }

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
    </g>
    
  
    
);
}

export default Intersection;