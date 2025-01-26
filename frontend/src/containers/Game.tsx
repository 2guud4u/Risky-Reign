import React, { useEffect, useState } from 'react';
import { RoadPrice, SettlementPrice, SoldierPrice, generateGameBoard } from '../utils/gameUtils';

import {
    buildRoadPayload,
    buildSettlementPayload,
    buildSoldierPayload,
    moveSoldierPayload,
    UiEvent,
    selectIntersectPayload,
    UiEventPayload,
    initiateBattlePayload,
    rolledSoldierScorePayload,
    confirmedLineUpPayload,
    updateTradePayload,
    respondTradePayload,
} from '../utils/eventsUtils';
import { getRollMap, HexNode, HexId } from '../utils/hexUtils';
import { IntersectNode, IntersectId } from '../utils/intersectUtils';
import { PlayerObj } from '../utils/playerUtils';
import { RoadObj } from '../utils/roadUtils';
import { SettlementObj } from '../utils/settlementUtils';
import Board from './CatanBoard';

import Grid from '@mui/material/Grid2';
import {
    handleBuildRoad,
    handleBuildSettlement,
    handleBuildSoldier,
    handleInitiateBattle,
    handleMoveSoldier,
    handleRollDice,
    handleRolledSoldierScore,
    handleConfirmedLineUp,
    handleUpdateTrade,
    handleRespondTrade,
    handleEndTurn,
} from '../logic/uiEvents';
import { changePlayerResources } from '../services/update';
import { SoldierObj, BattleState } from '../utils/soldierUtils';
import PlayersList from './PlayersList';
import BattleHud from './BattleHud';
import IntersectViewer from './IntersectViewer';
import { groupBy, zip } from '../utils/helperUtils';
import TradeHud from './TradeHud';
import { tradeState } from '../utils/tradeUtils';
import {TurnState} from '../utils/turnUtils';
import EndTurnButton from './EndTurnButton';
const hexSize = 100;
const boardRadius = 2;
const intersectSize = hexSize / 4;
const roadSize = intersectSize / 2;

