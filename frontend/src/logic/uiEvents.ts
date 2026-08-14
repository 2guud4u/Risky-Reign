import { Price, SettlementPrice, ResourceCount, RoadPrice, SoldierPrice } from '../utils/gameUtils';
import {
    buildRoadPayload,
    buildSettlementPayload,
    buildSoldierPayload,
    moveSoldierPayload,
    initiateBattlePayload,
    rolledSoldierScorePayload,
    confirmedLineUpPayload,
    updateTradePayload,
    respondTradePayload,
} from '../utils/eventsUtils';
import { PlayerObj } from '../utils/playerUtils';
import { VertexNode, VertexId } from '../utils/intersectUtils';
import { SettlementObj } from '../utils/settlementUtils';
import { RoadObj } from '../utils/roadUtils';
import { SoldierObj, SoldierType, BattleState } from '../utils/soldierUtils';
import { v4 as uuidv4 } from 'uuid';
import Settlement from '../components/Settlement';
import { TerrainResourceMap, HexNode } from '../utils/hexUtils';
import { changePlayerResources, updateSingleSoldier, priceMath } from '../services/update';
import Road from '../components/Road';
import { groupBy, zip } from '../utils/helperUtils';
import { tradeState } from '../utils/tradeUtils';
import { TurnState } from '../utils/turnUtils';

export const checkHasPrice = (player: PlayerObj, price: Price): boolean => {
    const playerResources = player.resources;
    if (playerResources === undefined) {
        return false;
    }

    return Object.entries(price).every(([resource, amount]) => {
        const key = resource as keyof ResourceCount;
        return playerResources[key] >= amount;
    });
};

export const handleBuildSettlement = (
    payload: buildSettlementPayload,
    player: PlayerObj,
    intersectMap: Map<number, VertexNode>,
    setSettlements: React.Dispatch<React.SetStateAction<SettlementObj[]>>,
    setIntersectMap: React.Dispatch<React.SetStateAction<Map<number, VertexNode>>>,
    settlements: SettlementObj[]
): void | string => {
    //check if has enough resources
    if (!checkHasPrice(player, SettlementPrice)) {
        return 'Not enough resources';
    }

    const intersect = intersectMap.get(payload.vertexId);
    if (intersect === undefined) {
        return 'Invalid intersection';
    }
    //check if building here is valid
    if (intersect.settlement !== null) {
        return 'Cannot build here, building already exists';
    }

    if (intersect.vertices.size === 0) {
        return;
    }
    const intersectNeighbors = Array.from(intersect.vertices).map((id) => intersectMap.get(id));
    if (intersectNeighbors.some((neighbor) => neighbor !== undefined && neighbor.settlement !== null)) {
        return 'Cannot build here, settlement too close to other settlement';
    }
    const settlementId = settlements.length;
    const newSettlement = {
        coord: intersect.coord,
        id: settlementId,
        owner: player.name,
        upgraded: false,
    };
    setSettlements([...settlements, newSettlement]);
    setIntersectMap(
        new Map(
            intersectMap.set(payload.vertexId, {
                ...intersect,
                settlement: settlementId,
            })
        )
    );
};

const checkRoadValid = (
    intersect1: VertexNode,
    intersect2: VertexNode,
    owner: string,
    roads: RoadObj[],
    settlements: SettlementObj[]
): boolean => {
    //check if not two far away
    if (!intersect1.vertices.has(intersect2.id)) {
        return false;
    }
    if (intersect1.settlement !== null) {
        const settlement = settlements[intersect1.settlement];
        if (settlement.owner === owner) {
            return true;
        }
    }
    if (intersect2.settlement !== null) {
        const settlement = settlements[intersect2.settlement];
        if (settlement.owner === owner) {
            return true;
        }
    }
    if (
        roads.some(
            (road) =>
                road.owner === owner &&
                ([road.intersect1, road.intersect2].includes(intersect1.id) || [road.intersect1, road.intersect2].includes(intersect2.id))
        )
    ) {
        return true;
    }

    return false;
};

