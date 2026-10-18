/**
 * Development-card rules — the full rule, not just the check half.
 *
 * Every other action family (build, soldier, trade, battle) already exposes
 * its `can*` predicates from common; dev cards were the gap: the checks lived
 * inline in the backend handler and the UI re-implemented them. This module
 * is the single source for both — can/cannot questions AND the apply steps
 * (pay, draw, hold, resolve) — so server and client evaluate the same rule.
 */
import type { Board, VertexId } from '../types/Board';
import type { BuildCheck, ResourceKey, TurnState } from '../types/Logic';
import type { Player } from '../types/Player';
import type { DevelopmentCardType } from '../types/DevelopmentCard';
import type { GameRoom } from '../types/Room';
import { DevelopmentCardPrice, RESOURCES } from '../Constant';
import { canAfford } from '../utils/logic';
import { subtractPrice } from '../utils/trade';
import { generateDevelopmentCardDeck } from '../types/DevelopmentCard';
import { canKnightSpawnAt } from '../utils/soldierActionValidation';
import { pendingBlock } from './pending';

const pass: BuildCheck = { allowed: true, reason: null };
const fail = (reason: string): BuildCheck => ({ allowed: false, reason });

/** The buy rule against a bare turn + hand — works on PublicGameRoom too. */
export function canBuyDevelopmentCard(
  turn: Pick<TurnState, 'phase' | 'player'>,
  player: Pick<Player, 'name' | 'resources'>
): BuildCheck {
  if (turn.phase !== 'Build') {
    return fail('You can only buy development cards during the Build phase');
  }
  if (turn.player !== player.name) {
    return fail('You can only buy development cards on your turn');
  }
  if (!canAfford(player.resources, DevelopmentCardPrice)) {
    return fail('Need 1 wheat, 1 sheep and 1 ore to buy a development card');
  }
  return pass;
}

/** Drawing costs 1 wheat, 1 sheep, 1 ore, during your Build phase. */
export function canDrawDevelopmentCard(room: GameRoom, playerName: string): BuildCheck {
  const player = room.players.find((p) => p.name === playerName);
  if (!player) return fail('Player not found in room');
  return canBuyDevelopmentCard(room.turnState, player);
}

/**
 * Playable dev-card indexes for a hand: a card bought this turn can't be
 * played until next turn — the last `devCardsBoughtThisTurn` entries are
 * the fresh ones. The UI and the play check share this one rule.
 */
export function playableDevCardIndexes(player: Player): number[] {
  const playable = player.developmentCards.length - player.devCardsBoughtThisTurn;
  const out: number[] = [];
  for (let i = 0; i < playable; i++) out.push(i);
  return out;
}

/** May this player play the card at `cardIndex` right now? */
export function canPlayDevelopmentCard(
  room: GameRoom,
  player: Player,
  cardIndex: number
): BuildCheck {
  if (room.turnState.player !== player.name) {
    return fail('You can only play development cards on your turn');
  }
  if (cardIndex < 0 || cardIndex >= player.developmentCards.length) {
    return fail('Invalid card index');
  }
  if (cardIndex >= player.developmentCards.length - player.devCardsBoughtThisTurn) {
    return fail('A card bought this turn can only be played next turn');
  }
  const block = pendingBlock(room, player.name, 'playDevelopmentCard');
  if (block) return fail(block);
  return pass;
}

/**
 * Cards that stay in the hand while their follow-up resolves: the knight
 * waits on an effect pick, Year of Plenty / Monopoly on a resource pick.
 * Every other card is consumed when played.
 */
export function cardHoldsForChoice(card: DevelopmentCardType): boolean {
  return card === 'knight' || card === 'year_of_plenty' || card === 'monopoly';
}

/**
 * Apply: pay the price and draw the top card. The deck reshuffles when
 * empty (checked before the canAfford order in the original handler —
 * drawing from an exhausted deck is free of supply concerns).
 * Assumes `canDrawDevelopmentCard` passed.
 */
export function applyDrawDevelopmentCard(room: GameRoom, player: Player): void {
  if (room.devCardDeck.length === 0) {
    room.devCardDeck = generateDevelopmentCardDeck();
  }
  player.resources = subtractPrice(player.resources, DevelopmentCardPrice);
  const card = room.devCardDeck.pop()!;
  // Victory Point cards are counted immediately (no "play" step).
  if (card === 'victory_point') {
    player.victoryPoints++;
  } else {
    player.developmentCards.push(card);
    player.devCardsBoughtThisTurn++;
  }
}

/**
 * Apply: start a card's resolution. Immediate cards (road_building) resolve
 * now and leave the hand; held cards move their index into devCardChoice.
 * Assumes `canPlayDevelopmentCard` passed.
 */
export function applyPlayDevelopmentCard(
  room: GameRoom,
  player: Player,
  cardIndex: number
): void {
  const card = player.developmentCards[cardIndex];
  if (!cardHoldsForChoice(card)) {
    player.developmentCards.splice(cardIndex, 1);
  }
  switch (card) {
    case 'knight':
      if (!room.board) break;
      room.devCardChoice = { player: player.name, card: 'knight', cardIndex };
      break;
    case 'road_building':
      player.freeRoadsLeft += 2;
      break;
    case 'year_of_plenty':
    case 'monopoly':
      room.devCardChoice = { player: player.name, card, cardIndex };
      break;
    case 'victory_point':
      break; // never held in the hand — counted on draw
  }
}

