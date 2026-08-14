import React, { useEffect, useState } from 'react';
import { RoadPrice, SettlementPrice, SoldierPrice, generateGameBoard } from '../utils/gameUtils';
import { GAME_HEX_SIZE } from 'common';
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
import { IntersectNode, IntersectId } from 'common';
import { RoadObj } from '../utils/roadUtils';
import { SettlementObj } from '../utils/settlementUtils';
import CatanBoard from './CatanBoard';

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

import EndTurnButton from './EndTurnButton';
import Inventory from './Inventory';

import { GameRoom, Board, getRollMap, Player } from 'common';
import { useSocket } from '../contexts/SocketContext';
import { useGameRoom } from '../contexts/GameContext';


const hexSize = 100;
const boardRadius = 2;
const intersectSize = hexSize / 4;
const roadSize = intersectSize / 2;
type Id = string;


const Game: React.FC = () => {
    const { socket, buildSettlement, endTurn: onEndTurn  } = useSocket();
    const { gameRoom: curGameRoom, currentPlayer } = useGameRoom();
    const [selectedIntersect, setSelectedIntersect] = useState<IntersectNode | undefined>(undefined);
  
    //new 
    // useEffect(() => {
    //     if (!curGameRoom || !currentPlayer) {
    //         return;
    //     }
    //     const gameBoard = curGameRoom.board;

    //     if (!gameBoard) {
    //         return <div>Loading...</div>;
    //     }
    //     const { Hexes, Intersections, Settlements, Roads, Soldiers } = gameBoard;
    //     const battleState = curGameRoom.battleState;
    //     const tradeStates = curGameRoom.tradeStates;
    //     const turnState = curGameRoom.turnState;
    //     const playerList: Player[] = curGameRoom.players;
    //     const playerMap = new Map(playerList.map((player) => [player.name, player]));
    //     if (currentPlayer === null) {
    //         return <div>No current player selected.</div>;
    //     }
    //     const playerName = currentPlayer.name;
    //     const rollMap = getRollMap(Hexes);
    // }, [curGameRoom, currentPlayer]);

    // const getSettlementByIntersect = (intersectId: IntersectId): SettlementObj | null => {
    //     const intersect = Intersections[intersectId];
    //     if (intersect === undefined) {
    //         return null;
    //     }
    //     const settlementId = intersect.settlement;
    //     if (settlementId === undefined) {
    //         return null;
    //     }
    //     return Settlements.find((settlement) => settlement.id === settlementId) || null;
    // };

    // const getRoadsByIntersect = (intersectId: IntersectId): RoadObj[] | null => {
    //     const intersect = Intersections[intersectId];
    //     if (intersect === undefined) {
    //         return null;
    //     }
    //     const roadIds = intersect.roads;
    //     if (roadIds === undefined) {
    //         return null;
    //     }
    //     return Roads.filter((road) => roadIds.has(road.id)) || null;
    // };

    
    // const handleUiEvent = (UiEvent: UiEvent, UiEventPayload: UiEventPayload) => {
    //     console.log('handling', UiEvent, UiEventPayload);
    //     let player = playerMap.get(playerName);
    //     if (player === undefined) {
    //         return;
    //     }
    //     let error: void | string = undefined;
    //     switch (UiEvent) {
    //         case 'rollDice':
    //             let rollNum = String(Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1);


    //             break;

    //         case 'selectIntersect':
    //             let intersect = Intersections[(UiEventPayload as selectIntersectPayload).intersectId];
    //             setSelectedIntersect(intersect);
                
    //             break;
    //         case 'buildSettlement':
                // if (turnState.phase !== 'Build' || turnState.player !== playerName) {
                //     error = 'Not your build turn';
                //     break;
                // }
                // error = handleBuildSettlement(
                //     UiEventPayload as buildSettlementPayload,
                //     player,
                //     intersectMap,
                //     setSettlements,
                //     setIntersectMap,
                //     settlements
                // );
                // if (error === undefined) {
                //     changePlayerResources(player, SettlementPrice, playerMap, setPlayerMap);
                // }
                // onBuildSettlement((UiEventPayload as buildSettlementPayload).intersectId);
                // buildSettlement(,(UiEventPayload as buildSettlementPayload).intersectId);
                // break;
    //         case 'upgradeSettlement':
    //             if (turnState.phase !== 'Build' || turnState.player !== playerName) {
    //                 error = 'Not your build turn';
    //                 break;
    //             }
    //             break;
    //         case 'buildRoad':
    //             if (turnState.phase !== 'Build' || turnState.player !== playerName) {
    //                 error = 'Not your build turn';
    //                 break;
    //             }
    //             error = handleBuildRoad(UiEventPayload as buildRoadPayload, setIntersectMap, intersectMap, player, roads, setRoads, settlements);
    //             if (error === undefined) {
    //                 changePlayerResources(player, RoadPrice, playerMap, setPlayerMap);
    //             }

    //             break;

    //         case 'buildSoldier':
    //             if (turnState.phase !== 'Action' || turnState.player !== playerName) {
    //                 error = 'Not your Action turn';
    //                 break;
    //             }
    //             error = handleBuildSoldier(UiEventPayload as buildSoldierPayload, player, soldiersMap, setSoldiersMap, settlements, intersectMap);
    //             if (error === undefined) {
    //                 changePlayerResources(player, SoldierPrice, playerMap, setPlayerMap);
    //             }
    //             break;

    //         case 'moveSoldier':
    //             if (turnState.phase !== 'Action' || turnState.player !== playerName) {
    //                 error = 'Not your Action turn';
    //                 break;
    //             }
    //             //check if soldier all have actions
    //             let movePayload = UiEventPayload as moveSoldierPayload;
    //             movePayload.soldierIds = movePayload.soldierIds.filter((soldierId) => {
    //                 return !exhaustedSoldiers.includes(soldierId);
    //             });
    //             error = handleMoveSoldier(movePayload, roads, player, soldiersMap, setSoldiersMap);
    //             if (error === undefined) {
    //                 setExhaustedSoldiers([...exhaustedSoldiers, ...movePayload.soldierIds]);
    //             }
    //             break;
    //         case 'initiateBattle':
    //             if (turnState.phase !== 'Action' || turnState.player !== playerName) {
    //                 error = 'Not your Action turn';
    //                 break;
    //             }
    //             let initiateBattlePayload = UiEventPayload as initiateBattlePayload;
    //             initiateBattlePayload.friendlyIds = initiateBattlePayload.friendlyIds.filter((soldierId) => {
    //                 return !exhaustedSoldiers.includes(soldierId);
    //             });
    //             error = handleInitiateBattle(initiateBattlePayload, playerName, setBattleState, soldiersMap);
    //             if (error === undefined) {
    //                 setExhaustedSoldiers([...exhaustedSoldiers, ...initiateBattlePayload.friendlyIds]);
    //             }
    //             break;

    //         case 'rolledSoldierScore':
    //             error = handleRolledSoldierScore(UiEventPayload as rolledSoldierScorePayload, playerName, setBattleState);
    //             break;
    //         case 'confirmedLineUp':
    //             let payload = UiEventPayload as confirmedLineUpPayload;
    //             error = handleConfirmedLineUp(payload, setBattleState, setSoldiersMap, getSettlementByIntersect, getRoadsByIntersect);
    //             if (battleState === null) {
    //                 return;
    //             }
    //             break;

    //         case 'updateTrade':
    //             error = handleUpdateTrade(UiEventPayload as updateTradePayload, setTradeStates);
    //             break;
    //         case 'respondTrade':
    //             let respondTradePayload = UiEventPayload as respondTradePayload;
    //             let targetTrade = tradeStates.find((trade) => trade.id === respondTradePayload.tradeId);
    //             if (targetTrade === undefined) {
    //                 return;
    //             }
    //             if (respondTradePayload.response === false) {
    //                 //can cancel whenever
    //                 error = handleRespondTrade(respondTradePayload, tradeStates, setTradeStates, setPlayerMap, playerMap);
    //             } else if (turnState.phase === 'Trade' && (turnState.player === targetTrade.tradee.name || turnState.player === targetTrade.trader.name)) {
    //                 error = handleRespondTrade(respondTradePayload, tradeStates, setTradeStates, setPlayerMap, playerMap);
    //             } else {
    //                 error = 'Not in trade phase';
    //             }
    //             break;
    //         case 'endTurn':
    //             handleEndTurn(setturnState, setExhaustedSoldiers);
    //             break;
        //     default:
        //         break;
        // }
        // console.log(error);
    
    return (
        <> {curGameRoom && currentPlayer ? (
            <Grid container direction="row">
                <Grid container direction="column" size={7}>
                    <Grid>
                        <h1>
                            {curGameRoom.turnState.phase} for {curGameRoom.turnState.player}
                        </h1>
                        {currentPlayer.name}
                    </Grid>
                    <Grid>
                    {curGameRoom.board != null && (
                        <CatanBoard
                            hexSize={GAME_HEX_SIZE}
                        />
                    )}
                    </Grid>

                    <Grid container direction="row">
                        <Grid size={2}>
                            <EndTurnButton/>
                        </Grid>
                        <Grid size={10}>
                            <Inventory />
                        </Grid>
                    </Grid>
                </Grid>

                <Grid container size={5} direction="column">
                    <Grid size={12}>
                        <PlayersList players={curGameRoom.players} />
                    </Grid>
                    <Grid container direction="row">
                        <Grid size={4}>
                            <IntersectViewer/>
                        </Grid>
                        <Grid container direction="column" size={8}>
                            <Grid >
                                <TradeHud  />
                            </Grid>
                            <Grid>
                                {/* <BattleHud playerName={playerName} BattleState={battleState} UiEventCaller={handleUiEvent} setBattleState={setBattleState} /> */}
                            </Grid>
                        </Grid>
                    </Grid>

                    
                </Grid>
            </Grid>) : (
                <>No Game</>)}
        </>
    )
    
};

export default Game;