export const handleBuildRoad = (
    payload: buildRoadPayload,
    setIntersectMap: React.Dispatch<React.SetStateAction<Map<number, VertexNode>>>,
    intersectMap: Map<number, VertexNode>,
    player: PlayerObj,
    roads: RoadObj[],
    setRoads: React.Dispatch<React.SetStateAction<RoadObj[]>>,
    settlements: SettlementObj[]
): void | string => {
    if (!checkHasPrice(player, RoadPrice)) {
        return 'Not enough resources';
    }
    const intersect1 = intersectMap.get(payload.startVertexId);
    const intersect2 = intersectMap.get(payload.endVertexId);
    if (intersect1 === undefined || intersect2 === undefined) {
        return 'Invalid intersection';
    }
    //check if building here is valid
    if (roads.some((road) => road.intersect1 === payload.startVertexId && road.intersect2 === payload.endVertexId)) {
        return 'Cannot build here, road already exists';
    }
    //check if has building on either end or if road is connected to another road
    if (!checkRoadValid(intersect1, intersect2, player.name, roads, settlements)) {
        return 'Cannot build here, illegal placement or no building nor road to connect to';
    }
    const roadId = roads.length;
    setRoads([
        ...roads,
        {
            id: roadId,
            intersect1: payload.startVertexId,
            intersect2: payload.endVertexId,
            owner: player.name,
            coord1: intersect1.coord,
            coord2: intersect2.coord,
            upgraded: false,
        },
    ]);
    let newIntersectMap = intersectMap.set(payload.startVertexId, {
        ...intersect1,
        roads: intersect1.roads.add(roadId),
    });
    newIntersectMap = newIntersectMap.set(payload.endVertexId, {
        ...intersect2,
        roads: intersect2.roads.add(roadId),
    });

    setIntersectMap(newIntersectMap);
};
////////////////////////////////////////
// Soldier Stuff
////////////////////////////////////////
export const handleBuildSoldier = (
    payload: buildSoldierPayload,
    player: PlayerObj,
    soldiersMap: Map<number, SoldierObj[]>,
    setSoldiersMap: React.Dispatch<React.SetStateAction<Map<number, SoldierObj[]>>>,
    settlements: SettlementObj[],
    intersectMap: Map<number, VertexNode>
): void | string => {
    if (!checkHasPrice(player, SoldierPrice)) {
        return 'Not enough resources';
    }
    const intersect = intersectMap.get(payload.vertexId);
    if (intersect === undefined) {
        return 'Invalid intersection';
    }
    const soldierId = uuidv4();
    const settlement = intersect.settlement;
    if (settlement === null) {
        return 'Cannot build soldier here, no settlement';
    }
    if (settlements[settlement].owner !== player.name) {
        return 'Cannot build soldier here, not your settlement';
    }

    const newSoldier = {
        id: soldierId,
        owner: player.name,
        intersect: payload.vertexId,
        type: 'infantry' as SoldierType,
        injured: false,
        stationed: false,
    };
    const soldiers = soldiersMap.get(intersect.id);
    if (soldiers === undefined) {
        setSoldiersMap(new Map(soldiersMap.set(intersect.id, [newSoldier])));
    } else {
        setSoldiersMap(new Map(soldiersMap.set(intersect.id, [...soldiers, newSoldier])));
    }
};

