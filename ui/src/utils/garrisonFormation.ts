import { Board, SoldierObj, VertexNode } from 'common';
import {
  FORMATION_ARMY_GAP,
  FORMATION_COL_SPACING,
  FORMATION_COLS,
  FORMATION_LINE_GAP,
  FORMATION_LINE_MAX_WIDTH,
  FORMATION_MAX_VISIBLE,
  FORMATION_PILL_CHAR_W,
  FORMATION_PILL_GAP,
  FORMATION_PILL_H,
  FORMATION_PILL_PAD,
  FORMATION_ROW_SPACING,
  TROOP_ART,
} from '../constants';
import { groupSoldiersByOwner } from './soldierPlacement';

/** Which sprite a troop draws with (all sized so the people match). */
export type TroopArtKind = keyof typeof TROOP_ART;

export function troopArtKind(s: SoldierObj): TroopArtKind {
  if (s.type === 'cannon') return s.stationed ? 'cannonStationed' : 'cannonUnstationed';
  return s.injured ? 'injured' : 'soldier';
}

/** One drawn troop: its sprite box center and size, in world coordinates. */
export interface FormationSoldier {
  soldier: SoldierObj;
  art: TroopArtKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One owner's garrison as a formation of ranks: cannons lead the front ranks,
 * then healthy infantry, injured at the back. A rank holds FORMATION_COLS
 * slots (a cannon takes 2), so cannons share rows with soldiers. Every troop
 * in a rank stands on that rank's ground line, so mixed sprite heights still
 * line up at the feet. The formation's bounding box, not an approximate
 * radius, keeps armies from spilling past their vertex.
 */
export interface GarrisonArmy {
  ownerName: string;
  /** All the owner's soldiers on the vertex (the pill counts the whole army). */
  group: SoldierObj[];
  /** Visible troops, back rank first so the front rank draws on top. */
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

interface Rank {
  troops: SoldierObj[];
  /** Each troop's center offset from the rank's center (mixed sprite widths). */
  offsets: number[];
  /** Rank width: troop centers' span plus half the end sprites. */
  width: number;
  /** Tallest sprite in the rank. */
  height: number;
}

/** Slots a troop occupies in a rank: a cannon takes two, anything else one. */
const slotCost = (s: SoldierObj): number => (s.type === 'cannon' ? 2 : 1);

/** Center-to-center step between slots in a rank — the same tight pitch. */
const SLOT_SPACING = FORMATION_COL_SPACING;

/**
 * Split one army's visible troops into ranks, front rank first: cannons lead,
 * then healthy infantry, then injured. A rank holds FORMATION_COLS slots —
 * 4 slots, with each cannon taking 2 — so a cannon shares a row with two
 * soldiers. Every troop sits centered on its slot(s) at the tight pitch.
 */
function armyRanks(group: SoldierObj[]): Rank[] {
  const ordered = [
    ...group.filter((s) => s.type === 'cannon'),
    ...group.filter((s) => s.type !== 'cannon' && !s.injured),
    ...group.filter((s) => s.type !== 'cannon' && s.injured),
  ].slice(0, FORMATION_MAX_VISIBLE);
  const ranks: Rank[] = [];
  let troops: SoldierObj[] = [];
  let slots = 0;
  const flush = () => {
    if (!troops.length) return;
    // Slot grid: each troop centers on its slot(s); cannons take the center
    // of their 2-slot span. Same SLOT_SPACING pitch as before — tight rows.
    const slotCenters: number[] = [];
    let cursor = 0;
    for (const s of troops) {
      const cost = slotCost(s);
      slotCenters.push(cursor + (cost - 1) / 2);
      cursor += cost;
    }
    const span = cursor - 1;
    const arts = troops.map((s) => TROOP_ART[troopArtKind(s)]);
    ranks.push({
      troops,
      offsets: slotCenters.map((c) => (c - span / 2) * SLOT_SPACING),
      width: span * SLOT_SPACING + Math.max(...arts.map((a) => a.w)),
      height: Math.max(...arts.map((a) => a.h)),
    });
    troops = [];
    slots = 0;
  };
  for (const s of ordered) {
    const cost = slotCost(s);
    if (slots + cost > FORMATION_COLS) flush();
    troops.push(s);
    slots += cost;
  }
  flush();
  return ranks;
}

/**
 * Height from the formation's top to the front rank's feet. Rank r (0 =
 * front) stands r * FORMATION_ROW_SPACING above the front line; the block
 * reaches up to whichever rank's sprite top is highest.
 */
function ranksHeight(ranks: Rank[]): number {
  return Math.max(...ranks.map((r, i) => i * FORMATION_ROW_SPACING + r.height));
}

/**
 * Compute each owner's garrison formation, packed into lines of armies around
 * the vertex: the first two armies share one line (the vertex sits between
 * them); later armies wrap at the line width cap. The whole stack of lines is
 * centered on the vertex, so its midpoint stays at the vertex for any number
 * of lines (10+ groups included).
 */
export function layoutGarrisonArmies(board: Board, vertex: VertexNode): GarrisonArmy[] {
  const soldiersAt = Object.values(board.soldiers ?? {}).filter(
    (s) => s.vertexId === vertex.id && s.aboardShipId === null
  );
  const byOwner = groupSoldiersByOwner(soldiersAt);
  // Biggest armies first, so they get the left-most spot of each line.
  const owners = Array.from(byOwner.entries()).sort((a, b) => b[1].length - a[1].length);
  if (owners.length === 0) return [];

  const { x: vx, y: vy } = vertex.position;

  // Pack armies into lines of at most FORMATION_LINE_MAX_WIDTH width.
  type LineArmy = { ownerName: string; group: SoldierObj[]; ranks: Rank[]; width: number };
  const lines: LineArmy[][] = [[]];
  for (const [ownerName, group] of owners) {
    const ranks = armyRanks(group);
    const width = Math.max(...ranks.map((r) => r.width));
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
    lines[lines.length - 1].push({ ownerName, group, ranks, width });
  }

  // A line's vertical block: its tallest formation plus its count pill.
  const lineFormationH = (line: LineArmy[]) => Math.max(...line.map((a) => ranksHeight(a.ranks)));
  const blocks = lines.map((line) => lineFormationH(line) + FORMATION_PILL_GAP + FORMATION_PILL_H);
  // Center the whole stack of lines on the vertex: each line's block sits
  // below the one above it with FORMATION_LINE_GAP, so the vertex stays at
  // the middle of the armies for any number of lines.
  const stackHeight =
    blocks.reduce((s, h) => s + h, 0) + (blocks.length - 1) * FORMATION_LINE_GAP;

  let cursor = vy - stackHeight / 2;
  return lines.flatMap((line, lineIdx) => {
    // This line's front rank feet: the block's top plus its formation height.
    const lineY = cursor + lineFormationH(line);
    cursor += blocks[lineIdx] + FORMATION_LINE_GAP;
    // Center the span of the army centers on the vertex, not the bounding
    // box: with unequal group widths the box is not symmetric, which leaves
    // the centers off the vertex. span = half of the end widths + every full
    // width in between + a gap between adjacent armies.
    const totalW = line.reduce((w, a) => w + a.width, 0);
    const span =
      totalW - (line[0].width + line[line.length - 1].width) / 2 +
      Math.max(0, line.length - 1) * FORMATION_ARMY_GAP;
    let cx = vx - span / 2;
    return line.map((army, i) => {
      cx += i === 0 ? 0 : line[i - 1].width / 2 + FORMATION_ARMY_GAP + army.width / 2;
      // Back rank first in the array, so the front (bottom) rank draws on top.
      const soldiers = army.ranks
        .map((rank, r) => {
          const feetY = lineY - r * FORMATION_ROW_SPACING;
          return rank.troops.map((s, col): FormationSoldier => {
            const art = troopArtKind(s);
            const { w, h } = TROOP_ART[art];
            return {
              soldier: s,
              art,
              x: cx + rank.offsets[col],
              y: feetY - h / 2,
              w,
              h,
            };
          });
        })
        .reverse()
        .flat();
      return {
        ownerName: army.ownerName,
        group: army.group,
        soldiers,
        flip: cx < vx,
        bounds: {
          minX: Math.min(...soldiers.map((s) => s.x - s.w / 2)),
          maxX: Math.max(...soldiers.map((s) => s.x + s.w / 2)),
          minY: Math.min(...soldiers.map((s) => s.y - s.h / 2)),
          maxY: Math.max(...soldiers.map((s) => s.y + s.h / 2)),
        },
        pillCenterX: cx,
        pillY: lineY + FORMATION_PILL_GAP,
        pillWidth: String(army.group.length).length * FORMATION_PILL_CHAR_W + 2 * FORMATION_PILL_PAD,
      };
    });
  });
}
