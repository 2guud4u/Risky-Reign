import React from 'react';
import { HexNode, terrainColors } from '../utils/hexUtils';
import { cubeToPixel } from '../utils/helperUtils';

interface HexagonProps extends HexNode {
    size: number;
    rollNumber: number | null;
}

const Hexagon: React.FC<HexagonProps> = ({ id, coord, terrain, size, rollNumber }) => {
    const { x, y } = cubeToPixel({ q: coord.q, r: coord.r, s: coord.s }, size);

    const hexPoints = [
        [0, -1],
        [Math.sqrt(3) / 2, -0.5],
        [Math.sqrt(3) / 2, 0.5],
        [0, 1],
        [-Math.sqrt(3) / 2, 0.5],
        [-Math.sqrt(3) / 2, -0.5],
    ].map(([px, py]) => [px * size + x, py * size + y]);

    return (
        <g>
            <polygon points={hexPoints.map(([px, py]) => `${px},${py}`).join(' ')} fill={terrainColors[terrain]} stroke="#000" strokeWidth="2" />

            <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#000" fontSize={size / 3}>
                {terrain[0]}
                {rollNumber}
                id:
                {id}
            </text>
            <circle cx={x} cy={y} r={size / 8} fill="blue" fillOpacity="0.3" />
        </g>
    );
};

export default Hexagon;
