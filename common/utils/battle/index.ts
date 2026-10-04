/**
 * Combat resolution logic for soldier battles.
 * Pure functions that operate on game state and return new state or results.
 */

export {
  canStartBattle,
  canFightRobber,
  createBattleState,
  createRobberBattleState,
} from './state';
export {
  rollDie,
  activeSoldiersOf,
  rollBattleDie,
  allSoldiersRolled,
  canRollBattleDie,
} from './rolls';
export {
  resolveBattleRoundIfComplete,
  escapeInjuredSurvivors,
} from './resolution';
export { roadNeighbors, injuredLeftToMove, nextRepositionTurn } from './reposition';
