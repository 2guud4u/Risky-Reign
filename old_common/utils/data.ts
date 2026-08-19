import { CubeCoord, PixelCoord } from '../types/Board';
export function cubeToPixel(cube: CubeCoord, size: number): { x: number; y: number } {
    const x = size * (Math.sqrt(3) * cube.q + (Math.sqrt(3) / 2) * cube.r);
    const y = size * ((3 / 2) * cube.r);
    return { x, y };
}
export function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        // Pick a random index from 0 to i
        const j = Math.floor(Math.random() * (i + 1));

        // Swap elements at indices i and j
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function flattenAndFillObject<T extends string | number | symbol>(target: { [key in T]: number }): T[] {
    return Object.entries(target).flatMap(([key, count]) => Array(count).fill(key) as T[]);
}

export function pixelToCube(x: number, y: number, size: number): CubeCoord {
    const sqrt3 = Math.sqrt(3);

    // Reverse the x calculation: q = (x / (size * sqrt3) - (sqrt3 / 2) * r / sqrt3)
    const r = y * size * (3 / 2);
    const q = (x / size - (sqrt3 / 2) * r) / sqrt3;
    const s = -(q + r);
    return { q, r, s };
}

export function calcEuclideanDistance(a: PixelCoord, b: PixelCoord): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}


export function groupBy<T, K extends keyof T>(array: T[], key: K): Record<string, T[]> {
    return array.reduce(
        (acc, item) => {
            const groupKey = item[key] as unknown as string; // The key by which to group
            if (!acc[groupKey]) {
                acc[groupKey] = [];
            }
            acc[groupKey].push(item);
            return acc;
        },
        {} as Record<string, T[]>
    ); // Initialize accumulator as an empty object
}

export function zip<T>(...arrays: T[][]): T[][] {
    // Get the shortest array length
    const length = Math.min(...arrays.map((arr) => arr.length));
    const result: T[][] = [];

    // Iterate over the arrays and create the zipped result
    for (let i = 0; i < length; i++) {
        const zippedItem = arrays.map((arr) => arr[i]);
        result.push(zippedItem);
    }

    return result;
}
