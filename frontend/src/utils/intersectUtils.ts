import { cubeToPixel, pixelCoord } from './hexUtils';
export interface IntersectionProps {
    x: number;
    y: number;
    size: number;
    onDrop: (x: number, y: number) => void;
    
  }

export function calculateHexagonVertices(q: number, r:number, s:number, size:number): pixelCoord[] {
    const intersects:pixelCoord[] = [];
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