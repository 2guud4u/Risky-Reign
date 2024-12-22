import React, { useState, useEffect } from 'react';
import Hexagon from '../components/Hexagon';
import Settlement from '../components/Settlement';
import Intersection from '../components/Intersection';
import { HexProps, terrainColors,generateHexes, getRollMap, HexNode, Resource, TerrainResourceMap } from '../utils/hexUtils';
import {calculateHexagonVertices, generateIntersections, IntersectNode} from '../utils/intersectUtils';
import { PixelCoord, calcEuclideanDistance } from '../utils/helperUtils';
import {generateGameBoard, UiEvent, UiEventPayload, buildSettlementPayload, buildRoadPayload, Price, ResourceCount, SettlementPrice, RoadPrice} from '../utils/gameUtils';
import { SettlementObj } from '../utils/settlementUtils';
import { Player } from '../components/Player';
import { PlayerObj } from '../utils/playerUtils';
import { RoadObj } from '../utils/roadUtils';
import Road from '../components/Road';
import Board from './CatanBoard';

import Grid from '@mui/material/Grid2';
import PlayersList from './PlayersList';
import IntersectViewer from './IntersectViewer';

const hexSize = 100;
const boardRadius = 2;
const intersectSize = hexSize / 4;
const roadSize = intersectSize / 2;

