

export type SoldierType = "infantry" | "cannon";

export interface SoldierObj{
    owner: string;
    injured: boolean;
    intersect: number;
    type: SoldierType;
    stationed: boolean;
}