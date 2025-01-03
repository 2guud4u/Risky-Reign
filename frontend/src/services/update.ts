import { PlayerObj } from '../utils/playerUtils';
import { Price, ResourceCount } from '../utils/gameUtils';
import { SoldierObj } from '../utils/soldierUtils';
import { IntersectId } from '../utils/intersectUtils';

export const changePlayerResources = (
    player: PlayerObj,
    price: Price,
    playerMap: Map<string, PlayerObj>,
    setPlayerMap: React.Dispatch<React.SetStateAction<Map<string, PlayerObj>>>,
    add: boolean
): boolean => {
    const playerResources = player.resources;
    if (playerResources === undefined) {
        return false;
    }
    const newResources = Object.entries(price).reduce((acc, [resource, amount]) => {
        const key = resource as keyof ResourceCount;
        if (add) {
            acc[key] = playerResources[key] + amount;
        } else {
            acc[key] = playerResources[key] - amount;
        }
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

export const updateSingleSoldier = (
    setSoldiersMap: React.Dispatch<React.SetStateAction<Map<IntersectId, SoldierObj[]>>>,
    soldier: SoldierObj,
    currentIntersect: number,
    remove: boolean
) => {
    setSoldiersMap((prev) => {
        const newMap = new Map(prev);

        let soldiers = newMap.get(currentIntersect as IntersectId);
        if (soldiers) {
            soldiers = soldiers.filter((s) => s.id !== soldier.id);
            console.log(soldier,"removed target soldier",soldiers)
            if (!remove){
                soldiers.push(soldier);
            }
            newMap.set(currentIntersect as IntersectId, soldiers);
            
        }

        return newMap;
    });
};
