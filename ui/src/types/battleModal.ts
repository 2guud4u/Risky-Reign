import { SoldierBattleState } from 'common';

/**
 * Types shared by BattleModal (the composition root) and its extracted
 * pieces under `components/battle/` and `utils/battleModal.ts`.
 */

/** A troop's resolved position on the battle mini-map, ready to render. */
export interface TroopSlot {
  x: number;
  y: number;
  s: SoldierBattleState;
}

/** An in-flight drag of an injured troop to a neighboring vertex. */
export interface RepositionDrag {
  soldierId: string;
  ownerName: string;
  fromVertexId: string;
  validTargets: string[];
}

/** One injured survivor resting on a vertex, waiting to be repositioned. */
export interface RepositionTroop {
  soldierId: string;
  ownerName: string;
  vertexId: string;
}

/** Win/loss summary shown once the battle is over. */
export interface BattleOutcome {
  atkAlive: number;
  defAlive: number;
  atkDead: number;
  defDead: number;
  atkInj: number;
  defInj: number;
  winner: string | null;
}

/** One compared die pair from the just-resolved round. */
export interface DiceMatch {
  /** Attacker's roll. */
  a: number;
  /** Defender's roll. */
  d: number;
  /** Outcome label (e.g. "3 killed", "flee", "tie"). */
  text: string;
  /** Tailwind class colouring the outcome label. */
  cls: string;
}