export const handleMoveSoldier = (
    payload: moveSoldierPayload,
    roads: RoadObj[],
    player: PlayerObj,
    soldiersMap: Map<number, SoldierObj[]>,
    setSoldiersMap: React.Dispatch<React.SetStateAction<Map<number, SoldierObj[]>>>
): void | string => {
    if (payload.startVertexId === payload.endVertexId) {
        return 'Soldier is moving to the same location';
    }
    //check if road exists
    if (
        roads.find(
            (road) =>
                (road.intersect1 === payload.startVertexId && road.intersect2 === payload.endVertexId) ||
                (road.intersect1 === payload.endVertexId && road.intersect2 === payload.startVertexId)
        ) === undefined
    ) {
        return 'Cannot move soldier, no road';
    }
    const soldiers = soldiersMap.get(payload.startVertexId);
    if (soldiers === undefined) {
        return 'No soldiers to move';
    }

    const movingSoldiers = soldiers.filter((soldier) => payload.soldierIds.includes(soldier.id));

    if (movingSoldiers === undefined || movingSoldiers.length === 0) {
        return 'No soldiers to move';
    }

    if (player.name !== movingSoldiers[0].owner) {
        return 'Cannot move soldier, not your soldier';
    }

    setSoldiersMap(
        new Map(
            soldiersMap.set(
                payload.startVertexId,
                soldiers.filter((s) => !payload.soldierIds.includes(s.id))
            )
        )
    );

    setSoldiersMap(new Map(soldiersMap.set(payload.endVertexId, [...(soldiersMap.get(payload.endVertexId) ?? []), ...movingSoldiers])));
};
export const handleInitiateBattle = (
    payload: initiateBattlePayload,
    friendlyName: string,
    setBattleState: React.Dispatch<React.SetStateAction<BattleState | null>>,
    soldiersMap: Map<VertexId, SoldierObj[]>
): void | string => {
    const { vertexId, friendlyIds, enemyIds, enemyName } = payload;
    const soldiers = soldiersMap.get(vertexId);
    if (soldiers === undefined) {
        return 'No soldiers to battle';
    }

    const idToSoldier = groupBy(soldiers, 'id');

    if (friendlyIds.length === 0 || enemyIds.length === 0) {
        return 'No soldiers to battle';
    }
    const friendlySoldiers = friendlyIds.map((id) => idToSoldier[id][0]);
    const enemySoldiers = enemyIds.map((id) => idToSoldier[id][0]);

    if (friendlySoldiers.length === 0 || enemySoldiers.length === 0) {
        return 'No soldiers to battle';
    }

    const states = new Map<string, { soldiers: { soldier: SoldierObj; rollNum: number; dead: boolean }[]; submitted: boolean }>();
    states.set(friendlyName, { soldiers: friendlySoldiers.map((soldier) => ({ soldier, rollNum: 0, dead: false })), submitted: false });
    states.set(enemyName, { soldiers: enemySoldiers.map((soldier) => ({ soldier, rollNum: 0, dead: false })), submitted: false });
    setBattleState({ states, vertexId });
};
export const handleRolledSoldierScore = (
    payload: rolledSoldierScorePayload,
    playerName: string,
    setBattleState: React.Dispatch<React.SetStateAction<BattleState | null>>
): void | string => {
    let error: void | string = undefined;

    setBattleState((prev) => {
        if (prev === null) {
            error = 'No battle state';
            return null;
        }
        const newStates = new Map(prev.states);
        const playerState = newStates.get(playerName);
        if (playerState === undefined) {
            error = 'No player state';
            return prev;
        }
        const newSoldiers = playerState.soldiers.map((soldier) => {
            if (soldier.soldier.id === payload.soldierId) {
                return { ...soldier, rollNum: payload.rollNum };
            }
            return soldier;
        });
        newStates.set(playerName, { soldiers: newSoldiers, submitted: playerState.submitted });
        return { ...prev, states: newStates };
    });
    return error;
};
const handleBattleSubmitted = (newBattleState: BattleState, roads: RoadObj[] | null, settlement: SettlementObj | null) => {
    //perform battle stuff
    let participants = Array.from(newBattleState.states.keys());

    let lineUpComparison = zip(
        newBattleState.states.get(participants[1])?.soldiers || [],
        newBattleState.states.get(participants[0])?.soldiers || []
    );
    lineUpComparison.forEach(([soldierState1, soldierState2]) => {
        let difference = soldierState1.rollNum - soldierState2.rollNum;
        if (difference > 0) {
            if (difference > 2) {
                //dead
                soldierState2.dead = true;
            } else {
                //soldier2 is injured
                soldierState2.soldier.injured = true;
            }
        } else if (difference < 0) {
            if (difference * -1 > 2) {
                //dead
                soldierState1.dead = true;
            } else {
                //soldier2 is injured
                soldierState1.soldier.injured = true;
            }
        } else {
            //check tie breaker
            let winner = null;
            if (settlement) {
                winner = settlement.owner;
            } else if (roads) {
                const roadOwnership = roads.filter((road) => road.owner === participants[1] || road.owner === participants[0]);
                if (roadOwnership.length !== 1) {
                    return;
                }
                winner = roadOwnership[0].owner;
            }

            if (winner === soldierState1.soldier.owner) {
                soldierState2.soldier.injured = true;
            } else {
                soldierState1.soldier.injured = true;
            }
            return;
        }
    });

    return lineUpComparison.flat();
};
export const handleConfirmedLineUp = (
    payload: confirmedLineUpPayload,
    setBattleState: React.Dispatch<React.SetStateAction<BattleState | null>>,
    setSoldiersMap: React.Dispatch<React.SetStateAction<Map<VertexId, SoldierObj[]>>>,
    getSettlementByIntersect: (vertexId: number) => SettlementObj | null,
    getRoadsByIntersect: (vertexId: number) => RoadObj[] | null
): void | string => {
    let error: void | string = undefined;
    setBattleState((prev) => {
        if (prev === null) {
            return null;
        }

        let newBattleState: BattleState = {
            ...prev,
            states: new Map(prev.states), // Make a shallow copy of the 'states' map
        };
        const playerState = newBattleState.states.get(payload.playerName);

        if (playerState === undefined) {
            return prev;
        }
        newBattleState.states.set(payload.playerName, { soldiers: payload.lineUp, submitted: true });
        // check if both players submitted
        if (Array.from(newBattleState.states.values()).every((state) => state.submitted)) {
            //also update soldier map
            //todo
            const settlement = getSettlementByIntersect(newBattleState.vertexId);
            const roads = getRoadsByIntersect(newBattleState.vertexId);
            const soldierUpdates = handleBattleSubmitted(newBattleState, roads, settlement);

            soldierUpdates.forEach((soldierState) => {
                updateSingleSoldier(setSoldiersMap, soldierState.soldier, soldierState.soldier.intersect, soldierState.dead);
            });
        }
        return newBattleState;
    });
    return error;
};

