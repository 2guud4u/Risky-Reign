import React from 'react';
import { SettlementObj } from '../utils/settlementUtils';
interface SettlementProps extends SettlementObj {
    color: string;
    size: number;
}

const Settlement: React.FC<SettlementProps> = ({ color, coord, owner, upgraded, size }) => {
    const { x, y } = coord;
    return (
        <g transform={`translate(${x}, ${y})`}>
            <polygon points="-10,-17.3 10,-17.3 0,0" fill={color} stroke="#000" strokeWidth="2" />
            <rect x="-15" y="-17.3" width="30" height="10" fill={color} stroke="#000" strokeWidth="2" />
        </g>
    );
};

export default Settlement;
