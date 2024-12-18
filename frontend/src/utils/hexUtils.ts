
export interface CubeCoord {
  q: number;
  r: number;
  s: number;
}

export interface pixelCoord {
  x: number;
  y: number;
}

export interface HexProps extends CubeCoord {
  terrain: string;
}

export const terrainColors: { [key: string]: string } = {
  forest: "#228B22",
  pasture: "#7CFC00",
  fields: "#FFD700",
  hills: "#CD853F",
  mountains: "#A9A9A9",
  desert: "#F4A460",
};

export function cubeToPixel(cube: CubeCoord, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * cube.q + (Math.sqrt(3) / 2) * cube.r);
  const y = size * ((3 / 2) * cube.r);
  return { x, y };
}

export function pixelToCube(x: number, y: number, size: number): CubeCoord {
  const sqrt3 = Math.sqrt(3);

  // Reverse the x calculation: q = (x / (size * sqrt3) - (sqrt3 / 2) * r / sqrt3)
  const r = (y*size)*(3/2)
  const q = ((x/size)-((sqrt3/2)*r))/sqrt3;
  const s = -(q + r);
  return { q, r, s };
  
}