const Game: React.FC = () =>{
    const [roll, setRoll] = useState("0");
    const [hexMap, setHexMap] = useState<Map<number , HexNode>>(new Map());
    const [intersectMap, setIntersectMap] = useState<Map<number , IntersectNode>>(new Map());
    const [roads, setRoads] = useState<RoadObj[]>([]);
    const [settlements, setSettlements] = useState<SettlementObj[]>([]);    
    const [playerMap, setPlayerMap] = useState<Map<string, PlayerObj>>(new Map());
    const [playerName, setPlayerName] = useState("jia");
    const [rollMap, setRollMap] = useState<Map<string, number[]>>(new Map());
    useEffect(() => {
        let {hexMap, intersectMap} = generateGameBoard(boardRadius, hexSize)
        const playerList = 
        [
            { name: "jia", color: "red", resources: {Wood: 100, Brick: 100, Sheep: 100, Wheat: 100, Ore: 100}},
            
            { name: "fel", color: "green", resources: {Wood: 0, Brick: 0, Sheep: 0, Wheat: 0, Ore: 0}},
        ];

        if(playerList.length === 0){
            return;
        }
        const playerMap = new Map(playerList.map((player) => [player.name, player]));
        setPlayerMap(playerMap);

        setHexMap(hexMap);
        setIntersectMap(intersectMap);
        setRollMap(getRollMap(Array.from(hexMap.values())));
    }, []);



    const handleUiEvent = (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => {
        console.log("handling", UiEvent, UiEventPayload);
        let player = playerMap.get(playerName);
        if(player === undefined){
            return;
        }
        let error: void | string = undefined;
        switch (UiEvent) {
            case "buildSettlement":
                if(checkHasPrice(player, SettlementPrice)){
                
                    error = handleBuildSettlement(UiEventPayload as buildSettlementPayload, player,intersectMap, setSettlements, setIntersectMap);
                    if(error === undefined){
                        changePlayerResources(player, SettlementPrice, playerMap, setPlayerMap, false);
                    }
                } else{
                    error = "Not enough resources";
                }
                break;
            case "buildRoad":
                if(checkHasPrice(player, RoadPrice)){
                    error = handleBuildRoad(UiEventPayload as buildRoadPayload, intersectMap, player);
                    if(error === undefined){
                        changePlayerResources(player, RoadPrice, playerMap, setPlayerMap, false);
                    }
                } else{
                    error = "Not enough resources";
                }
                break;
            case "rollDice":
                let rollNum = String(Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1);
                setRoll(rollNum);
                error = handleRollDice(rollNum, playerMap, setPlayerMap);
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
        //check if not two far away
        if(!intersect1.intersections.has(intersect2.id)){
            return false;
        }
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
            return "Cannot build here, illegal placement or no building nor road to connect to";
        }
        const roadId = roads.length;
        setRoads([...roads, {id: roadId, intersect1: payload.startIntersectId, intersect2: payload.endIntersectId, owner: player.name, coord1: intersect1.coord, coord2: intersect2.coord, upgraded: false}]);
        let newIntersectMap = intersectMap.set(payload.startIntersectId, {...intersect1, roads: intersect1.roads.add(roadId)});
        newIntersectMap = newIntersectMap.set(payload.endIntersectId, {...intersect2, roads: intersect2.roads.add(roadId)});
        
        setIntersectMap(newIntersectMap);
    };

    const handleRollDice = (rollNum: string, playerMap: Map<string, PlayerObj>, setPlayerMap: React.Dispatch<React.SetStateAction<Map<string, PlayerObj>>>): void | string => {
        const hexes = rollMap.get(rollNum);
        console.log("looking at hexes", hexes);
        if(hexes === undefined){
        return;
        }

        for (let hexId of hexes) {
            let hex = hexMap.get(hexId);
            if(hex === undefined){
                continue;
            }
            if(hex.robber){
                continue;
            }
            if(hex.terrain !== "Desert"){
                let intersects = hex.intersections; 
                if(intersects === undefined){
                continue;
                }
                console.log("looking at intersects", intersects);
                for (let intersectId of Array.from(intersects)) {
                    let intersect = intersectMap.get(intersectId);
                    if(intersect === undefined){
                        continue;
                    }
                    
                    let settlementId = intersect.settlement;
                    if(settlementId !== null){
                        let settlement = settlements[settlementId];
                        let playerName = settlement.owner;
                        let player = playerMap.get(playerName);
                        if(player === undefined){
                            continue;
                        }
                        let resources = player.resources;
                        const resource = TerrainResourceMap[hex.terrain];
                        if(resources === undefined || resource === undefined || resource === "Nothing"){
                            continue;
                        }

                        resources[resource] = resources[resource] as number + (settlement.upgraded ? 2 : 1);
                        setPlayerMap(new Map(playerMap.set(playerName, {...player, resources})));
                        console.log("given resources to player");
                    }
                }
            }
        }
    }
    const checkHasPrice = (player: PlayerObj, price: Price): boolean => {
        const playerResources = player.resources;
        if(playerResources === undefined){
            return false;
        }
        console.log(playerResources, price);
        return Object.entries(price).every(([resource, amount]) => {const key = resource as keyof ResourceCount ; return playerResources[key] >= amount});
    }

    const changePlayerResources = (player: PlayerObj, price: Price, playerMap: Map<string, PlayerObj>, setPlayerMap: React.Dispatch<React.SetStateAction<Map<string, PlayerObj>>>, add:boolean): boolean => {
        const playerResources = player.resources;
        if(playerResources === undefined){
            return false;
        }
        const newResources = Object.entries(price).reduce((acc, [resource, amount]) => {
            const key = resource as keyof ResourceCount;
            if(add){
                acc[key] = playerResources[key] + amount;
            } else {
                acc[key] = playerResources[key] - amount;
            }
            return acc;
        }, {} as ResourceCount);
        console.log(newResources);
        setPlayerMap(new Map(playerMap.set(player.name, {...player, resources: newResources} )));

        return true
        
    }


    const switchPlayer = () => {
        setPlayerName(playerName === "jia" ? "fel" : "jia");
    }

        return (
            <>
            <div>dice rolled</div>
            {roll}
            <div>playing as</div>
            {playerName}
            <button onClick={switchPlayer}>Switch Player</button>
            <Grid container spacing={3}>
                <Grid size={10}>
                    <Board hexes={Array.from(hexMap.values())} intersects={Array.from(intersectMap.values())} players={Array.from(playerMap.values())} roads={roads} diceRoll={roll} settlements={settlements} UiEventCaller={handleUiEvent}/>
                </Grid>
                <Grid size={2}>
                    <PlayersList players={Array.from(playerMap.values())}/>
                </Grid>
            </Grid>

            
            </>
        );
}

export default Game;