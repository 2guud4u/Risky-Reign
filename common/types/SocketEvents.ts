/**
 * The socket.io event contract shared by client and server.
 *
 * Every client→server action is `{ roomId, ... }`; the server identifies the
 * caller by `socket.id`, not a payload field, so no event carries `playerId`.
 * Server→client events broadcast room state or one-shot results.
 *
 * Feeding these maps to socket.io's `Server`/`Socket` generics makes a typo'd
 * event name or a wrong-shaped payload a compile error on both ends.
 */
import { PublicGameRoom } from './Room';
import { HexLayout } from './BoardGenerator';
import { Price, ResourceKey, TurnMode } from './Logic';

/**
 * A completed trade, announced to the whole room as a chat-log line. `to` is
 * the counterparty player, or null for the bank. `gave`/`got` are from
 * `from`'s side: what they handed over and what they received.
 */
export interface TradeAnnouncement {
  from: string;
  to: string | null;
  gave: Price;
  got: Price;
}

/** One line in the room chat log (part of the broadcast room state). */
export interface ChatMessage {
  /** Display name at send time ('Spectator' when the sender has no seat). */
  from: string;
  text: string;
  /** Server clock ms — ordering + rendering only. */
  at: number;
  /**
   * Whisper recipient (a player name). Absent = the whole room. Server-side
   * the log keeps every message; sanitizeRoomFor drops whispers a viewer
   * isn't party to, so clients never see them.
   */
  to?: string;
  /**
   * Set on server-posted trade announcements (never on player messages).
   * `text` then holds a plain-text fallback of the same trade.
   */
  trade?: TradeAnnouncement;
}

/** Result of a 1v1 robber fight, broadcast to the whole room. */
export interface RobberFightResult {
  playerName: string;
  soldierId: string;
  soldierRoll: number;
  robberRoll: number;
  won: boolean;
}

/** What a persisted room code resolves to for a joiner without a seat. */
export interface PausedGameInfo {
  roomId: string;
  status: 'paused' | 'resuming';
  players: { name: string; color: string; connected: boolean }[];
  pausedAt: number | null;
  /** ms timestamp when the saved row is swept. */
  expiresAt: number;
  /** 'resuming' games that were paused with a lobby password. */
  requiresLobbyPassword: boolean;
}

/** A seat whose player dropped out, offered in the rejoin picker. */
export interface RejoinSeat {
  name: string;
  color: string;
}

