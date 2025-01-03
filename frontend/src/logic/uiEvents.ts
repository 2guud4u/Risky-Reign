import { Price, SettlementPrice, ResourceCount, RoadPrice, SoldierPrice } from '../utils/gameUtils';
import {
    buildRoadPayload,
    buildSettlementPayload,
    buildSoldierPayload,
    moveSoldierPayload,
    initiateBattlePayload,
    rolledSoldierScorePayload,
    confirmedLineUpPayload,
} from '../utils/eventsUtils';
import { PlayerObj } from '../utils/playerUtils';
import { IntersectNode, IntersectId } from '../utils/intersectUtils';
import { SettlementObj } from '../utils/settlementUtils';
import { RoadObj } from '../utils/roadUtils';
import { SoldierObj, SoldierType, BattleState } from '../utils/soldierUtils';
import { v4 as uuidv4 } from 'uuid';
import Settlement from '../components/Settlement';
import { TerrainResourceMap, HexNode } from '../utils/hexUtils';
import { changePlayerResources, updateSingleSoldier } from '../services/update';
import Road from '../components/Road';
import { groupBy, zip } from '../utils/helperUtils';

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
    intersectMap: Map<number, IntersectNode>,
    setSettlements: React.Dispatch<React.SetStateAction<SettlementObj[]>>,
    setIntersectMap: React.Dispatch<React.SetStateAction<Map<number, IntersectNode>>>,
    settlements: SettlementObj[]
): void | string => {
    //check if has enough resources
    if (!checkHasPrice(player, SettlementPrice)) {
        return 'Not enough resources';
    }

    const intersect = intersectMap.get(payload.intersectId);
    if (intersect === undefined) {
        return 'Invalid intersection';
    }
    //check if building here is valid
    if (intersect.settlement !== null) {
        return 'Cannot build here, building already exists';
    }

    if (intersect.intersections.size === 0) {
        return;
    }
    const intersectNeighbors = Array.from(intersect.intersections).map((id) => intersectMap.get(id));
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
            intersectMap.set(payload.intersectId, {
                ...intersect,
                settlement: settlementId,
            })
        )
    );
};

const checkRoadValid = (
    intersect1: IntersectNode,
    intersect2: IntersectNode,
    owner: string,
    roads: RoadObj[],
    settlements: SettlementObj[]
): boolean => {
    //check if not two far away
    if (!intersect1.intersections.has(intersect2.id)) {
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
    setIntersectMap: React.Dispatch<React.SetStateAction<Map<number, IntersectNode>>>,
    intersectMap: Map<number, IntersectNode>,
    player: PlayerObj,
    roads: RoadObj[],
    setRoads: React.Dispatch<React.SetStateAction<RoadObj[]>>,
    settlements: SettlementObj[]
): void | string => {
    if (!checkHasPrice(player, RoadPrice)) {
        return 'Not enough resources';
    }
    const intersect1 = intersectMap.get(payload.startIntersectId);
    const intersect2 = intersectMap.get(payload.endIntersectId);
    if (intersect1 === undefined || intersect2 === undefined) {
        return 'Invalid intersection';
    }
    //check if building here is valid
    if (roads.some((road) => road.intersect1 === payload.startIntersectId && road.intersect2 === payload.endIntersectId)) {
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
            intersect1: payload.startIntersectId,
            intersect2: payload.endIntersectId,
            owner: player.name,
            coord1: intersect1.coord,
            coord2: intersect2.coord,
            upgraded: false,
        },
    ]);
    let newIntersectMap = intersectMap.set(payload.startIntersectId, {
        ...intersect1,
        roads: intersect1.roads.add(roadId),
    });
    newIntersectMap = newIntersectMap.set(payload.endIntersectId, {
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
    intersectMap: Map<number, IntersectNode>
): void | string => {
    if (!checkHasPrice(player, SoldierPrice)) {
        return 'Not enough resources';
    }
    const intersect = intersectMap.get(payload.intersectId);
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
        intersect: payload.intersectId,
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
    if (payload.startIntersectId === payload.endIntersectId) {
        return 'Soldier is moving to the same location';
    }
    //check if road exists
    if (
        roads.find(
            (road) =>
                (road.intersect1 === payload.startIntersectId && road.intersect2 === payload.endIntersectId) ||
                (road.intersect1 === payload.endIntersectId && road.intersect2 === payload.startIntersectId)
        ) === undefined
    ) {
        return 'Cannot move soldier, no road';
    }
    const soldiers = soldiersMap.get(payload.startIntersectId);
    if (soldiers === undefined) {
        return 'No soldiers to move';
    }

    const movingSoldiers = soldiers.filter((soldier) => payload.soldierIds.includes(soldier.id));

    if (movingSoldiers === undefined) {
        return 'No soldiers to move';
    }
    if (player.name !== movingSoldiers[0].owner) {
        return 'Cannot move soldier, not your soldier';
    }

    setSoldiersMap(
        new Map(
            soldiersMap.set(
                payload.startIntersectId,
                soldiers.filter((s) => !payload.soldierIds.includes(s.id))
            )
        )
    );

    setSoldiersMap(new Map(soldiersMap.set(payload.endIntersectId, [...(soldiersMap.get(payload.endIntersectId) ?? []), ...movingSoldiers])));
};
export const handleInitiateBattle = (
    payload: initiateBattlePayload,
    friendlyName: string,
    setBattleState: React.Dispatch<React.SetStateAction<BattleState | null>>,
    soldiersMap: Map<IntersectId, SoldierObj[]>
): void | string => {
    const { intersectId, friendlyIds, enemyIds, enemyName } = payload;
    const soldiers = soldiersMap.get(intersectId);
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
    setBattleState({ states, intersectId });
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
    setSoldiersMap: React.Dispatch<React.SetStateAction<Map<IntersectId, SoldierObj[]>>>,
    getSettlementByIntersect: (intersectId: number) => SettlementObj | null,
    getRoadsByIntersect: (intersectId: number) => RoadObj[] | null
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
            const settlement = getSettlementByIntersect(newBattleState.intersectId);
            const roads = getRoadsByIntersect(newBattleState.intersectId);
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
    hexMap: Map<number, HexNode>,
    intersectMap: Map<number, IntersectNode>,
    rollMap: Map<string, number[]>,
    settlements: SettlementObj[]
): void | string => {
    const hexes = rollMap.get(rollNum);

    if (hexes === undefined) {
        return;
    }

    for (let hexId of hexes) {
        let hex = hexMap.get(hexId);
        if (hex === undefined) {
            continue;
        }
        if (hex.robber) {
            continue;
        }
        if (hex.terrain !== 'Desert') {
            let intersects = hex.intersections;
            if (intersects === undefined) {
                continue;
            }

            for (let intersectId of Array.from(intersects)) {
                let intersect = intersectMap.get(intersectId);
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

                    changePlayerResources(player, price, playerMap, setPlayerMap, true);
                }
            }
        }
    }
};
