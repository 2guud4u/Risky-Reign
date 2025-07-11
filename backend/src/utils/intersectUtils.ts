import { cubeToPixel, PixelCoord, calcEuclideanDistance } from './helperUtils';
import { HexNode } from './hexUtils';
import { SoldierObj } from './soldierUtils';

export interface Intersect extends PixelCoord {}
export type IntersectId = number;

export interface IntersectNode {
    coord: PixelCoord;
    intersections: Set<number>;
    id: number;
    settlement: number | null;
    soldiers: SoldierObj[];
    roads: Set<number>;
}

export const generateIntersections = (hexes: HexNode[], size: number): IntersectNode[] => {
    const intersects: IntersectNode[] = [];
    let id = 0;
    hexes.forEach((hex, index) => {
        const { q, r, s } = hex.coord;
        const hexagonVertices = calculateHexagonVertices(q, r, s, size);
        hexagonVertices.forEach((vertex) => {
            let intersect = intersects.find(({ coord }) => calcEuclideanDistance(vertex, coord) < 1);
            if (!intersect) {
                intersect = {
                    id: id,
                    coord: vertex,
                    intersections: new Set(),
                    settlement: null,
                    soldiers: [],
                    roads: new Set(),
                };
                id++;
            }
            hex.intersections.add(intersect.id);
            intersects.push(intersect);
        });
        //add intersections to hex
    });
    return intersects;
};

export function connectIntersections(intersections: IntersectNode[], hexSize: number): IntersectNode[] {
    let connectedIntersections: IntersectNode[] = [];
    intersections.forEach((intersect) => {
        const { coord } = intersect;
        intersections.forEach((otherIntersect) => {
            if (intersect.id !== otherIntersect.id && calcEuclideanDistance(coord, otherIntersect.coord) < hexSize * 1.1) {
                intersect.intersections.add(otherIntersect.id);
            }
        });
        connectedIntersections.push(intersect);
    });
    return connectedIntersections;
}

export function calculateHexagonVertices(q: number, r: number, s: number, size: number): PixelCoord[] {
    const intersects: PixelCoord[] = [];
    const { x, y } = cubeToPixel({ q, r, s }, size);

    const hexPoints = [
        [0, -1],
        [Math.sqrt(3) / 2, -0.5],
        [Math.sqrt(3) / 2, 0.5],
        [0, 1],
        [-Math.sqrt(3) / 2, 0.5],
        [-Math.sqrt(3) / 2, -0.5],
    ].map(([px, py]) => [px * size + x, py * size + y]);

    hexPoints.forEach(([px, py]) => {
        intersects.push({ x: px, y: py });
    });

    return intersects;
}

export function getIntersectByIndex(key: number, intersects: Intersect[]): Intersect {
    return intersects[key];
}
