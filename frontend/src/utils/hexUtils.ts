import { CubeCoord } from "./helperUtils";
import { shuffleArray, flattenAndFillObject } from "./helperUtils";
export type Resource = "Wheat" | "Sheep" | "Ore" | "Desert" | "Brick" | "Wood";
const boardRadius = 2;

let numTokens: { [key in number]: number } = {
  2: 1,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
  8: 2,
  9: 2,
  10: 2,
  11: 2,
  12: 1
};

let resources: { [key in Resource]: number } = {
  "Wheat": 4,
  "Sheep": 4,
  "Ore": 3,
  "Desert": 1,
  "Brick": 3,
  "Wood": 4
};
export interface HexProps {
  terrain: Resource;
  robber: boolean;
  rollNumber: number | null;

}

export interface HexNode {
  id: number;
  coord: CubeCoord;
  intersections: Set<number>;
  terrain: Resource;
  robber: boolean;
  rollNumber: number | null;
}
export function getRollMap(hexes: HexNode[]): Map<string, number[]> {
  let rollMap = new Map();
  hexes.forEach((hex) => {
    if (hex.rollNumber !== null) {
      if (rollMap.has(hex.rollNumber)) {
        (rollMap.get(hex.rollNumber) as number[]).push(hex.id);
      } else {
        rollMap.set(hex.rollNumber, [hex.id]);
      }
    }
  });
  console.log(rollMap);
  return rollMap;
}

export const terrainColors: { [key: string]: string } = {
  Wood: "#228B22",
  Sheep: "#7CFC00",
  Wheat: "#FFD700",
  Brick: "#CD853F",
  Ore: "#A9A9A9",
  Desert: "#F4A460",
};

export const generateHexes = (boardRadius: number): HexNode[] => {
  const hexes: HexNode[] = [];
  let ResourceList = shuffleArray(flattenAndFillObject(resources));
  let tokenList = shuffleArray(flattenAndFillObject(numTokens));
  let id = 0;
  for (let q = -boardRadius; q <= boardRadius; q++) {
    for (let r = Math.max(-boardRadius, -q - boardRadius); r <= Math.min(boardRadius, -q + boardRadius); r++) {
      const s = -q - r;
      const terrain = ResourceList.pop() as Resource;
      if (terrain === "Desert") {
        hexes.push({ id:id, intersections: new Set(), coord: {q, r, s}, terrain: terrain, robber: true, rollNumber: null });
        
      } else {
        const token = tokenList.pop() as number;
        hexes.push({ id:id, intersections: new Set(), coord: {q, r, s}, terrain: terrain, robber: false, rollNumber: token });
      }
      id += 1;
    }
  }

  return hexes;
};





