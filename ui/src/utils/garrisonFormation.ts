import { Board, SoldierObj, VertexNode } from 'common';
import {
  FORMATION_ARMY_GAP,
  FORMATION_COL_SPACING,
  FORMATION_COLS,
  FORMATION_FEET_OFFSET,
  FORMATION_LINE_MAX_WIDTH,
  FORMATION_LINE_SPACING,
  FORMATION_MAX_VISIBLE,
  FORMATION_PILL_CHAR_W,
  FORMATION_PILL_GAP,
  FORMATION_PILL_PAD,
  FORMATION_ROW_SPACING,
  INJURED_SOLDIER_SCALE,
  SOLDIER_ART_HEIGHT,
  SOLDIER_ART_WIDTH,
} from '../constants';
import { groupSoldiersByOwner } from './soldierPlacement';

/** One drawn soldier: its sprite center and scale, in world coordinates. */
export interface FormationSoldier {
  soldier: SoldierObj;
  x: number;
  y: number;
  scale: number;
}

/**
 * One owner's garrison as a formation of ranks: healthy soldiers in front,
 * injured behind. Every owner's troops fit in a bounded formation — the
 * formation's bounding box, not an approximate radius, keeps armies from
 * spilling past their vertex.
 */
export interface GarrisonArmy {
  ownerName: string;
  /** All the owner's soldiers on the vertex (the pill counts the whole army). */
  group: SoldierObj[];
  /** Visible soldiers, back rank first so the front rank draws on top. */
  soldiers: FormationSoldier[];
  /** Whether the sprites are mirrored (armies face each other across the vertex). */
  flip: boolean;
  /** Formation bounding box (world coordinates). */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  /** Count pill: center x, top y and width (sits under the front rank). */
  pillCenterX: number;
  pillY: number;
  pillWidth: number;
}

/**
 * Compute each owner's garrison formation, packed into lines of armies below
 * the vertex: armies sit side by side (facing each other across the vertex),
 * wrapping to a new line when a line would get too wide. A single owner's
 * formation is centered under the vertex.
 */
export function layoutGarrisonArmies(board: Board, vertex: VertexNode): GarrisonArmy[] {
  const soldiersAt = Object.values(board.soldiers ?? {}).filter((s) => s.vertexId === vertex.id);
  const byOwner = groupSoldiersByOwner(soldiersAt);
  // Biggest armies first, so they get the left-most spot of each line.
  const owners = Array.from(byOwner.entries()).sort((a, b) => b[1].length - a[1].length);
  if (owners.length === 0) return [];

  const { x: vx, y: vy } = vertex.position;

  // A formation's width from its visible troop count.
  const formationWidth = (count: number) => {
    const cols = Math.min(FORMATION_COLS, count);
    return (cols - 1) * FORMATION_COL_SPACING + SOLDIER_ART_WIDTH;
  };

  // Pack armies into lines of at most FORMATION_LINE_MAX_WIDTH width.
  const lines: { ownerName: string; group: SoldierObj[]; width: number }[][] = [[]];
  for (const [ownerName, group] of owners) {
    const width = formationWidth(Math.min(group.length, FORMATION_MAX_VISIBLE));
    // Width of the line if this army joins it: the existing armies' widths +
    // a gap between each pair already on the line (N - 1 for N armies) + the
    // gap that would precede the new army (1 more when the line is not empty).
    const lastLine = lines[lines.length - 1];
    const lineWidth =
      lastLine.reduce((w, a) => w + a.width, 0) +
      lastLine.length * FORMATION_ARMY_GAP;
    const overWide = lastLine.length > 0 && lineWidth + width > FORMATION_LINE_MAX_WIDTH;
    // The front line always holds its first two armies, even when together
    // they exceed the width cap: the two garrisons share one ground row and
    // the vertex sits between them. Wrapping (at the cap) starts with the
    // third army on the front line and on every later line.
    const frontSlotOpen = lines.length === 1 && lastLine.length < 2;
    if (!frontSlotOpen && overWide) {
      lines.push([]);
    }
    lines[lines.length - 1].push({ ownerName, group, width });
  }

  // Place each line centered on the vertex.
  return lines.flatMap((line, lineIdx) => {
    // Center the span of the army centers on the vertex, not the bounding
    // box: with unequal group widths the box is not symmetric, which leaves
    // the centers off the vertex. span = half of the end widths + every full
    // width in between + a gap between adjacent armies.
    const totalW = line.reduce((w, a) => w + a.width, 0);
    const span =
      totalW - (line[0].width + line[line.length - 1].width) / 2 +
      Math.max(0, line.length - 1) * FORMATION_ARMY_GAP;
    const lineY = vy + FORMATION_FEET_OFFSET + lineIdx * FORMATION_LINE_SPACING;
    const firstCx = vx - span / 2;
    let cx = firstCx;
    return line.map((army, i) => {
      cx += i === 0 ? 0 : line[i - 1].width / 2 + FORMATION_ARMY_GAP + army.width / 2;
      const visible = [
        ...army.group.filter((s) => !s.injured),
        ...army.group.filter((s) => s.injured),
      ].slice(0, FORMATION_MAX_VISIBLE);
      const rows = Math.ceil(visible.length / FORMATION_COLS);
      const soldiers = visible.map((s, idx) => {
        const row = Math.floor(idx / FORMATION_COLS);
        const col = idx % FORMATION_COLS;
        const rowLen = Math.min(FORMATION_COLS, visible.length - row * FORMATION_COLS);
        const scale = s.injured ? INJURED_SOLDIER_SCALE : 1;
        const h = SOLDIER_ART_HEIGHT * scale;
        return {
          soldier: s,
          x: cx + (col - (rowLen - 1) / 2) * FORMATION_COL_SPACING,
          y: lineY - (rows - 1 - row) * FORMATION_ROW_SPACING - h / 2,
          scale,
        };
      });
      const xs = soldiers.map((s) => s.x);
      const ys = soldiers.map((s) => s.y);
      return {
        ownerName: army.ownerName,
        group: army.group,
        soldiers, // back rank first in the array, so the front (bottom) rank draws on top
        flip: cx < vx,
        bounds: {
          minX: Math.min(...xs) - SOLDIER_ART_WIDTH / 2,
          maxX: Math.max(...xs) + SOLDIER_ART_WIDTH / 2,
          minY: Math.min(...ys) - SOLDIER_ART_HEIGHT / 2,
          maxY: Math.max(...ys) + SOLDIER_ART_HEIGHT / 2,
        },
        pillCenterX: cx,
        pillY: lineY + FORMATION_PILL_GAP,
        pillWidth: String(army.group.length).length * FORMATION_PILL_CHAR_W + 2 * FORMATION_PILL_PAD,
      };
  });
  });
}