export const handleRollDice = (
    rollNum: string,
    playerMap: Map<string, PlayerObj>,
    setPlayerMap: React.Dispatch<React.SetStateAction<Map<string, PlayerObj>>>,
    hexList: HexNode[],
    intersectList: VertexNode[],
    rollMap: Map<string, number[]>,
    settlements: SettlementObj[]
): void | string => {
    const hexes = rollMap.get(rollNum);

    if (hexes === undefined) {
        return;
    }

    for (let hexId of hexes) {
        let hex = hexList[hexId];
        if (hex === undefined) {
            continue;
        }
        if (hex.robber) {
            continue;
        }
        if (hex.terrain !== 'Desert') {
            let intersects = hex.vertices;
            if (intersects === undefined) {
                continue;
            }

            for (let vertexId of Array.from(intersects)) {
                let intersect = intersectList[vertexId];
                if (intersect === undefined) {
                    continue;
                }

                let settlementId = intersect.settlement;
                if (settlementId !== null) {
                    let settlement = settlements[settlementId];
                    let playerName = settlement.owner;
                    let player = playerMap.get(playerName);
                    if (player === undefined) {
                        continue;
                    }
                    let resources = player.resources;
                    const resource = TerrainResourceMap[hex.terrain];
                    if (resources === undefined || resource === undefined || resource === 'Nothing') {
                        continue;
                    }
                    let price = {
                        Wood: 0,
                        Brick: 0,
                        Sheep: 0,
                        Wheat: 0,
                        Ore: 0,
                    } as Price;

                    price[resource] = settlement.upgraded ? 2 : 1;

                    changePlayerResources(player, price, playerMap, setPlayerMap);
                }
            }
        }
    }
};

