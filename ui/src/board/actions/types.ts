import {
  Board,
  BuildCheck,
  EdgeNode,
  GameRoom,
  Player,
  PublicGameRoom,
  PublicPlayer,
  ResourceKey,
  ShipObj,
  VertexNode,
} from 'common';
import { SelectableObject } from '../../types';

export const ALLOWED: BuildCheck = { allowed: true, reason: null };
export const NO_TURN: BuildCheck = { allowed: false, reason: 'No active turn' };

/**
 * Everything a bubble's `run` may need: the room-bound socket emits plus the
 * soldier pick setter. Injected so the catalog itself stays render-pure.
 */
export interface BoardActionEmit {
  buildSettlement: (vertexId: string, asCity?: boolean) => void;
  buildRoad: (edgeId: string) => void;
  upgradeSettlementToCity: (vertexId: string) => void;
  recruitSoldier: (vertexId: string) => void;
  moveSoldier: (soldierId: string, targetVertexId: string) => void;
  healSoldier: (soldierId: string, payWith?: ResourceKey) => void;
  startAttack: (soldierIds: string[], targetVertexId: string, defenderName?: string) => void;
  captureSettlement: (soldierId: string, vertexId: string) => void;
  fightRobber: (soldierId: string, vertexId: string) => void;
  moveRobberAfterWin: (hexId: string) => void;
  playDevelopmentCard: (cardIndex: number) => void;
  chooseKnightEffect: (effect: 'robber' | 'spawn' | 'cancel') => void;
  knightSpawnSoldier: (vertexId: string) => void;
  setSelectedSoldierIds: (ids: string[]) => void;
  upgradeCannon: (soldierId: string) => void;
  downgradeCannon: (soldierId: string) => void;
  stationCannon: (soldierId: string) => void;
  unstationCannon: (soldierId: string) => void;
  cannonAttack: (soldierId: string, targetSoldierId: string) => void;
  cannonSplash: (soldierId: string, vertexId: string) => void;
  cannonAttackWall: (soldierId: string, edgeId: string, explosive?: boolean) => void;
  upgradeRoadToWall: (edgeId: string) => void;
  buildShip: (vertexId: string) => void;
  moveShip: (shipId: string, vertexId: string) => void;
  embarkSoldier: (soldierId: string, shipId: string) => void;
  disembarkSoldier: (soldierId: string, vertexId: string) => void;
  convertShipToSettlement: (shipId: string, vertexId: string) => void;
  /** Enter sail pick-mode for this ship (BoardView highlights the targets). */
  setSailingShipId: (shipId: string | null) => void;
}

/** One snapshot of everything the action catalog reads. */
export interface BoardActionsInput {
  board: Board;
  room: PublicGameRoom;
  /** The viewing player's seat (spectators have none → no actions). */
  me: PublicPlayer;
  selection: SelectableObject;
  selectedSoldierIds: string[];
  /** The setup coach's current step, so its bubble can show the finger. */
  coachKey: 'settlement' | 'road' | null;
  emit: BoardActionEmit;
}

/** What a board selection resolved to against the live board. */
export type ResolvedSelection =
  | { kind: 'vertex'; vertex: VertexNode }
  | { kind: 'edge'; edge: EdgeNode }
  | { kind: 'ship'; ship: ShipObj }
  | { kind: 'robber'; robberHexId: string };

/**
 * Resolve a raw board selection to the live object it names (or the hex the
 * robber sits on — its id, not the selected id, is what matters). Returns
 * null when the selection is stale.
 */
export function resolveSelection(
  board: Board,
  selection: SelectableObject
): ResolvedSelection | null {
  if (selection.type === 'vertex') {
    const vertex = board.vertices[selection.id];
    return vertex ? { kind: 'vertex', vertex } : null;
  }
  if (selection.type === 'edge') {
    const edge = board.edges[selection.id];
    return edge ? { kind: 'edge', edge } : null;
  }
  if (selection.type === 'ship') {
    const ship = board.ships[selection.id];
    return ship ? { kind: 'ship', ship } : null;
  }
  const robber = Object.values(board.hexes).find((h) => h.robber);
  return robber ? { kind: 'robber', robberHexId: robber.id } : null;
}

/**
 * The piece rules are written against the server's `GameRoom`/`Player`; the
 * broadcast room and seat carry every field they read, so the cast is safe
 * and keeps the bubble checks identical to what the backend enforces.
 */
export const asDomain = (room: PublicGameRoom, me: PublicPlayer) => ({
  asRoom: room as unknown as GameRoom,
  asMe: me as Player,
});
