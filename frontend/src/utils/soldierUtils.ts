

export type SoldierType = "infantry" | "cannon";

export interface SoldierObj{
    id: number;
    owner: string;
    injured: boolean;
    intersect: number;
    type: SoldierType;
    stationed: boolean;
}