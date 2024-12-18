import { cubeToPixel, PixelCoord } from './helperUtils';
import { IntersectionProps } from '../components/Intersection';

export interface Intersect extends PixelCoord {
    key: number;


}
export function calculateHexagonVertices(q: number, r:number, s:number, size:number): PixelCoord[] {
    const intersects:PixelCoord[] = [];
    const { x, y } = cubeToPixel({ q, r, s }, size);
  
    const hexPoints = [
      [0, -1], [Math.sqrt(3)/2, -0.5], [Math.sqrt(3)/2, 0.5],
      [0, 1], [-Math.sqrt(3)/2, 0.5], [-Math.sqrt(3)/2, -0.5]
    ]
      .map(([px, py]) => [px * size + x, py * size + y])
  
    
    hexPoints.forEach(([px, py]) => {
      intersects.push({x: px, y: py})
    });
  
  
    return intersects;
  }

export function getIntersectByIndex(key: number, intersects: Intersect[]): Intersect {
    return intersects[key];
}