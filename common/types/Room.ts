import { Player } from './Player';
import { BattleState, TradeOffer, TurnState, RollResult, ResourceCount, TurnMode } from './Logic';
import { Board, EdgeId } from './Board';
import { DevelopmentCardType } from './DevelopmentCard';
import type { ChatMessage } from './SocketEvents';

/**
 * Wire protocol: the backend now emits the clean domain `Board` directly
 * (string ids, plain Records/arrays — JSON-safe). The new `ui` client consumes
 * `room.board` as-is; no wire adapter is needed.
 */

/**
 * Room-wide scoring bonuses, keyed by player name. Recomputed from the board
 * on every broadcast (see `utils/score.ts`):
 *  - `longestRoad`      : the single longest continuous road chain (≥ 5 roads)
 *                          earns 2 VP.
 *  - `largestArmy`      : the player with the most soldiers (≥ 3) earns 2 VP.
 *  - `battlesWon`       : the player with the most battles won (≥ 3) holds
 *                          Conqueror and earns 2 VP.
 *  - `fleetSize`        : the ships a player owns (empty or crewed). The
 *                          largest fleet (≥ 3 ships) holds The Admiral:
 *                          1 VP and +1 sail step per ship per Action phase.
 *  - `hasLongestRoad` / `hasLargestArmy` / `hasConqueror` / `hasAdmiral` :
 *                          whether this player currently holds that bonus
 *                          (at most one holder each; a tie keeps it with the
 *                          current holder — you must strictly beat them).
 */
export interface RoomBonuses {
  /** Longest continuous road chain per player (0 when the player has no roads). */
  longestRoad: Record<string, number>;
  /** Soldier count per player (0 when the player has no soldiers). */
  largestArmy: Record<string, number>;
  /** Players currently holding the Longest Road bonus (2 VP). */
  hasLongestRoad: Record<string, boolean>;
  /** Players currently holding the Largest Army bonus (2 VP). */
  hasLargestArmy: Record<string, boolean>;
  /** Player-vs-player battles won per player (mirrors `GameRoom.battlesWon`). */
  battlesWon: Record<string, number>;
  /** Players currently holding the Conqueror bonus (2 VP). */
  hasConqueror: Record<string, boolean>;
  /** Ships owned per player (0 when the player has no ships). */
  fleetSize: Record<string, number>;
  /** Players currently holding The Admiral bonus (1 VP). */
  hasAdmiral: Record<string, boolean>;
  /** Longest contiguous wall run per player (0 when the player has no walls). */
  wallRun: Record<string, number>;
  /** Players currently holding The Great Wall bonus (1 VP; their walls break on 5+). */
  hasGreatWall: Record<string, boolean>;
  /** Victory points from settlements (1 VP) and cities (2 VP), per player. */
  settlementVp: Record<string, number>;
}

/**
 * Pending robber placement. While set, the named player must resolve it via
 * the `moveRobber` event: a 'seven' holds the Dice phase from advancing,
 * and a 'knight' holds the card until the robber is placed.
 */
export interface RobberMoveRequest {
  player: string;
  reason: 'seven' | 'knight';
}
/**
 * Pending steal after a 7. While set, the thief must resolve it via the
 * `chooseSteal` event: they pick one face-down card from one of `victims`.
 * Holds the Dice phase until the steal resolves. (A knight moves the robber
 * without stealing.)
 */
export interface StealState {
  thief: string;
  /** Names of eligible victims (adjacent to the robber's hex, ≥ 1 card). */
  victims: string[];
}
/**
 * Pending development-card choice. While set, the named player must resolve
 * it: Year of Plenty picks 2 resources from the bank and Monopoly names 1
 * resource type (both via `resolveDevCardChoice`); Knight picks its effect
 * via `chooseKnightEffect` — move the robber, or spawn a soldier (then
 * `knightSpawnSoldier` on a vertex holding one of their soldiers). The card
 * is held in the hand until resolved.
 */
export interface DevCardChoice {
  player: string;
  card: 'year_of_plenty' | 'monopoly' | 'knight';
  /** Index of the held card in the player's hand. */
  cardIndex: number;
  /** Knight only: true once the player chose to spawn (awaiting a vertex). */
  spawn?: boolean;
}
/**
 * Pending 7-discards, keyed by player name. While a player's entry is set,
 * they must resolve it via the `resolveDiscard` event: they hand in exactly
 * that many resource cards (half their resource hand, rounded down). A 7
 * holds the Dice phase until every discard is resolved and the robber is
 * moved.
 */
export type DiscardState = Record<string, number>;
/**
 * Pending wall-gate crossing. While set, a soldier trying to move across an
 * enemy wall is held: the crosser first submits a 1-6 guess via `wallGuess`,
 * then the wall owner resolves it with `rollWallGate` (server rolls a d6 —
 * guess match = the soldier crosses, miss = it stays; the action is consumed
 * either way).
 */
