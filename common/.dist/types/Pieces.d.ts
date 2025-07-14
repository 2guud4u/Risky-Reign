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
export interface SoldierBattleState {
    soldier: SoldierObj;
    rollNum: number;
    dead: boolean;
}
export interface BattleState {
    states: Map<string, {
        soldiers: SoldierBattleState[];
        submitted: boolean;
    }>;
    intersectId: number;
}
export declare class SettlementImpl implements Settlement {
    owner: string;
    upgraded: boolean;
    constructor(owner: string, upgraded: boolean);
}
export interface Road {
    start: Coords;
    end: Coords;
    owner: string;
}
export declare class RoadImpl implements Road {
    start: Coords;
    end: Coords;
    owner: string;
    constructor(start: Coords, end: Coords, owner: string);
}
export interface Soldier {
    injured: boolean;
    owner: string;
}
export declare class SoldierImpl implements Soldier {
    injured: boolean;
    owner: string;
    constructor(injured: boolean, owner: string);
}
export type DevCardType = "Knight" | "VictoryPoint" | "RoadBuilding" | "YearOfPlenty" | "Monopoly";
export interface DevCard {
    type: DevCardType;
    used: boolean;
}
declare const buildTypes: string[];
export type buildType = typeof buildTypes[number];
export declare const isBuildType: (arg: any) => arg is string;
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
export {};
