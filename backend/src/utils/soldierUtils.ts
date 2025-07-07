export type SoldierType = 'infantry' | 'cannon';

export interface SoldierObj {
    id: string;
    owner: string;
    injured: boolean;
    intersect: number;
    type: SoldierType;
    stationed: boolean;
}

export interface SoldierBattleState {
    soldier: SoldierObj;
    rollNum: number;
    dead: boolean;
}
export interface BattleState {
    states: Map<string, { soldiers: SoldierBattleState[]; submitted: boolean }>;

    intersectId: number;
}
