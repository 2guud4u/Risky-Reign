import { PlayerObj } from '../utils/playerUtils';
import { Price, ResourceCount } from '../utils/gameUtils';

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
