import { Server } from 'socket.io';
import {
  GameRoom,
  PublicGameRoom,
  PublicPlayer,
  ResourceCount,
  RESOURCES,
} from 'common';
import { freshResourceCount } from './store';

/**
 * Sanitize the room for a single recipient identified by their socket id: the
 * shared dev-card deck order is hidden (only the count is public), every
 * player's seat token is stripped, and every OTHER player's hand is masked so
 * only the seat owner sees their cards. Matching by socket id (not name) keeps
 * empty-named lobby seats from seeing a sibling's hand.
 * `resourceCount`/`devCardCount` carry the public totals opponents see.
 */
export function sanitizeRoomFor(room: GameRoom, viewerSocketId: string): PublicGameRoom {
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
  const { devCardDeck: _deck, players: _players, ...rest } = room;
  return {
    ...rest,
    players,
    devCardDeckCount: room.devCardDeck.length,
  };
}

/** Total resource cards in a hand. */
function totalResources(resources: ResourceCount): number {
  let total = 0;
  for (const key of RESOURCES) total += resources[key] ?? 0;
  return total;
}

/**
 * Broadcast a room update to each connected player, masking secrets
 * per-recipient. Marks the room active so the idle sweep keeps it alive.
 * `event` is 'gameUpdate' by default; room.ts uses 'roomUpdate' for lobby sync.
 */
export function broadcastRoom(
  io: Server,
  room: GameRoom,
  event: 'gameUpdate' | 'roomUpdate' = 'gameUpdate'
): void {
  room.lastActivityAt = Date.now();
  for (const p of room.players) {
    if (!p.id) continue;
    io.to(p.id).emit(event, sanitizeRoomFor(room, p.id));
  }
}
