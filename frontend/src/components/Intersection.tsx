import React from "react";
import { CubeCoord } from "../utils/hexUtils";
import { IntersectionProps } from '../utils/intersectUtils';

const Intersection: React.FC<IntersectionProps> = ({x, y, size, onDrop}) => {

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(x, y);
  };

return (
    <g >
        <circle         onDragOver={handleDragOver}
        onDrop={handleDrop} cx={x} cy={y} r={size} fill="red" fillOpacity="0.3" />

    </g>
);
}

export default Intersection;