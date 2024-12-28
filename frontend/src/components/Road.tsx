import React from 'react';
import { RoadObj } from '../utils/roadUtils';
interface RoadProps extends RoadObj {
    size: number;
    color: string;
}

const Road: React.FC<RoadProps> = ({ color, coord1, coord2, size }) => {
    return (
        <g>
            <line
                x1={coord1.x} // x-coordinate of the start point
                y1={coord1.y} // y-coordinate of the start point
                x2={coord2.x} // x-coordinate of the end point
                y2={coord2.y} // y-coordinate of the end point
                stroke={color} // Line color
                strokeWidth={size} // Line thickness
            />
        </g>
    );
};

export default Road;
