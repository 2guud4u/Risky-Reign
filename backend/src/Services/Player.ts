import Player from "../types/Player";

export function createPlayer(name: string, color: string): Player {
    return {
        name,
        color,
        resources: new Map(),
        devCards: []
    };
}
