/**
 * Development-card actions: drawing from the shared deck, playing a card
 * (with per-type effects), resolving a Year-of-Plenty / Monopoly choice,
 * and resolving a Knight (robber move, soldier spawn, or cancel). The rule
 * halves — check then apply — live in common/rules/devCards so the UI and
 * this table share the one rule.
 */
import {
  applyChooseKnightEffect,
  applyDrawDevelopmentCard,
  applyKnightSpawnSoldier,
  applyPlayDevelopmentCard,
  applyResolveDevCardChoice,
  canChooseKnightEffect,
  canDrawDevelopmentCard,
  canKnightSpawnSoldierAt,
  canPlayDevelopmentCard,
  canResolveDevCardChoice,
  GameRoom,
  KnightEffect,
  Player,
} from 'common';
import type { ActionEntry } from '../dispatch';
import { freezeWhileBusy } from './boardFreeze';

export const DEVCARD_ACTIONS: Record<string, ActionEntry> = freezeWhileBusy({
  // Draw a development card from the shared deck. Costs 1 wheat, 1 sheep
  // and 1 ore (DevelopmentCardPrice) — the standard Catan price.
  drawDevelopmentCard: {
    run: (room: GameRoom, player: Player, _payload: { roomId: string }) => {
      const check = canDrawDevelopmentCard(room, player.name);
      if (!check.allowed) {
        return { error: check.reason ?? 'Cannot buy a development card' };
      }
      applyDrawDevelopmentCard(room, player);
    },
  },

  // Play a development card from your hand. Only allowed on your own turn.
  // Effects vary by card type (see Rules.md).
  playDevelopmentCard: {
    run: (
      room: GameRoom,
      player: Player,
      { cardIndex }: { roomId: string; cardIndex: number }
    ) => {
      const check = canPlayDevelopmentCard(room, player, cardIndex);
      if (!check.allowed) {
        return { error: check.reason ?? 'Cannot play this card' };
      }
      applyPlayDevelopmentCard(room, player, cardIndex);
    },
  },

  // Resolve a pending development-card choice (Year of Plenty / Monopoly).
  resolveDevCardChoice: {
    run: (
      room: GameRoom,
      player: Player,
      { resources }: { roomId: string; resources: string[] }
    ) => {
      const check = canResolveDevCardChoice(room, player, resources);
      if (!check.allowed) {
        return { error: check.reason ?? 'Cannot resolve card choice' };
      }
      applyResolveDevCardChoice(room, player, resources);
    },
  },

  // Knight: pick the effect. 'robber' hands off to the moveRobber flow
  // (which consumes the card); 'spawn' waits for knightSpawnSoldier;
  // 'cancel' backs out — the card was only held, so it stays in the hand.
  // Re-picking is allowed until the knight resolves (e.g. leave spawn mode).
  chooseKnightEffect: {
    run: (
      room: GameRoom,
      player: Player,
      { effect }: { roomId: string; effect: string }
    ) => {
      const check = canChooseKnightEffect(room, player, effect);
      if (!check.allowed) {
        return { error: check.reason ?? 'Cannot choose knight effect' };
      }
      applyChooseKnightEffect(room, player, effect as KnightEffect);
    },
  },

  // Knight spawn: a free soldier joins a vertex where the player already
  // has a soldier. Like a recruit, it can't move or act this turn (Rule 24).
  knightSpawnSoldier: {
    run: (
      room: GameRoom,
      player: Player,
      { vertexId }: { roomId: string; vertexId: string }
    ) => {
      const check = canKnightSpawnSoldierAt(room, player, vertexId);
      if (!check.allowed) {
        return { error: check.reason ?? 'Cannot spawn a soldier here' };
      }
      applyKnightSpawnSoldier(room, player, vertexId);
    },
  },
}, ['knightSpawnSoldier']);
