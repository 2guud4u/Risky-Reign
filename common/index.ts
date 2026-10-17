/**
 * The `common` package — shared domain for backend and UI, grouped into
 * four named modules. Import site stays `from 'common'`; the groups below
 * are the package's real dependency edges.
 *
 * - `types/`    — the wire + domain record shapes (Board, Room, events).
 * - `board/`    — board geometry, generation, validation, and the
 *                 domain→presentation projection (BoardUI* shapes; the only
 *                 types UI components should touch beyond BoardUI*).
 * - `rules/`    — game rules as check + apply pairs: pending-action
 *                 protocol, dev cards, battle commit. Backend dispatch and
 *                 the UI's eligibility reads share these.
 * - `utils/`    — pure helpers that have no room-level rules in them.
 */

// types — wire + domain records
export * from './types/Coordinates';
export * from './types/Board';
export * from './types/Hex';
export * from './types/SocketEvents';
export * from './types/Pieces';
export * from './types/Player';
export * from './types/DevelopmentCard';
export * from './types/Logic';
export * from './types/Room';
export * from './types/BoardUI';
export * from './types/Adjacency';
export * from './types/BoardGenerator';
export * from './types/MapCatalog';
export * from './Constant';

// board — geometry, generation, presentation projection
export * from './utils/coordinates';
export * from './utils/hex';
export * from './utils/adjacency';
export * from './utils/boardValidate';
export * from './utils/mapCatalog';
export * from './utils/boardGenerator';
export * from './utils/placement';
export * from './adapters/boardAdapter';

// rules — check + apply game rules (the deepening: pending, devCards, battle commit)
export * from './rules/effects';
export * from './rules/pending';
export * from './rules/devCards';
export * from './rules/battle';
export * from './utils/buildValidation';
export * from './utils/soldierActionValidation';
export * from './utils/soldierMoveValidation';
export * from './utils/validation';
export * from './utils/robber';
export * from './utils/trade';
export * from './utils/battle';
export * from './utils/score';
export * from './utils/dice';
export * from './utils/logic';
export * from './utils/turnOrder';

// utils — misc domain helpers
export * from './utils/pieces';
export * from './utils/color';
export * from './utils/roomCode';
export * from './utils/quickPlay';
