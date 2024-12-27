import React, { useState } from 'react';
import Hexagon from '../components/Hexagon';
import Intersection from '../components/Intersection';
import Road from '../components/Road';
import Settlement from '../components/Settlement';
import { UiEvent, UiEventPayload } from '../utils/gameUtils';
import { groupBy } from '../utils/helperUtils';
import { HexNode } from '../utils/hexUtils';
import { IntersectNode } from '../utils/intersectUtils';
import { PlayerObj } from '../utils/playerUtils';
import { RoadObj } from '../utils/roadUtils';
import { SettlementObj } from '../utils/settlementUtils';
import IntersectViewer from './IntersectViewer';

import Grid from '@mui/material/Grid2';
import { SoldierObj } from '../utils/soldierUtils';
const hexSize = 100;
const boardRadius = 2;
const intersectSize = hexSize / 4;
const roadSize = intersectSize / 2;

interface BoardProps {
  hexes: HexNode[];
  settlements: SettlementObj[];
  players: PlayerObj[];
  diceRoll: string;
  roads: RoadObj[];
  intersects: IntersectNode[];
  soldiersMap: Map<number, SoldierObj[]>;
  UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
}



const CatanBoard: React.FC<BoardProps> = ({hexes, settlements, players, diceRoll, roads, intersects, soldiersMap, UiEventCaller}) => {
  const [roadStart, setRoadStart] = useState<number>(-1);
  const [moveSoldier, setMoveSoldier] = useState<string>('');
  const [selectedIntersect, setSelectedIntersect] = useState<IntersectNode|undefined>(undefined);

  const svgSize = 1.1 * hexSize * (boardRadius * 2 + 1) * Math.sqrt(3);


  const handleDrop = (target: string, targetId: number, action: string) => {
    console.log(`Dropped ${action} on ${target} ${targetId}`);
    switch (action) {
      case 'buildSettlement':
        UiEventCaller('buildSettlement', {intersectId: targetId});
        break;
      case 'startBuildRoad':
        console.log('Starting to build a road');
        setRoadStart(targetId);
        break;
      default:
        break;
    };
  }

  const handleClick = (target: string, targetId: number) => {
    console.log(`Clicked on ${target} ${targetId}`);
    switch (target) {
      case 'diceRoll':
        UiEventCaller('rollDice', {});
        break;
      case 'intersection':
        if (roadStart !== -1) {
          // UiEventCaller('buildRoad', {startIntersectId: roadStart, endIntersectId: targetId});
          // setRoadStart(-1);
        } else {

          setSelectedIntersect(intersects.find((intersect) => intersect.id === targetId));
        }
        break;
      default:
        break;
    }
  };


  return (

    <div className="flex flex-col items-center">
      <div className="mb-4">
        <div
          className="w-10 h-10 bg-red-500 cursor-move"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('action', 'buildSettlement')}
          role="img"
          aria-label="Draggable settlement piece"
        >settlement</div>
                <div
          className="w-10 h-10 bg-red-500 cursor-move"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('action', 'startBuildRoad')}
          role="img"
          aria-label="Draggable settlement piece"
        >road</div>
      </div>
      <Grid container >
        <Grid size={8}>
          <svg width={svgSize} height={svgSize} viewBox={`${-svgSize/2} ${-svgSize/2} ${svgSize} ${svgSize}`}>
            
            {hexes.map((hex) => (
              <Hexagon key={hex.id} {...hex} size={hexSize}  />
            ))}
            {settlements.map((settlement) => {
              const player = players.find((player) => player.name === settlement.owner);
              return <Settlement color={player ? player.color : "grey"} {...settlement}size={hexSize}/>;
            })}
            {roads.map((road) => {
              const player = players.find((player) => player.name === road.owner);

                return <Road key={road.id} color={player ? player.color : "grey"} {...road} size={roadSize} />
              })}
            {intersects.map((intersect) => {
              const soldiers = soldiersMap.get(intersect.id) || [];
              const soldierGroups = groupBy(soldiers, 'owner');
              const colorSoldierGroups = Object.entries(soldierGroups).map(([key, value]) => ({color: players.find((player) => player.name === key)?.color || "grey"
                , soldiers: value}));
              return <Intersection key={intersect.id} {...intersect} size={intersectSize} onDrop={handleDrop} onClick={handleClick} soldierGroups={soldierGroups} colorSoldierGroups={colorSoldierGroups}/>
            })}
          </svg>
        </Grid>
        <Grid size={4}>
          <IntersectViewer soldierGroups={groupBy((selectedIntersect ? (soldiersMap.get(selectedIntersect.id) || []) : []), 'owner')} 
          intersect={selectedIntersect}  UiEventCaller={UiEventCaller}/>
        </Grid>
      </Grid>
      <div>{diceRoll}</div>
      <button onClick={()=>handleClick("diceRoll", -1)}>Roll Dice</button>
    </div>
  );
};

export default CatanBoard;