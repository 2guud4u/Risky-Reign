import React, { useState } from 'react';
import Hexagon from '../components/Hexagon';
import Intersection from '../components/Intersection';
import Road from '../components/Road';
import Settlement from '../components/Settlement';
import { UiEvent, UiEventPayload } from '../utils/eventsUtils';
import { groupBy } from '../utils/helperUtils';
import { HexNode } from '../utils/hexUtils';
import { IntersectNode } from '../utils/intersectUtils';
import { PlayerObj } from '../utils/playerUtils';
import { RoadObj } from '../utils/roadUtils';
import { SettlementObj } from '../utils/settlementUtils';

import Grid from '@mui/material/Grid2';
import { SoldierObj } from '../utils/soldierUtils';
import { useSocket } from 'src/contexts/SocketContext';
import { useGameRoom } from 'src/contexts/GameContext';

type Id = string;
interface BoardProps {
    hexSize: number;

}

const CatanBoard: React.FC<BoardProps> = ({ hexSize
}) => {
    const boardRadius = 2;
    const intersectSize = hexSize / 4;
    const roadSize = intersectSize / 2;
    const svgSize = 1.1 * hexSize * (boardRadius * 2 + 1) * Math.sqrt(3);
    
    const { gameRoom, setSelectedIntersectId } = useGameRoom();

    const selectIntersect = (id: number) => {
        console.log(`Selected intersect with id: ${id}`);
        setSelectedIntersectId(id);
    };
    return gameRoom && gameRoom.board && gameRoom.players ? (
        <div className="mb-4">
            <Grid container>
            <Grid size={8}>
                <svg
                width={svgSize}
                height={svgSize}
                viewBox={`${-svgSize / 2} ${-svgSize / 2} ${svgSize} ${svgSize}`}
                >
                {gameRoom.board.Hexes.map((hex) => (
                    <Hexagon key={hex.id} {...hex} size={hexSize} />
                ))}
                {gameRoom.board.Settlements.map((settlement) => {
                    const player = gameRoom.players.find((player) => player.name === settlement.owner);
                    return (
                    <Settlement
                        key={settlement.id}
                        color={player ? player.color : 'grey'}
                        {...settlement}
                        size={hexSize}
                    />
                    );
                })}
                {gameRoom.board.Roads.map((road) => {
                    const player = gameRoom.players.find((player) => player.name === road.owner);
                    return (
                    <Road
                        key={road.id}
                        color={player ? player.color : 'grey'}
                        {...road}
                        size={roadSize}
                    />
                    );
                })}
                {gameRoom.board.Intersections.map((intersect) => {
                    const soldiers = gameRoom.board?.Soldiers.filter(x => x.intersect === intersect.id) || [];
                    const soldierGroups = groupBy(soldiers, 'owner');
                    const colorSoldierGroups = Object.entries(soldierGroups).map(([key, value]) => ({
                    color: gameRoom.players.find((player) => player.name === key)?.color || 'grey',
                    soldiers: value,
                    }));

                    return (
                    <Intersection
                        exhaustedSoldiers={[]}
                        {...intersect}
                        size={intersectSize}
                        onClick={selectIntersect}
                        soldierGroups={soldierGroups}
                        colorSoldierGroups={colorSoldierGroups}
                    />
                    );
                })}
                </svg>
            </Grid>
            </Grid>
        </div>
        ) : (
        <div className="text-center">Loading board...</div>
        );

};

export default CatanBoard;