/** Client → server events: name → payload the client emits. */
export interface ClientToServerEvents {
  /** `asCity`: during setup, place a city directly (room's `setupCities` setting). */
  buildSettlement: (data: { roomId: string; vertexId: string; asCity?: boolean }) => void;
  buildRoad: (data: { roomId: string; edgeId: string }) => void;
  upgradeSettlementToCity: (data: { roomId: string; vertexId: string }) => void;
  recruitSoldier: (data: { roomId: string; vertexId: string }) => void;
  moveSoldier: (data: { roomId: string; soldierId: string; targetVertexId: string }) => void;
  captureSettlement: (data: { roomId: string; soldierId: string; vertexId: string }) => void;
  fightRobber: (data: { roomId: string; soldierId: string; vertexId: string }) => void;
  moveRobber: (data: { roomId: string; hexId: string }) => void;
  chooseSteal: (data: { roomId: string; victimName: string; cardIndex: number }) => void;
  resolveDiscard: (data: { roomId: string; discards: Record<string, number> }) => void;
  resolveDevCardChoice: (data: { roomId: string; resources: string[] }) => void;
  chooseKnightEffect: (data: { roomId: string; effect: 'robber' | 'spawn' | 'cancel' }) => void;
  knightSpawnSoldier: (data: { roomId: string; vertexId: string }) => void;
  healSoldier: (data: { roomId: string; soldierId: string; payWith?: ResourceKey }) => void;
  startAttack: (data: { roomId: string; soldierIds: string[]; targetVertexId: string; defenderName?: string }) => void;
  rollBattleDie: (data: { roomId: string; soldierId: string }) => void;
  repositionSoldier: (data: { roomId: string; soldierId: string; targetVertexId: string }) => void;
  finishRepositioning: (data: { roomId: string }) => void;
  moveRobberAfterWin: (data: { roomId: string; hexId: string }) => void;
  continueBattle: (data: { roomId: string }) => void;
  endBattle: (data: { roomId: string }) => void;
  exitBattle: (data: { roomId: string }) => void;
  rollDice: (data: { roomId: string }) => void;
  joinRoom: (data: { roomId: string; playerName: string; color?: string; layouts?: HexLayout[]; token?: string }) => void;
  updatePlayerColor: (data: { roomId: string; color: string }) => void;
  updatePlayerName: (data: { roomId: string; name: string }) => void;
  startGame: (data: { roomId: string }) => void;
  resetGame: (data: { roomId: string }) => void;
  refreshMap: (data: { roomId: string }) => void;
  updatePointsToWin: (data: { roomId: string; pointsToWin: number }) => void;
  setTurnMode: (data: { roomId: string; turnMode: TurnMode }) => void;
  setSetupCities: (data: { roomId: string; setupCities: number }) => void;
  /** Host only: per-phase turn timer in ms (0 = off). Waiting-lobby setting. */
  setTurnTimer: (data: { roomId: string; turnTimerMs: number }) => void;
  editBoard: (data: { roomId: string; layouts: HexLayout[] }) => void;
  endTurn: (data: { roomId: string }) => void;
  undoBuild: (data: { roomId: string }) => void;
  drawDevelopmentCard: (data: { roomId: string }) => void;
  playDevelopmentCard: (data: { roomId: string; cardIndex: number }) => void;
  createTradeOffer: (data: { roomId: string; to: string | null; give: Price; want: Price }) => void;
  acceptTrade: (data: { roomId: string; tradeId: string }) => void;
  declineTrade: (data: { roomId: string; tradeId: string }) => void;
  cancelTrade: (data: { roomId: string; tradeId: string }) => void;
  takeTrade: (data: { roomId: string; tradeId: string }) => void;
  bankTrade: (data: { roomId: string; giveResource: string; wantResource: string; giveCount: number }) => void;
  leaveGame: (data: { roomId: string }) => void;
  sendChat: (data: { roomId: string; text: string; to?: string }) => void;
  /** Take over a disconnected seat offered by `rejoinOptions`. The lobby
      password is required when the seat lives in a paused 'resuming' game. */
  claimSeat: (data: { roomId: string; name: string; lobbyPassword?: string }) => void;
  /** Watch a started game without a seat. */
  spectateRoom: (data: { roomId: string }) => void;
  /** Host only: persist the running game and close the room for later resume. */
  pauseGame: (data: { roomId: string; hostPassword: string; lobbyPassword: string }) => void;
  /** Reopen a paused game into a 'resuming' lobby (host password). */
  openResumeLobby: (data: { roomId: string; hostPassword: string }) => void;
  /** Host seat only: cancel a 'resuming' lobby back to 'paused'. */
  closeResumeLobby: (data: { roomId: string }) => void;
  /** Probe the lobby password of a 'resuming' game before claiming a seat. */
  unlockResumeLobby: (data: { roomId: string; lobbyPassword: string }) => void;
}

/** Server → client events: name → payload the server emits. */
export interface ServerToClientEvents {
  /** Full sanitized room after any change (in-game). */
  gameUpdate: (room: PublicGameRoom) => void;
  /** Full sanitized room during lobby/setup (same payload as gameUpdate). */
  roomUpdate: (room: PublicGameRoom) => void;
  /** Rejected action or fatal request; `{ message }` shown to the user. */
  error: (error: { message: string }) => void;
  /** Seat token for a just-joined socket, used to re-attach after reload. */
  joined: (data: { token: string }) => void;
  /** One-shot robber-fight dice result, broadcast to the room. */
  robberFightResult: (result: RobberFightResult) => void;
  /**
   * Sent instead of a room when someone without a seat token joins a game
   * that already started: the disconnected seats they may reclaim (empty =
   * nobody left, so spectating is the only option).
   */
  rejoinOptions: (data: { roomId: string; seats: RejoinSeat[] }) => void;
  /**
   * Sent instead of a room when the room code resolves to a persisted game:
   * 'paused' = waiting for the host to reopen it; 'resuming' = the lobby is
   * open and original seats can claim back in (lobby password required).
   */
  pausedGameInfo: (data: PausedGameInfo) => void;
  /** The persisted game this socket was watching was swept for expiry. */
  gameExpired: (data: { roomId: string }) => void;
  /** The submitted lobby password matched — the picker may claim seats. */
  resumeLobbyUnlocked: (data: { roomId: string }) => void;
}
