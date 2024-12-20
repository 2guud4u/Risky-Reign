import React, { useState, useEffect } from 'react';
import Hexagon from './Hexagon';
import Settlement from './Settlement';
import Intersection from './Intersection';
import { HexProps, terrainColors,generateHexes, getRollMap, HexNode } from '../utils/hexUtils';
import {calculateHexagonVertices, generateIntersections, IntersectNode} from '../utils/intersectUtils';
import { PixelCoord, calcEuclideanDistance } from '../utils/helperUtils';
import {generateGameBoard, UiEvent, UiEventPayload} from '../utils/gameUtils';
import { SettlementObj } from '../utils/settlementUtils';
import { Player } from './Player';
import { PlayerObj } from '../utils/playerUtils';
import { RoadObj } from '../utils/roadUtils';
import Road from './Road';

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
  UiEventCaller: (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => void;
}



const CatanBoard: React.FC<BoardProps> = ({hexes, settlements, players, diceRoll, roads, intersects, UiEventCaller}) => {
  const [roadStart, setRoadStart] = useState<number>(-1);

  const svgSize = 1.1 * hexSize * (boardRadius * 2 + 1) * Math.sqrt(3);


  // const handleIntersectDrop = (intersectId:number, action: string) => {
  //   const intersect = intersectMap.get(intersectId);
  //   if(intersect === undefined){
  //     return;
  //   }
  //   switch (action) {
  //     case 'buildSettlement':
  //       const newSettlement = {coord: intersect.coord, id: settlements.length, owner: "hi", upgraded: false};
        
  //       setSettlements([...settlements, newSettlement]);
  //       setGameBoard({hexMap, intersectMap: intersectMap.set(intersectId, {...intersect, settlement: newSettlement.id})});
  //       break;
  //     case 'startBuildRoad':
  //       setRoadStart(intersectId);
  //       break;
  //     default:
  //       break;
  //   }
  // };
  // const handleIntersectClick = (id:number) => {
  //   if(roadStart !== -1){
      
  //       if(roadStart === -1){
  //         return;
  //       }
  //       const startIntersect = intersectMap.get(roadStart);
  //       const endIntersect = intersectMap.get(id);
  //       if(startIntersect === undefined || endIntersect === undefined){
  //         return;
  //       }
  //       const distance = calcEuclideanDistance(startIntersect.coord, endIntersect.coord);
  //       if(distance > (hexSize * 1.1)){
  //         return;
  //       }
  //       setRoads([...roads, {id: roads.length, intersect1: roadStart, intersect2: id, owner: "hi", coord1: startIntersect.coord, coord2: endIntersect.coord, upgraded: false}]);
  //       setRoadStart(-1);

  //   }
  // };
  // const handelDiceRoll = () => {
  //   let rollNum = String(Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1);
  //   console.log("rolled", rollNum);
  //   setRoll(rollNum);
  //   const rollMap:Map<string, number[]> = getRollMap(Array.from(hexMap.values()));
  //   const hexes = rollMap.get(rollNum);
  //   console.log("looking at hexes", hexes);
  //   if(hexes === undefined){
  //     return;
  //   }

  //   for (let hexId of hexes) {
  //     let hex = hexMap.get(hexId);
  //     if(hex === undefined){
  //       continue;
  //     }
  //     if(hex.terrain !== "Desert"){
  //       let intersects = hex.intersections; 
  //       if(intersects === undefined){
  //         continue;
  //       }
  //       console.log("looking at intersects", intersects);
  //       for (let intersectId of Array.from(intersects)) {
  //         let intersect = intersectMap.get(intersectId);
  //         if(intersect === undefined){
  //           continue;
  //         }
          
  //         let settlementId = intersect.settlement;
  //         if(settlementId !== null){
  //           let settlement = settlements[settlementId];
  //           let playerName = settlement.owner;
  //           let player = players.find((player) => player.name === playerName);
  //           if(player === undefined){
  //             continue;
  //           }
  //           let resources = player.resources;
  //           resources.set(hex.terrain, resources.get(hex.terrain) as number + 1);
  //           let updatedPlayers:PlayerObj[] = players.map((p) => p.name === playerName ? {...p, resources} : p);
  //           setPlayers(updatedPlayers);
  //           console.log("given resources to player");
  //         }
  //       }
  //     }
  //   }
  // }
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
    if (roadStart !== -1) {
      UiEventCaller('buildRoad', {startIntersectId: roadStart, endIntersectId: targetId});
      setRoadStart(-1);
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
      <svg width={svgSize} height={svgSize} viewBox={`${-svgSize/2} ${-svgSize/2} ${svgSize} ${svgSize}`}>
        
        {hexes.map((hex) => (
          <Hexagon key={hex.id} {...hex} size={hexSize}  />
        ))}
        {settlements.map((settlement) => {

          return <Settlement {...settlement}size={hexSize}/>;
        })}

        

        {roads.map((road) => (
          <Road key={road.id} {...road} size={roadSize} />
        ))}
        {intersects.map((intersect) => (
          <Intersection key={intersect.id} {...intersect} size={intersectSize} onDrop={handleDrop} onClick={handleClick}/>
        ))}
      </svg>
      <div className="mt-4 grid grid-cols-3 gap-2">
      {players.map((player, index) => (
          <Player key={index} {...player} />
        ))}
      </div>
      <div>{diceRoll}</div>
      <button onClick={()=>handleClick("diceRoll", -1)}>Roll Dice</button>
    </div>
  );
};

export default CatanBoard;