/**
 * Validate a pending Year-of-Plenty (2 picks) or Monopoly (1 pick) choice
 * against the wire resources and the bank. Pure check — no mutation.
 */
export function canResolveDevCardChoice(
  room: GameRoom,
  player: Player,
  resources: string[]
): BuildCheck {
  const choice = room.devCardChoice;
  if (!choice || choice.player !== player.name || choice.card === 'knight') {
    return fail('No pending card choice');
  }
  if (choice.card === 'year_of_plenty') {
    if (resources.length !== 2) return fail('Choose exactly 2 resources');
    const demand = new Map<ResourceKey, number>();
    for (const r of resources) {
      if (!RESOURCES.includes(r as ResourceKey)) return fail('Invalid resource');
      demand.set(r as ResourceKey, (demand.get(r as ResourceKey) ?? 0) + 1);
    }
    for (const [r, n] of demand) {
      if (room.bankSupply[r] < n) return fail(`Not enough ${r} in the bank`);
    }
    return pass;
  }
  // monopoly
  if (resources.length !== 1) return fail('Choose exactly 1 resource');
  if (!RESOURCES.includes(resources[0] as ResourceKey)) return fail('Invalid resource');
  return pass;
}

/**
 * Apply the validated choice: grant the resources and consume the held card.
 * Assumes `canResolveDevCardChoice` passed.
 */
export function applyResolveDevCardChoice(
  room: GameRoom,
  player: Player,
  resources: string[]
): void {
  const choice = room.devCardChoice!;
  if (choice.card === 'year_of_plenty') {
    for (const r of resources) {
      room.bankSupply[r as ResourceKey]--;
      player.resources[r as ResourceKey]++;
    }
  } else {
    const chosen = resources[0] as ResourceKey;
    for (const other of room.players) {
      if (other.name !== player.name && other.resources[chosen] > 0) {
        player.resources[chosen] += other.resources[chosen];
        other.resources[chosen] = 0;
      }
    }
  }
  player.developmentCards.splice(choice.cardIndex, 1);
  room.devCardChoice = null;
}

/** The three knight effects a pending knight choice accepts. */
export type KnightEffect = 'robber' | 'spawn' | 'cancel';

export function canChooseKnightEffect(
  room: GameRoom,
  player: Player,
  effect: string
): BuildCheck {
  const choice = room.devCardChoice;
  if (!choice || choice.player !== player.name || choice.card !== 'knight') {
    return fail('No pending knight card');
  }
  if (effect !== 'robber' && effect !== 'spawn' && effect !== 'cancel') {
    return fail('Invalid knight effect');
  }
  return pass;
}

/**
 * Apply the knight effect pick. 'robber' hands off to the moveRobber flow
 * (which consumes the card); 'spawn' arms the spawn half of the choice;
 * 'cancel' backs out — the card was only held, so it simply stays in hand.
 */
export function applyChooseKnightEffect(
  room: GameRoom,
  player: Player,
  effect: KnightEffect
): void {
  const choice = room.devCardChoice!;
  if (effect === 'robber') {
    room.devCardChoice = null;
    room.robberMove = { player: player.name, reason: 'knight' };
  } else if (effect === 'spawn') {
    room.devCardChoice = { ...choice, spawn: true };
  } else {
    room.devCardChoice = null;
  }
}

export function canKnightSpawnSoldierAt(
  room: GameRoom,
  player: Player,
  vertexId: VertexId
): BuildCheck {
  const choice = room.devCardChoice;
  if (!room.board || !choice || choice.player !== player.name || choice.card !== 'knight' || !choice.spawn) {
    return fail('No pending knight spawn');
  }
  return canKnightSpawnAt(room.board, player.name, vertexId);
}

/**
 * Apply: a free soldier joins the vertex. Like a recruit it can't move or
 * act this turn (Rule 24), and the held knight is consumed. Where the
 * player's troops there are all aboard a ship, the new soldier joins them
 * aboard — soldiers on foot only ever stand on land.
 * Assumes `canKnightSpawnSoldierAt` passed.
 */
export function applyKnightSpawnSoldier(
  room: GameRoom,
  player: Player,
  vertexId: VertexId
): void {
  const choice = room.devCardChoice!;
  const board = room.board!;
  const soldierId = `soldier_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const mine = Object.values(board.soldiers).filter((s) => s.vertexId === vertexId && s.owner === player.name);
  const onFoot = mine.some((s) => s.aboardShipId === null);
  const shipId = onFoot ? null : (mine[0]?.aboardShipId ?? null);
  board.soldiers[soldierId] = {
    id: soldierId,
    owner: player.name,
    injured: false,
    vertexId,
    type: 'infantry',
    stationed: shipId === null,
    aboardShipId: shipId,
  };
  room.turnState.soldiersCreatedThisTurn.push(soldierId);
  room.turnState.soldiersActedThisTurn.push(soldierId);
  player.developmentCards.splice(choice.cardIndex, 1);
  room.devCardChoice = null;
}