////////////////////////////////////////
// Trade Stuff
////////////////////////////////////////

export const handleUpdateTrade = (payload: updateTradePayload, setTradeStates: React.Dispatch<React.SetStateAction<tradeState[]>>) => {
    let replaced = false;
    setTradeStates((prev) =>
        prev.map((tradeState) => {
            if (tradeState.id === payload.tradeState.id) {
                replaced = true;
                return payload.tradeState;
            }
            return tradeState;
        })
    );

    if (!replaced) {
        setTradeStates((prev) => [...prev, payload.tradeState]);
    }

    return;
};

export const handleRespondTrade = (
    payload: respondTradePayload,
    tradeStates: tradeState[],
    setTradeStates: React.Dispatch<React.SetStateAction<tradeState[]>>,
    setPlayerMap: React.Dispatch<React.SetStateAction<Map<string, PlayerObj>>>,
    playerMap: Map<string, PlayerObj>
) => {
    const { tradeId, response, playerName } = payload;
    const tradeState = tradeStates.find((tradeState) => tradeState.id === tradeId);
    if (tradeState === undefined) {
        return;
    }

    //if player who is trader respond no then remove trade
    if (tradeState.trader.name === playerName) {
        if (!response) {
            setTradeStates(tradeStates.filter((tradeState) => tradeState.id !== tradeId));
        }
        return;
    }

    //if player who is tradee respond no then remove trade
    if (tradeState.tradee.name === playerName) {
        if (!response) {
            setTradeStates(tradeStates.filter((tradeState) => tradeState.id !== tradeId));
        } else {
            // handle trade go though
            const traderPrice = priceMath(tradeState.tradee.offer, tradeState.trader.offer, '-');
            const tradeePrice = priceMath(tradeState.trader.offer, tradeState.tradee.offer, '-');
            const trader = playerMap.get(tradeState.trader.name);
            const tradee = playerMap.get(tradeState.tradee.name);

            if (trader === undefined || tradee === undefined) {
                return;
            }
            changePlayerResources(trader, traderPrice, playerMap, setPlayerMap);
            changePlayerResources(tradee, tradeePrice, playerMap, setPlayerMap);
            setTradeStates(tradeStates.filter((tradeState) => tradeState.id !== tradeId));
        }
        return;
    }

    return;
};

export const handleEndTurn = (
    setTurnObj: React.Dispatch<React.SetStateAction<TurnState>>,
    setExhaustedSoldiers: React.Dispatch<React.SetStateAction<string[]>>
) => {
    setTurnObj((prev) => {
        let playerIndex = prev.playerOrder.indexOf(prev.player);
        if (prev === null) {
            return prev;
        }
        if (prev.phase === 'Dice') {
            return { ...prev, phase: 'Trade' };
        }
        if (prev.phase === 'Trade') {
            return { ...prev, phase: 'Build' };
        }
        if (prev.phase === 'Build') {
            if (prev.offset === prev.playerOrder.length - 1) {
                return { ...prev, player: prev.playerOrder[playerIndex - prev.offset], phase: 'Action', offset: 0 };
            } else {
                return { ...prev, player: prev.playerOrder[playerIndex + 1] || prev.playerOrder[0], offset: prev.offset + 1 };
            }
        }
        if (prev.phase === 'Action') {
            if (prev.offset === prev.playerOrder.length - 1) {
                setExhaustedSoldiers([]);
                return { ...prev, phase: 'Dice', offset: 0 };
            } else {
                return { ...prev, player: prev.playerOrder[playerIndex + 1] || prev.playerOrder[0], offset: prev.offset + 1 };
            }
        }

        return {
            ...prev,
        };
    });
    return;
};