export interface WallGateState {
  /** Soldier attempting the crossing. */
  soldierId: string;
  /** The walled edge being crossed. */
  edgeId: string;
  /** Where the soldier lands if the guess matches. */
  targetVertexId: string;
  /** The crosser's 1-6 guess (null until `wallGuess`). */
  /** The crosser's 1-6 guess (null until `wallGuess`). */
  guess: number | null;
  /** The resolving roll once the owner (or the server) has rolled; a non-null
      roll means the gate is resolved and lingers briefly so everyone sees the
      outcome before it's cleared. */
  roll: number | null;
  /** Player moving the soldier (submits the guess). */
  crosserName: string;
  /** Owner of the wall (triggers the resolving roll). */
  wallOwnerName: string;
}
/** One piece under a ranged shot: its owner owes the roll for its die. */
export interface CannonShotVictim {
  soldierId: string;
  ownerName: string;
  type: 'infantry' | 'cannon';
  /** The victim's die — null until its owner clicks it (or the server rolls). */
  roll: number | null;
  /** Filled when every die is in: the victim's fate against the cannon's roll. */
  outcome: 'kill' | 'injure' | 'miss' | null;
}
/**
 * A ranged shot on the table (GLOSSARY "Cannon"): while set, every client
 * shows the duel panel. Firing records the shot with all dice unrolled and
 * freezes the board like a battle — the shooter rolls the cannon's die and
 * each victim's owner rolls that soldier's die (`rollCannonShot`; the server
 * rolls owed dice after the deadline or instantly on disconnect). Once every
 * die is in, outcomes apply and the record lingers CANNON_SHOT_REVEAL_MS.
 * `chained` marks a Chain shot: one cannon die against every victim.
 */
export interface CannonDuelShot {
  kind?: 'duel';
  /** The firing cannon's soldier id. */
  cannonId: string;
  /** The shooter's player name. */
  shooterName: string;
  /** The vertex the victims stood on. */
  vertexId: string;
  /** The cannon's die — null until the shooter rolls it. */
  cannonRoll: number | null;
  /** Single shot has exactly one victim; a Chain shot lists everyone hit. */
  victims: CannonShotVictim[];
  /** Whether chain shot (splash) was loaded. */
  chained: boolean;
}
/**
 * A wall shot on the table (GLOSSARY "Wall" breach): while set, every client
 * shows the breach modal. A Single shot first sits with `roll: null` — the
 * shooter owes the breach roll (`rollWallShot`; the server rolls for them
 * after WALL_SHOT_ROLL_MS or instantly on disconnect) and the board freezes
 * like a wall gate. Once rolled, or for a guaranteed Explosive shot, the
 * record lingers CANNON_SHOT_REVEAL_MS so everyone sees BREACHED / HELD.
 */
export interface CannonWallShot {
  kind: 'wall';
  /** The firing cannon's soldier id. */
  cannonId: string;
  /** The shooter's player name. */
  shooterName: string;
  /** The walled edge under fire. */
  edgeId: EdgeId;
  /** The wall's owner (whose troops it blocks). */
  wallOwnerName: string;
  /** The breach die — null while the shooter still owes the click. */
  roll: number | null;
  /** Explosive shot (1 ore): guaranteed breach, no die is rolled. */
  explosive: boolean;
  /** The roll needed to breach (4, or 5 when the owner holds The Great Wall). */
  threshold: number;
  /** Whether the wall fell (already applied to the road when roll lands). */
  breached: boolean;
}
/** A cannon shot on the table: a resolved duel, or a pending/resolved wall shot. */
export type CannonShotState = CannonDuelShot | CannonWallShot;
/**
 * Room lifecycle. 'waiting' lobbies are memory-only; 'playing', 'paused',
 * 'resuming' and 'finished' rooms have a DB row once autosaved or paused.
 * 'resuming' = a reopened lobby collecting the original seats before the
 * game continues. Paused rows are swept after the expiry window.
 */
export type GameStatus = 'waiting' | 'playing' | 'paused' | 'resuming' | 'finished';

