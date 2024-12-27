import React, { useEffect, useState } from 'react';
import { buildRoadPayload, buildSettlementPayload, buildSoldierPayload, generateGameBoard, moveSoldierPayload, Price, ResourceCount, RoadPrice, SettlementPrice, SoldierPrice, UiEvent, UiEventPayload } from '../utils/gameUtils';
import { getRollMap, HexNode, TerrainResourceMap } from '../utils/hexUtils';
import { IntersectNode } from '../utils/intersectUtils';
import { PlayerObj } from '../utils/playerUtils';
import { RoadObj } from '../utils/roadUtils';
import { SettlementObj } from '../utils/settlementUtils';
import Board from './CatanBoard';

import Grid from '@mui/material/Grid2';
import { v4 as uuidv4 } from 'uuid';
import { SoldierObj, SoldierType } from '../utils/soldierUtils';
import PlayersList from './PlayersList';

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
    const [soldiersMap, setSoldiersMap] = useState<Map<number,SoldierObj[]>>(new Map(
        [
        [1,
            [
                {id: "0", owner: "jia", intersect:1, type: "infantry", injured: false, stationed: false},
                {id: "1", owner: "fel", intersect:1, type: "infantry", injured: false, stationed: false},

            ]
        ]
        ])
    );  
    const [playerMap, setPlayerMap] = useState<Map<string, PlayerObj>>(new Map());
    const [playerName, setPlayerName] = useState("jia");
    const [rollMap, setRollMap] = useState<Map<string, number[]>>(new Map());
    useEffect(() => {
        let {hexMap, intersectMap} = generateGameBoard(boardRadius, hexSize)
        const playerList = 
        [
            { name: "jia", color: "red", resources: {Wood: 100, Brick: 100, Sheep: 100, Wheat: 100, Ore: 100}},
            
            { name: "fel", color: "green", resources: {Wood: 50, Brick: 50, Sheep: 50, Wheat: 50, Ore: 50}},
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
            case "upgradeSettlement":
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
            case "buildSoldier":
                if(checkHasPrice(player, SoldierPrice)){
                    error = handleBuildSoldier(UiEventPayload as buildSoldierPayload, player, soldiersMap, setSoldiersMap);
                    if(error === undefined){
                        changePlayerResources(player, SoldierPrice, playerMap, setPlayerMap, false);
                    }
                } else{
                    error = "Not enough resources";
                }
                break;
            case "moveSoldier":
                error = handleMoveSoldier(UiEventPayload as moveSoldierPayload, roads,player, soldiersMap, setSoldiersMap);
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

    const handleBuildSoldier = (payload: buildSoldierPayload, player: PlayerObj, soldiersMap: Map<number, SoldierObj[]>, setSoldiersMap:React.Dispatch<React.SetStateAction<Map<number, SoldierObj[]>>> ): void | string => {
        const intersect = intersectMap.get(payload.intersectId);
        if(intersect === undefined){
            return "Invalid intersection";
        }
        const soldierId = uuidv4();
        const settlement = intersect.settlement;
        if(settlement === null){
            return "Cannot build soldier here, no settlement";
        }
        if(settlements[settlement].owner !== player.name){
            return "Cannot build soldier here, not your settlement";
        }

        const newSoldier = {id: soldierId, owner: player.name, intersect: payload.intersectId, type: "infantry" as SoldierType, injured: false, stationed: false};
        const soldiers = soldiersMap.get(intersect.id);
        if(soldiers === undefined){
            setSoldiersMap(new Map(soldiersMap.set(intersect.id, [newSoldier])));
        } else {
            setSoldiersMap(new Map(soldiersMap.set(intersect.id, [...soldiers, newSoldier])));
        }
        
    };
    const handleMoveSoldier = (payload: moveSoldierPayload, roads: RoadObj[],player: PlayerObj,soldiersMap: Map<number, SoldierObj[]>, setSoldiersMap:React.Dispatch<React.SetStateAction<Map<number, SoldierObj[]>>>): void | string => {
        if(payload.startIntersectId === payload.endIntersectId){
            return "Soldier is moving to the same location"
        }
        //check if road exists
        if(roads.find((road) => (road.intersect1 === payload.startIntersectId && road.intersect2 === payload.endIntersectId) || (road.intersect1 === payload.endIntersectId && road.intersect2 === payload.startIntersectId)) === undefined){
            return "Cannot move soldier, no road";
        }
        const soldiers = soldiersMap.get(payload.startIntersectId);
        if(soldiers === undefined){
            return "No soldiers to move";
        }
        const soldier = soldiers.find((soldier) => soldier.id === payload.soldierId);
        if(soldier === undefined){
            return "No soldiers to move";
        }
        if(player.name !== soldier.owner){
            return "Cannot move soldier, not your soldier";
        }

        setSoldiersMap(new Map(soldiersMap.set(payload.startIntersectId, soldiers.filter((s) => s.id !== soldier.id))));
        setSoldiersMap(new Map(soldiersMap.set(payload.endIntersectId, [...(soldiersMap.get(payload.endIntersectId) ?? []), soldier])));
    }
    const handleRollDice = (rollNum: string, playerMap: Map<string, PlayerObj>, setPlayerMap: React.Dispatch<React.SetStateAction<Map<string, PlayerObj>>>): void | string => {
        const hexes = rollMap.get(rollNum);
       
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
                        let price = {
                            "Wood": 0,
                            "Brick": 0,
                            "Sheep": 0,
                            "Wheat": 0,
                            "Ore": 0
                        } as Price;

                        price[resource] = settlement.upgraded ? 2 : 1;
                        
                        changePlayerResources(player, price, playerMap, setPlayerMap, true);
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
                    <Board hexes={Array.from(hexMap.values())} 
                    intersects={Array.from(intersectMap.values())} 
                    players={Array.from(playerMap.values())} 
                    roads={roads} diceRoll={roll} 
                    settlements={settlements} 
                    UiEventCaller={handleUiEvent}
                    soldiersMap={soldiersMap}/>
                </Grid>
                <Grid size={2}>
                    <PlayersList players={Array.from(playerMap.values())}/>
                </Grid>
            </Grid>

            
            </>
        );
}

export default Game;