const Game: React.FC = () => {
    const [roll, setRoll] = useState('0');
    const [hexMap, setHexMap] = useState<Map<HexId, HexNode>>(new Map());
    const [intersectMap, setIntersectMap] = useState<Map<IntersectId, IntersectNode>>(new Map());
    const [roads, setRoads] = useState<RoadObj[]>([]);
    const [settlements, setSettlements] = useState<SettlementObj[]>([]);
    const [selectedIntersect, setSelectedIntersect] = useState<IntersectNode | undefined>(undefined);
    const [battleState, setBattleState] = useState<BattleState | null>(null);
    const [turnObj, setTurnObj] = useState<TurnState>({
        phase: 'Dice',
        player: 'jia',
        playerOrder: ['jia', 'fel', 'idk'],
        offset: 0,
    });
    
    const [tradeStates, setTradeStates] = useState<tradeState[]>([
        {
            id: '1',
            trader: {
                name: 'jia',
                offer: {
                    Wood: 1,
                    Brick: 1,
                    Sheep: 1,
                    Wheat: 1,
                    Ore: 1,
                },
                accept: true,
            },
            tradee: {
                name: 'fel',
                offer: {
                    Wood: 1,
                    Brick: 1,
                    Sheep: 1,
                    Wheat: 1,
                    Ore: 1,
                },
                accept: null,
            },
        },
        {
            id: '2',
            trader: {
                name: 'fel',
                offer: {
                    Wood: 1,
                    Brick: 4,
                    Sheep: 1,
                    Wheat: 1,
                    Ore: 1,
                },
                accept: true,
            },
            tradee: {
                name: 'jia',
                offer: {
                    Wood: 1,
                    Brick: 1,
                    Sheep: 1,
                    Wheat: 1,
                    Ore: 1,
                },
                accept: null,
            },
        },
    ]);
    const [soldiersMap, setSoldiersMap] = useState<Map<IntersectId, SoldierObj[]>>(
        new Map([
            [
                1,
                [
                    {
                        id: '0',
                        owner: 'jia',
                        intersect: 1,
                        type: 'infantry',
                        injured: false,
                        stationed: false,
                    },
                    {
                        id: '1',
                        owner: 'fel',
                        intersect: 1,
                        type: 'infantry',
                        injured: false,
                        stationed: false,
                    },
                    {
                        id: '2',
                        owner: 'jia',
                        intersect: 1,
                        type: 'infantry',
                        injured: false,
                        stationed: false,
                    },
                    {
                        id: '3',
                        owner: 'jia',
                        intersect: 1,
                        type: 'infantry',
                        injured: false,
                        stationed: false,
                    },
                    {
                        id: '4',
                        owner: 'fel',
                        intersect: 1,
                        type: 'infantry',
                        injured: false,
                        stationed: false,
                    },
                ],
            ],
        ])
    );
    const [playerMap, setPlayerMap] = useState<Map<string, PlayerObj>>(new Map());
    const [playerName, setPlayerName] = useState('jia');
    const [rollMap, setRollMap] = useState<Map<string, number[]>>(new Map());

    useEffect(() => {
        let { hexMap, intersectMap } = generateGameBoard(boardRadius, hexSize);
        const playerList: PlayerObj[] = [
            {
                name: 'jia',
                color: 'red',
                resources: {
                    Wood: 100,
                    Brick: 100,
                    Sheep: 100,
                    Wheat: 100,
                    Ore: 100,
                },
            },

            {
                name: 'fel',
                color: 'green',
                resources: {
                    Wood: 50,
                    Brick: 50,
                    Sheep: 50,
                    Wheat: 50,
                    Ore: 50,
                },
            },
            {
                name: 'idk',
                color: 'blue',
                resources: {
                    Wood: 50,
                    Brick: 50,
                    Sheep: 50,
                    Wheat: 50,
                    Ore: 50,
                },
            },
        ];

        if (playerList.length === 0) {
            return;
        }
        const playerMap = new Map(playerList.map((player) => [player.name, player]));
        setPlayerMap(playerMap);
        setHexMap(hexMap);
        setIntersectMap(intersectMap);
        setRollMap(getRollMap(Array.from(hexMap.values())));
    }, []);

    const getSettlementByIntersect = (intersectId: IntersectId): SettlementObj | null => {
        const intersect = intersectMap.get(intersectId);
        if (intersect === undefined) {
            return null;
        }
        const settlementId = intersect.settlement;
        if (settlementId === undefined) {
            return null;
        }
        return settlements.find((settlement) => settlement.id === settlementId) || null;
    };

    const getRoadsByIntersect = (intersectId: IntersectId): RoadObj[] | null => {
        const intersect = intersectMap.get(intersectId);
        if (intersect === undefined) {
            return null;
        }
        const roadIds = intersect.roads;
        if (roadIds === undefined) {
            return null;
        }
        return roads.filter((road) => roadIds.has(road.id)) || null;
    };

    const handleUiEvent = (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => {
        console.log('handling', UiEvent, UiEventPayload);
        let player = playerMap.get(playerName);
        if (player === undefined) {
            return;
        }
        let error: void | string = undefined;
        switch (UiEvent) {
            case 'selectIntersect':
                setSelectedIntersect(intersectMap.get((UiEventPayload as selectIntersectPayload).intersectId));
                break;
            case 'buildSettlement':
                error = handleBuildSettlement(
                    UiEventPayload as buildSettlementPayload,
                    player,
                    intersectMap,
                    setSettlements,
                    setIntersectMap,
                    settlements
                );
                if (error === undefined) {
                    changePlayerResources(player, SettlementPrice, playerMap, setPlayerMap);
                }

                break;
            case 'upgradeSettlement':
                break;
            case 'buildRoad':
                error = handleBuildRoad(UiEventPayload as buildRoadPayload, setIntersectMap, intersectMap, player, roads, setRoads, settlements);
                if (error === undefined) {
                    changePlayerResources(player, RoadPrice, playerMap, setPlayerMap);
                }

                break;
            case 'rollDice':
                let rollNum = String(Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1);
                setRoll(rollNum);
                error = handleRollDice(rollNum, playerMap, setPlayerMap, hexMap, intersectMap, rollMap, settlements);
                break;
            case 'buildSoldier':
                error = handleBuildSoldier(UiEventPayload as buildSoldierPayload, player, soldiersMap, setSoldiersMap, settlements, intersectMap);
                if (error === undefined) {
                    changePlayerResources(player, SoldierPrice, playerMap, setPlayerMap);
                }
                break;
            case 'moveSoldier':
                error = handleMoveSoldier(UiEventPayload as moveSoldierPayload, roads, player, soldiersMap, setSoldiersMap);
                break;
            case 'initiateBattle':
                error = handleInitiateBattle(UiEventPayload as initiateBattlePayload, playerName, setBattleState, soldiersMap);
                break;
            case 'rolledSoldierScore':
                error = handleRolledSoldierScore(UiEventPayload as rolledSoldierScorePayload, playerName, setBattleState);
                break;
            case 'confirmedLineUp':
                let payload = UiEventPayload as confirmedLineUpPayload;
                error = handleConfirmedLineUp(payload, setBattleState, setSoldiersMap, getSettlementByIntersect, getRoadsByIntersect);
                if (battleState === null) {
                    return;
                }
                break;

            case 'updateTrade':
                error = handleUpdateTrade(UiEventPayload as updateTradePayload, setTradeStates);
                break;
            case 'respondTrade':
                error = handleRespondTrade(UiEventPayload as respondTradePayload, tradeStates, setTradeStates, setPlayerMap, playerMap);
                break;
            case 'endTurn':
                handleEndTurn(setTurnObj);
                break;
            default:
                break;
        }
        console.log(error);
    };

    const switchPlayer = () => {
        setPlayerName(playerName === 'jia' ? 'fel' : 'jia');
    };

    return (
        <>
            <h1>{turnObj.phase} for {turnObj.player}</h1>
            <div>playing as</div>
            {playerName}
            <button onClick={switchPlayer}>Switch Player</button>
            <button onClick={() => setPlayerName('idk')}>Switch to idk</button>
            <Grid container direction="row">

            
            <Grid container spacing={3}>
                <Grid size={6}>
                    <Board
                        hexes={Array.from(hexMap.values())}
                        intersects={Array.from(intersectMap.values())}
                        players={Array.from(playerMap.values())}
                        roads={roads}
                        diceRoll={roll}
                        settlements={settlements}
                        UiEventCaller={handleUiEvent}
                        soldiersMap={soldiersMap}
                    />
                </Grid>
                <Grid container size={6}>
                    <Grid size={6}>
                        <IntersectViewer
                            soldiersMap={soldiersMap}
                            intersect={selectedIntersect}
                            UiEventCaller={handleUiEvent}
                            playerName={playerName}
                            settlements={settlements}
                        />
                    </Grid>
                    <Grid size={6}>
                        <PlayersList players={Array.from(playerMap.values())} />
                    </Grid>
                    <Grid size={12}>
                        <BattleHud playerName={playerName} BattleState={battleState} UiEventCaller={handleUiEvent} setBattleState={setBattleState} />
                    </Grid>
                    <Grid size={12}>
                        <TradeHud tradeStates={tradeStates} playerName={playerName} playerMap={playerMap} UiEventCaller={handleUiEvent} />
                    </Grid>
                </Grid>
            </Grid>
            <Grid>
                <EndTurnButton UiEventCaller={handleUiEvent} turnObj={turnObj} player={playerName} />
            </Grid>
            </Grid>
        </>
    );
};

export default Game;