export interface GameRoom {
  id: string;
  players: Player[];
  board: Board | null;
  turnState: TurnState;
  tradeOffers: TradeOffer[];
  battleState: BattleState | null;
  /** Shared face-down development card deck (drawn from in order). */
  devCardDeck: DevelopmentCardType[];
  /** Lifecycle: waiting → playing → (paused ⇄ resuming) → finished. */
  gameStatus: GameStatus;
  /**
   * Set when a running game is paused for later resume (null otherwise).
   * The DB row it is written to carries the authoritative copy; in memory
   * this is only observed on hydrated 'resuming' lobbies.
   */
  pausedAt: number | null;
  /** Victory threshold in VP (the "points to win" setting). */
  pointsToWin: number;
  /** Build/Action phase scope per dice round; see `TurnMode` in Logic.ts. */
  turnMode: TurnMode;
  /**
   * How many of each player's setup placements may be a city instead of a
   * settlement (0 to MAX_SETUP_CITIES). The player picks which ones.
   */
  setupCities: number;
  /**
   * Feature toggles (waiting-lobby settings, host editable): when false the
   * matching piece cannot be built/upgraded or used in this game.
   */
  cannonsEnabled: boolean;
  wallsEnabled: boolean;
  shipsEnabled: boolean;
  /**
   * Optional per-phase timer (ms; 0 = off). When set, Build and Action
   * phases auto-advance when `phaseTimerEndsAt` passes; an active battle
   * suspends it via `phaseTimerRemainingMs`.
   */
  turnTimerMs: number;
  /** Wall-clock deadline for the current Build/Action phase (null = disarmed). */
  phaseTimerEndsAt: number | null;
  /** Time left when a battle suspends the phase timer (null = not paused). */
  phaseTimerRemainingMs: number | null;
  /**
   * Customization lock (waiting phase only). Host sets it: false (default)
   * lets anyone in the room change rules and the board from Customize Game;
   * true restricts those edits to the host. The lobby password and game
   * start are always host-only and ignore this flag.
   */
  rulesLocked: boolean;
  winner: string | null;
  roll: RollResult;
  /** Pending robber placement (a 7 roll or a played knight card). */
  robberMove: RobberMoveRequest | null;
  /**
   * Set when a player defeats the robber in a fight: the winner must move
   * the robber to any hex adjacent to its current position (via the
   * `moveRobberAfterWin` event) before the Action phase may advance.
   * Cleared when the robber is moved or when the winner leaves the room.
   * (The Action phase cannot advance while this is set.)
   */
  robberDefeatedBy: { playerName: string; fromHexId: string } | null;
  /** Pending steal (the thief picks a face-down card from a victim). */
  steal: StealState | null;
  /** Pending development-card choice (Year of Plenty / Monopoly). */
  devCardChoice: DevCardChoice | null;
  /** Pending 7-discards (players with 8+ resource cards hand in half). */
  discards: DiscardState;
  /** Pending wall-gate crossing (crosser guesses, wall owner rolls). */
  wallGate: WallGateState | null;
  /**
   * The last resolved single-target cannon shot, kept for a few seconds so
   * every client can show the outcome panel (server-cleared). Splash shots
   * and wall attacks don't set it.
   */
  cannonShot: CannonShotState | null;
  /**
   * The robber's bag: every resource card discarded by the 7 rule, plus the
   * resources produced by hexes the robber sits on.
   */
  robberBag: ResourceCount;
  /**
   * Remaining bank supply per resource (19 of each at game start — the
   * official 95-card bank). Bank trades and Year of Plenty deplete it.
   */
  bankSupply: ResourceCount;
  /** Recomputed scoring bonuses (longest road / largest army / conqueror). */
  bonuses: RoomBonuses;
  /**
   * Player-vs-player battles won, per player name. Incremented when a battle
   * ends with only one side standing or the attacker flees an undecided
   * battle (robber fights don't count). Drives the Conqueror bonus.
   */
  battlesWon: Record<string, number>;
  /** Last activity timestamp (ms). Used to sweep idle rooms and free memory. */
  lastActivityAt: number;
  /**
   * Socket ids watching the game without a seat (joined a started game when
   * no seat was free to reclaim). Server-only: never broadcast.
   */
  spectators: string[];
  /** Room chat, oldest first; capped at CHAT_LOG_MAX (server trims). */
  chatLog: ChatMessage[];
  /**
   * Server-only room password hash (never broadcast — `hasPassword` carries
   * the public flag). Set ⇒ the room is private: joining and spectating
   * require the password and Quick Play skips it. Null ⇒ open.
   */
  passwordHash: string | null;
}
/**
 * A player as broadcast to clients: the secret `token` is stripped, and other
 * players' `resources`/`developmentCards` are masked (zeroed/empty) so only
 * the seat owner sees their hand. `resourceCount`/`devCardCount` carry the
 * public totals the UI shows for opponents.
 */
export type PublicPlayer = Omit<Player, 'token' | 'resources' | 'developmentCards'> & {
  resources: Player['resources'];
  developmentCards: Player['developmentCards'];
  resourceCount: number;
  devCardCount: number;
};

/**
 * The room as broadcast to a given client: the shared `devCardDeck` draw order
 * is hidden (only its size is public) and every player is a `PublicPlayer`.
 */
export type PublicGameRoom = Omit<
  GameRoom,
  'players' | 'devCardDeck' | 'spectators' | 'passwordHash'
> & {
  players: PublicPlayer[];
  /** Face-down cards remaining in the shared deck (order hidden). */
  devCardDeckCount: number;
  /** How many people are spectating (identities stay private). */
  spectatorCount: number;
  /** ms timestamp when this game's DB row is swept (null = not persisted). */
  expiresAt: number | null;
  /** True when the room is passworded (private); the hash never ships. */
  hasPassword: boolean;
};
