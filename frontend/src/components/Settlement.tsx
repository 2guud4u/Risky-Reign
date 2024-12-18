import React from 'react';

interface SettlementProps {
  x: number;
  y: number;
  owner: string;
  upgrade: boolean;
}

const Settlement: React.FC<SettlementProps> = ({  x, y,owner, upgrade }) => {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <polygon
        points="-10,-17.3 10,-17.3 0,0"
        fill="#ff0000"
        stroke="#000"
        strokeWidth="2"
      />
      <rect
        x="-15"
        y="-17.3"
        width="30"
        height="10"
        fill="#ff0000"
        stroke="#000"
        strokeWidth="2"
      />
    </g>
  );
};

export default Settlement;

