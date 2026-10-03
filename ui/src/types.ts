/**
 * UI-only shared types (not part of the backend wire contract).
 *
 * Domain entities (GameRoom, Player, Board, ...) live in `common/types/*` and
 * are imported from there — only client-side shapes belong here. Larger
 * domains have their own files under `types/` (e.g. `types/board`).
 */

/** A board object selected on the map (vertex or edge). */
export interface SelectableObject {
  type: 'vertex' | 'edge';
  id: string;
}

/** Persisted lobby join, so a reload auto-rejoins the same room. */
export interface SavedSession {
  roomId: string;
  playerName: string;
  color?: string;
  /** Server-issued seat token: proves ownership when re-attaching after a reload. */
  token?: string;
}
