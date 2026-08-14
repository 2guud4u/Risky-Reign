import { Player } from './Player';
import { BattleState, TradeState, TurnState } from './Logic';

/**
 * Wire protocol: the exact shape the backend emits over the socket. The
 * backend still uses its legacy board format (capitalized arrays, numeric
 * vertex ids, pixel coords on pieces). `WireBoard` documents that contract so
 * the adapter (adapters/wireAdapter.ts) can convert it to the clean domain
 * `Board` in one place.
 *
 * NOTE: this is a breaking wire change for the NEW ui client — it emits STRING
 * vertex/edge ids on build actions. Frontend and backend must ship together
 * (see plans/clean_rebuild_strategy_v2.md, Phase 3 "wire protocol note").
 */

export interface WireHex {
  id: string;
  coord: { q: number; r: number; s: number };
  terrain: string;
  rollNumber: number | null;
  robber: boolean;
}

export interface WireVertex {
  id: string | number;
  coord: { x: number; y: number };
  settlement: string | null;
  roads: string[];
}

export interface WireSettlement {
  id: string;
  owner: string;
  upgraded: boolean;
  intersect: string | number;
  coord: { x: number; y: number };
}

export interface WireRoad {
  id: string;
  owner: string;
  upgraded: boolean;
  intersect1: string | number;
  intersect2: string | number;
  coord1: { x: number; y: number };
  coord2: { x: number; y: number };
}

export interface WireBoard {
  Hexes: WireHex[];
  Vertexs: WireVertex[];
  Settlements: WireSettlement[];
  Roads: WireRoad[];
}

export interface GameRoom {
  id: string;
  players: Player[];
  board: WireBoard | null;
  turnState: TurnState;
  tradeStates: TradeState[];
  battleState: BattleState | null;
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner: string | null;
  roll: string;
}
