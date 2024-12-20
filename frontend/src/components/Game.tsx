import React, { useState, useEffect } from 'react';
import Hexagon from './Hexagon';
import Settlement from './Settlement';
import Intersection from './Intersection';
import { HexProps, terrainColors,generateHexes, getRollMap, HexNode } from '../utils/hexUtils';
import {calculateHexagonVertices, generateIntersections, IntersectNode} from '../utils/intersectUtils';
import { PixelCoord, calcEuclideanDistance } from '../utils/helperUtils';
import {generateGameBoard, UiEvent, UiEventPayload, buildSettlementPayload, buildRoadPayload} from '../utils/gameUtils';
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
        [
            {id: 0, name: "jia", color: "red", resources: new Map(
            [["Wood", 0], ["Brick", 0], ["Sheep", 0], ["Wheat", 0], ["Ore", 0]]
            )},
            {id: 1, name: "fel", color: "green", resources: new Map(
                [["Wood", 0], ["Brick", 0], ["Sheep", 0], ["Wheat", 0], ["Ore", 0]]
            )},
    ]
        );
    const [playerMap, setPlayerMap] = useState<Map<number, PlayerObj>>(new Map());
    const [playerIndex, setPlayerIndex] = useState(0);
    
    
    useEffect(() => {
        let {hexMap, intersectMap} = generateGameBoard(boardRadius, hexSize)
        setHexMap(hexMap);
        setIntersectMap(intersectMap);
    }, []);

    

    const handleUiEvent = (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => {
        console.log("handling", UiEvent, UiEventPayload);
        let player = players[playerIndex];
        let error: void | string = undefined;
        switch (UiEvent) {
            case "buildSettlement":
                error = handleBuildSettlement(UiEventPayload as buildSettlementPayload, player,intersectMap, setSettlements, setIntersectMap);
                break;
            case "buildRoad":
                error = handleBuildRoad(UiEventPayload as buildRoadPayload, intersectMap, player);
                break;
            default:
                break;
        }
        console.log(error);
    };
    const handleBuildSettlement = (payload: buildSettlementPayload, player: PlayerObj,intersectMap: Map<number , IntersectNode>, setSettlements:React.Dispatch<React.SetStateAction<SettlementObj[]>>,setIntersectMap:React.Dispatch<React.SetStateAction<Map<number, IntersectNode>>> ): void | string => {
        
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
        const newSettlement = {coord: intersect.coord, id: settlementId, owner: player.name, upgraded: false};
        setSettlements([...settlements, newSettlement]);
        setIntersectMap(new Map(intersectMap.set(payload.intersectId, {...intersect, settlement: settlementId})));
    };
    const checkRoadValid = (intersect1: IntersectNode, intersect2: IntersectNode, owner:string, roads: RoadObj[], settlements: SettlementObj[]): boolean => {
        if(intersect1.settlement !== null){
            const settlement = settlements[intersect1.settlement];
            if(settlement.owner === owner){
                return true;
            }
        }
        if(intersect2.settlement !== null){
            const settlement = settlements[intersect2.settlement];
            if(settlement.owner === owner){
                return true;
            }
        }
        if(roads.some((road) => road.owner === owner && ([road.intersect1, road.intersect2].includes(intersect1.id) || [road.intersect1, road.intersect2].includes(intersect2.id)))){
            return true;
        }
        return false;
    };
    
    const handleBuildRoad = (payload: buildRoadPayload, intersectMap: Map<number , IntersectNode>, player: PlayerObj): void | string => {
        const intersect1 = intersectMap.get(payload.startIntersectId);
        const intersect2 = intersectMap.get(payload.endIntersectId);
        if(intersect1 === undefined || intersect2 === undefined){
            return "Invalid intersection";
        }
        //check if building here is valid
        if(roads.some((road) => road.intersect1 === payload.startIntersectId && road.intersect2 === payload.endIntersectId)){
            return "Cannot build here, road already exists";
        }
        //check if has building on either end or if road is connected to another road
        if(!checkRoadValid(intersect1, intersect2, player.name, roads, settlements)){
            return "Cannot build here, no building nor road to connect to";
        }
        const roadId = roads.length;
        setRoads([...roads, {id: roadId, intersect1: payload.startIntersectId, intersect2: payload.endIntersectId, owner: player.name, coord1: intersect1.coord, coord2: intersect2.coord, upgraded: false}]);
        let newIntersectMap = intersectMap.set(payload.startIntersectId, {...intersect1, roads: intersect1.roads.add(roadId)});
        newIntersectMap = newIntersectMap.set(payload.endIntersectId, {...intersect2, roads: intersect2.roads.add(roadId)});
        
        setIntersectMap(newIntersectMap);
    };
    const switchPlayer = () => {
        setPlayerIndex((playerIndex + 1) % players.length);
    }

        return (
            <>
            <div>playing as</div>
            {players[playerIndex].name}
            <button onClick={switchPlayer}>Switch Player</button>
            <Board hexes={Array.from(hexMap.values())} intersects={Array.from(intersectMap.values())} players={players} roads={roads} diceRoll={roll} settlements={settlements} UiEventCaller={handleUiEvent}/>
            
            
            </>
        );
}

export default Game;