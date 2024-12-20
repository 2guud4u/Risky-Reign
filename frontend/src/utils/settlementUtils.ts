import { PixelCoord } from "./helperUtils";

export interface SettlementObj{
    id: number;
    owner: string;
    upgraded: boolean;
    coord: PixelCoord

}