import React from "react";
import { Intersect } from "../utils/intersectUtils";
export interface IntersectionProps extends Intersect {

  size: number;
}

const Intersection: React.FC<IntersectionProps> = ({ key ,x, y, size}) => {
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    console.log("droped", e)
    let type = e.dataTransfer.getData("type");
    console.log("type", type)
  };

return (
    <g key={key}>
        <circle         onDragOver={handleDragOver}
        onDrop={handleDrop} cx={x} cy={y} r={size} fill="red" fillOpacity="0.3" />

    </g>
);
}

export default Intersection;