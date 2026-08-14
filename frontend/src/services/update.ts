import { PlayerObj } from '../utils/playerUtils';
import { Price, ResourceCount } from '../utils/gameUtils';
import { SoldierObj } from '../utils/soldierUtils';
import { VertexId } from '../utils/intersectUtils';

export const changePlayerResources = (
    player: PlayerObj,
    price: Price,
    playerMap: Map<string, PlayerObj>,
    setPlayerMap: React.Dispatch<React.SetStateAction<Map<string, PlayerObj>>>
): boolean => {
    const playerResources = player.resources;
    if (playerResources === undefined) {
        return false;
    }
    const newResources = Object.entries(price).reduce((acc, [resource, amount]) => {
        const key = resource as keyof ResourceCount;

        acc[key] = playerResources[key] + amount;

        return acc;
    }, {} as ResourceCount);
    setPlayerMap(
        new Map(
            playerMap.set(player.name, {
                ...player,
                resources: newResources,
            })
        )
    );

    return true;
};

export const priceMath = (price1: Price, price2: Price, operator: '-' | '+'): Price => {
    return Object.entries(price1).reduce((acc, [resource, amount]) => {
        const key = resource as keyof ResourceCount;
        if (operator === '-') acc[key] = amount - price2[key];
        else acc[key] = amount + price2[key];
        return acc;
    }, {} as ResourceCount);
};

export const updateSingleSoldier = (
    setSoldiersMap: React.Dispatch<React.SetStateAction<Map<VertexId, SoldierObj[]>>>,
    soldier: SoldierObj,
    currentIntersect: number,
    remove: boolean
) => {
    setSoldiersMap((prev) => {
        const newMap = new Map(prev);

        let soldiers = newMap.get(currentIntersect as VertexId);
        if (soldiers) {
            soldiers = soldiers.filter((s) => s.id !== soldier.id);
            console.log(soldier, 'removed target soldier', soldiers);
            if (!remove) {
                soldiers.push(soldier);
            }
            newMap.set(currentIntersect as VertexId, soldiers);
        }

        return newMap;
    });
};

//edit roll
// edit hexMap
// edit intersectMap
// edit playerMap
// edit road
//edit settlement
// edit battleState
// edit exhaust
// edit turnObj
//edit trade state
// edit player map