
/**
 * Clean common layer (v2) for the vertex-based board rebuild.
 *
 * Domain types, presentation types, pure utils, and adapters — all with
 * canonical string ids (see types/Coordinates.ts for the spec).
 *
 * Consumed by the new `ui` client (and, later, the backend — the ID format
 * change is a breaking wire change that must ship atomically, see
 * plans/clean_rebuild_strategy_v2.md Phase 3).
 */

export * from './types/Coordinates';
export * from './types/Board';
export * from './types/Hex';
export * from './types/Pieces';
export * from './types/Player';
export * from './types/Logic';
export * from './types/Room';
export * from './types/BoardUI';
export * from './types/Adjacency';
export * from './types/BoardGenerator';
export * from './Constant';
export * from './utils/coordinates';
export * from './utils/hex';
export * from './utils/logic';
export * from './utils/dice';
export * from './utils/validation';
export * from './utils/pieces';
export * from './utils/adjacency';
export * from './utils/boardGenerator';
export * from './utils/placement';
export * from './utils/trade';
export * from './adapters/boardAdapter';
