import React from "react";
import { IntersectNode } from "../utils/intersectUtils";
export interface IntersectionProps extends IntersectNode {

  size: number;
  onDrop: (id: number, action:string) => void;
}

const Intersection: React.FC<IntersectionProps> = ({ id ,coord, size, onDrop}) => {
  const { x, y } = coord;
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    console.log("droped", e)
    let action = e.dataTransfer.getData("action");
    onDrop(id, action);
  };

return (
  
  <g >
        <circle         onDragOver={handleDragOver}
        onDrop={handleDrop} cx={x} cy={y} r={size} fill="red" fillOpacity="0.3" />
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
    </g>
    
  
    
);
}

export default Intersection;