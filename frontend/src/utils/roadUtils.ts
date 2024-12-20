import { PixelCoord } from "./helperUtils";

export interface RoadObj {
    id: number;
    intersect1: number;
    intersect2: number;
    owner: string;
    coord1: PixelCoord;
    coord2: PixelCoord;
    upgraded: boolean;


}