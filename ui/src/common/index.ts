// Clean common layer for the new `ui` client.
// Domain types, presentation types, pure utils, and adapters — all with
// canonical string ids (see types/Coordinates.ts for the spec).

export * from './types/Coordinates';
export * from './types/Board';
export * from './types/Hex';
export * from './types/Pieces';
export * from './types/Player';
export * from './types/Logic';
export * from './types/Room';
export * from './types/BoardUI';
export * from './Constant';
export * from './utils/adjacency';
export * from './utils/boardGenerator';
export * from './utils/placement';
export * from './adapters/boardAdapter';
export * from './adapters/wireAdapter';
