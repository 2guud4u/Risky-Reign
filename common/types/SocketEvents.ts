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
import { Price, ResourceKey } from './Logic';

/** Result of a 1v1 robber fight, broadcast to the whole room. */
export interface RobberFightResult {
  playerName: string;
  soldierId: string;
  soldierRoll: number;
  robberRoll: number;
  won: boolean;
}

/** A seat whose player dropped out, offered in the rejoin picker. */
export interface RejoinSeat {
  name: string;
  color: string;
}

/** Client → server events: name → payload the client emits. */
export interface ClientToServerEvents {
  buildSettlement: (data: { roomId: string; vertexId: string }) => void;
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
  /** Take over a disconnected seat offered by `rejoinOptions`. */
  claimSeat: (data: { roomId: string; name: string }) => void;
  /** Watch a started game without a seat. */
  spectateRoom: (data: { roomId: string }) => void;
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
}
