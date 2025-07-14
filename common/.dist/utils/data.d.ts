import { CubeCoord, PixelCoord } from '../types/Board';
export declare function cubeToPixel(cube: CubeCoord, size: number): {
    x: number;
    y: number;
};
export declare function shuffleArray<T>(array: T[]): T[];
export declare function flattenAndFillObject<T extends string | number | symbol>(target: {
    [key in T]: number;
}): T[];
export declare function pixelToCube(x: number, y: number, size: number): CubeCoord;
export declare function calcEuclideanDistance(a: PixelCoord, b: PixelCoord): number;
export declare function groupBy<T, K extends keyof T>(array: T[], key: K): Record<string, T[]>;
export declare function zip<T>(...arrays: T[][]): T[][];
