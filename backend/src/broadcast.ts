import { Server } from 'socket.io';
import {
  GameRoom,
  PublicGameRoom,
  PublicPlayer,
  ResourceCount,
  RESOURCES,
  PERSISTED_GAME_TTL_MS,
} from 'common';
import { freshResourceCount } from './store';
import { getMeta } from './persistence/gameRepository';
import { autosaveRoom } from './lifecycle';
import { syncPhaseTimer } from './phaseTimer';
/**
 * Sanitize the room for a single recipient identified by their socket id: the
 * shared dev-card deck order is hidden (only the count is public), every
 * player's seat token is stripped, and every OTHER player's hand is masked so
 * only the seat owner sees their cards. Matching by socket id (not name) keeps
 * empty-named lobby seats from seeing a sibling's hand.
 * `resourceCount`/`devCardCount` carry the public totals opponents see.
 * `expiresAt` is computed once per broadcast and passed in (the DB row is
 * room-level, not per viewer).
 */
export function sanitizeRoomFor(
  room: GameRoom,
  viewerSocketId: string,
  expiresAt: number | null = expiryFor(room.id)
): PublicGameRoom {
  const players: PublicPlayer[] = room.players.map((p) => {
    const isViewer = p.id === viewerSocketId;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token: _token, ...rest } = p;
    const resources: ResourceCount = isViewer ? p.resources : freshResourceCount(0);
    const developmentCards = isViewer ? p.developmentCards : [];
    return {
      ...rest,
      resources,
      developmentCards,
      resourceCount: totalResources(p.resources),
      devCardCount: p.developmentCards.length,
    };
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { devCardDeck: _deck, players: _players, spectators, chatLog, ...rest } = room;
  // Whispers (m.to set) are visible only to their sender and recipient —
  // they never reach another client's sanitized payload.
  const viewerName = room.players.find((p) => p.id === viewerSocketId)?.name;
  const visibleChat = chatLog.filter(
    (m) => !m.to || m.to === viewerName || m.from === viewerName
  );
  return {
    ...rest,
    players,
    chatLog: visibleChat,
    devCardDeckCount: room.devCardDeck.length,
    spectatorCount: spectators.length,
    // Persisted games carry a sweep deadline; memory-only rooms get none.
    expiresAt,
  };
}

/** The sweep deadline for this room's DB row, or null when not persisted. */
function expiryFor(roomId: string): number | null {
  const meta = getMeta(roomId);
  return meta ? meta.last_activity_at + PERSISTED_GAME_TTL_MS : null;
}

/** Total resource cards in a hand. */
function totalResources(resources: ResourceCount): number {
  let total = 0;
  for (const key of RESOURCES) total += resources[key] ?? 0;
  return total;
}

/**
 * Broadcast a room update to each connected player and spectator, masking
 * secrets per-recipient (a spectator's socket id matches no seat, so every
 * hand is masked for them). Marks the room active so the idle sweep keeps it
 * alive. `event` is 'gameUpdate' by default; room.ts uses 'roomUpdate' for
 * lobby sync.
 */
export function broadcastRoom(
  io: Server,
  room: GameRoom,
  event: 'gameUpdate' | 'roomUpdate' = 'gameUpdate'
): void {
  room.lastActivityAt = Date.now();
  // Every state emission autosaves persisted rooms, so a restart loses at
  // most the in-flight action (autosaveRoom no-ops for 'waiting' lobbies).
  // A failed save must never break a broadcast — the game keeps running
  // in memory; the next broadcast retries.
  try {
    autosaveRoom(room);
  } catch (err) {
    console.error(`Autosave failed for ${room.id}:`, err);
  }
  // Phase timer syncs BEFORE emitting so the payload carries the corrected
  // state — a battle-open broadcast must already show the frozen deadline,
  // and a battle-close one the resumed deadline.
  syncPhaseTimer(io, room);
  const expiresAt = expiryFor(room.id);
  for (const p of room.players) {
    if (!p.id || !p.connected) continue;
    io.to(p.id).emit(event, sanitizeRoomFor(room, p.id, expiresAt));
  }
  for (const id of room.spectators) {
    io.to(id).emit(event, sanitizeRoomFor(room, id, expiresAt));
  }
}
