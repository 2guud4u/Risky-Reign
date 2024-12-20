import React, { useState, useEffect } from 'react';
import Hexagon from './Hexagon';
import Settlement from './Settlement';
import Intersection from './Intersection';
import { HexProps, terrainColors,generateHexes, getRollMap, HexNode } from '../utils/hexUtils';
import {calculateHexagonVertices, generateIntersections, IntersectNode} from '../utils/intersectUtils';
import { PixelCoord, calcEuclideanDistance } from '../utils/helperUtils';
import {generateGameBoard} from '../utils/gameUtils';
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
    const [{hexMap, intersectMap}, setGameBoard] = useState(generateGameBoard(boardRadius, hexSize));
    const [roads, setRoads] = useState<RoadObj[]>([]);
    const [settlements, setSettlements] = useState<SettlementObj[]>([]);
    const [roadStart, setRoadStart] = useState<number>(-1);
    const [players, setPlayers] = useState<PlayerObj[]>(
        [{id: 0, name: "hi", color: "red", resources: new Map(
        [["Wood", 0], ["Brick", 0], ["Sheep", 0], ["Wheat", 0], ["Ore", 0]]
        )}]
        );
        return (
            <Board hexes={Array.from(hexMap.values())} intersects={Array.from(intersectMap.values())} players={players} roads={roads} diceRoll={roll} settlements={settlements}/>
        );
}

export default Game;