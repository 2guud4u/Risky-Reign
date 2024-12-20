import React, { useState, useEffect } from 'react';
import Hexagon from './Hexagon';
import Settlement from './Settlement';
import Intersection from './Intersection';
import { HexProps, terrainColors,generateHexes, getRollMap, HexNode } from '../utils/hexUtils';
import {calculateHexagonVertices, generateIntersections, IntersectNode} from '../utils/intersectUtils';
import { PixelCoord, calcEuclideanDistance } from '../utils/helperUtils';
import {generateGameBoard, UiEvent, UiEventPayload, buildSettlementPayload} from '../utils/gameUtils';
import { SettlementObj } from '../utils/settlementUtils';
import { Player } from './Player';
import { PlayerObj } from '../utils/playerUtils';
import { RoadObj } from '../utils/roadUtils';
import Road from './Road';
import Board from './CatanBoard';

const hexSize = 100;
const boardRadius = 2;
const intersectSize = hexSize / 4;
const roadSize = intersectSize / 2;

const Game: React.FC = () =>{
    const [roll, setRoll] = useState("");
    const [hexMap, setHexMap] = useState<Map<number , HexNode>>(new Map());
    const [intersectMap, setIntersectMap] = useState<Map<number , IntersectNode>>(new Map());
    const [roads, setRoads] = useState<RoadObj[]>([]);
    const [settlements, setSettlements] = useState<SettlementObj[]>([]);
    const [roadStart, setRoadStart] = useState<number>(-1);
    const [players, setPlayers] = useState<PlayerObj[]>(
        [{id: 0, name: "hi", color: "red", resources: new Map(
        [["Wood", 0], ["Brick", 0], ["Sheep", 0], ["Wheat", 0], ["Ore", 0]]
        )}]
        );
    const [playerIndex, setPlayerIndex] = useState(0);
    
    useEffect(() => {
        let {hexMap, intersectMap} = generateGameBoard(boardRadius, hexSize)
        setHexMap(hexMap);
        setIntersectMap(intersectMap);
    }, []);

    const handleUiEvent = (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => {
        console.log("handling", UiEvent, UiEventPayload);
        let error: void | string = undefined;
        switch (UiEvent) {
            case "buildSettlement":
                error = handleBuildSettlement(UiEventPayload as buildSettlementPayload);
                break;
            case "buildRoad":
                setRoadStart(UiEventPayload.intersectId);
                break;
            default:
                break;
        }
        console.log(error);
    };
    const handleBuildSettlement = (payload: buildSettlementPayload): void | string => {
        
        const intersect = intersectMap.get(payload.intersectId);
        if(intersect === undefined){
            return "Invalid intersection";
        }
        //check if building here is valid
        if(intersect.settlement !== null){
            return "Cannot build here, building already exists";
        }
        
        if(intersect.intersections.size === 0){
            return;
        }
        const intersectNeighbors = Array.from(intersect.intersections).map((id) => intersectMap.get(id));
        if(intersectNeighbors.some((neighbor) => neighbor !== undefined && neighbor.settlement !== null)){
            return "Cannot build here, settlement too close to other settlement";
        }
        const settlementId = settlements.length;
        const newSettlement = {coord: intersect.coord, id: settlementId, owner: players[playerIndex].name, upgraded: false};
        setSettlements([...settlements, newSettlement]);
        setIntersectMap(new Map(intersectMap.set(payload.intersectId, {...intersect, settlement: settlementId})));
    };

        return (
            <Board hexes={Array.from(hexMap.values())} intersects={Array.from(intersectMap.values())} players={players} roads={roads} diceRoll={roll} settlements={settlements} UiEventCaller={handleUiEvent}/>
        );
}

export default Game;