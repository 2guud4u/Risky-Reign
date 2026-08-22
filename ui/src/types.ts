/**
 * UI-only shared types (not part of the backend wire contract).
 *
 * Domain entities (GameRoom, Player, Board, ...) live in `common/types/*` and
 * are imported from there — only client-side shapes belong here.
 */

/** A board object selected in the sidebar (vertex or edge panel). */
export interface SelectableObject {
  type: 'vertex' | 'edge';
  id: string;
}

/** Persisted lobby join, so a reload auto-rejoins the same room. */
export interface SavedSession {
  roomId: string;
  playerName: string;
  color?: string;
}
