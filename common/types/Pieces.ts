import { Coords } from "./Board";

export interface Settlement {
    owner: string;
    upgraded: boolean;
}
export type SoldierType = 'infantry' | 'cannon';

export interface SoldierObj {
    id: string;
    owner: string;
    injured: boolean;
    intersect: number;
    type: SoldierType;
    stationed: boolean;
}


export class SettlementImpl implements Settlement {
    owner: string;
    upgraded: boolean;
    constructor(owner: string, upgraded: boolean) {
        this.owner = owner;
        this.upgraded = upgraded;
    }
}

export interface Road {
    start: Coords;
    end: Coords;
    owner: string;
}

export class RoadImpl implements Road {
    start: Coords;
    end: Coords;
    owner: string;
    constructor(start: Coords, end: Coords, owner: string) {
        this.start = start;
        this.end = end;
        this.owner = owner;
    }

}

export interface Soldier{
    injured: boolean;
    owner: string;
}

export class SoldierImpl implements Soldier {
    injured: boolean;
    owner: string;
    constructor(injured: boolean, owner: string) {
        this.owner = owner
        this.injured = injured;
    }
}


export type DevCardType = "Knight" | "VictoryPoint" | "RoadBuilding" | "YearOfPlenty" | "Monopoly";

export interface DevCard {
    type: DevCardType;
    used: boolean;
}

const buildTypes = ["Settlement", "Road", "City", "Soldier"];

export type buildType = typeof buildTypes[number];

export const isBuildType = (arg: any): arg is buildType => {
    return buildTypes.includes(arg);
}


import { PixelCoord } from './Board';

export interface RoadObj {
    id: number;
    intersect1: number;
    intersect2: number;
    owner: string;
    coord1: PixelCoord;
    coord2: PixelCoord;
    upgraded: boolean;
}

export interface SettlementObj {
    id: number;
    owner: string;
    upgraded: boolean;
    coord: PixelCoord;
}