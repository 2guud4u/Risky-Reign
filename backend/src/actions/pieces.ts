/**
 * Piece actions: cannons (upgrade/station/attack), walls (upgrade + the
 * gate crossing handshake), and ships (build/move/embark/disembark/settle).
 * All rules — eligibility, mutation, undo entries — live in common/rules;
 * these handlers run the check, roll any server-side dice the apply needs
 * (rolls are passed in, never generated inside common, so outcomes stay
 * broadcast-able), then apply. The wall-gate pair runs while a pending is
 * active: `wallGuess` is the crosser's prompt, `rollWallGate` the wall
 * owner's — both gate on the seats inside `room.wallGate`, not the acting
 * turn.
 */
import {
  applyCannonAttack,
  applyCannonAttackWall,
  applyCannonSplash,
  applyConvertShipToSettlement,
  applyDowngradeCannon,
  applyBuildShip,
  applyDisembarkSoldier,
  applyEmbarkSoldier,
  applyMoveShip,
  applyRollWallGate,
  applyStationCannon,
  applyUnstationCannon,
  applyUpgradeCannon,
  applyUpgradeRoadToWall,
  applyWallGuess,
  canCannonAttack,
  canCannonAttackWall,
  canCannonSplash,
  canConvertShipToSettlement,
  canDowngradeCannon,
  canBuildShip,
  canDisembarkSoldier,
  canEmbarkSoldier,
  canMoveShip,
  canRollWallGate,
  canStationCannon,
  canUnstationCannon,
  canUpgradeCannon,
  canUpgradeRoadToWall,
  canWallGuess,
  GameRoom,
  Player,
  rollDie,
} from 'common';
import type { ActionEntry } from '../dispatch';

const fail = (error: string) => ({ error });
const newId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const PIECE_ACTIONS: Record<string, ActionEntry> = {
  // --- Cannons (Action phase; the can* carry the phase/turn/seat gates) ---
  upgradeCannon: {
    run: (room: GameRoom, player: Player, { soldierId }: { roomId: string; soldierId: string }) => {
      const check = canUpgradeCannon(room, player, soldierId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot upgrade to a cannon');
      applyUpgradeCannon(room, player, soldierId);
    },
  },
  downgradeCannon: {
    run: (room: GameRoom, player: Player, { soldierId }: { roomId: string; soldierId: string }) => {
      const check = canDowngradeCannon(room, player, soldierId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot downgrade this cannon');
      applyDowngradeCannon(room, player, soldierId);
    },
  },
  stationCannon: {
    run: (room: GameRoom, player: Player, { soldierId }: { roomId: string; soldierId: string }) => {
      const check = canStationCannon(room, player, soldierId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot station this cannon');
      applyStationCannon(room, player, soldierId);
    },
  },
  unstationCannon: {
    run: (room: GameRoom, player: Player, { soldierId }: { roomId: string; soldierId: string }) => {
      const check = canUnstationCannon(room, player, soldierId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot unstation this cannon');
      applyUnstationCannon(room, player, soldierId);
    },
  },
  cannonAttack: {
    run: (
      room: GameRoom,
      player: Player,
      { soldierId, targetSoldierId }: { roomId: string; soldierId: string; targetSoldierId: string }
    ) => {
      const check = canCannonAttack(room, player, soldierId, targetSoldierId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot fire on that target');
      applyCannonAttack(room, player, soldierId, targetSoldierId, rollDie(), rollDie());
    },
  },
  cannonSplash: {
    run: (
      room: GameRoom,
      player: Player,
      { soldierId, vertexId }: { roomId: string; soldierId: string; vertexId: string }
    ) => {
      const check = canCannonSplash(room, player, soldierId, vertexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot splash that vertex');
      // One server-rolled d6 per victim on the target vertex.
      const victimRolls: Record<string, number> = {};
      for (const s of Object.values(room.board?.soldiers ?? {})) {
        if (s.vertexId === vertexId && s.id !== soldierId) victimRolls[s.id] = rollDie();
      }
      applyCannonSplash(room, player, soldierId, vertexId, rollDie(), victimRolls);
    },
  },
  cannonAttackWall: {
    run: (
      room: GameRoom,
      player: Player,
      { soldierId, edgeId }: { roomId: string; soldierId: string; edgeId: string }
    ) => {
      const check = canCannonAttackWall(room, player, soldierId, edgeId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot fire on that wall');
      applyCannonAttackWall(room, player, soldierId, edgeId, rollDie());
    },
  },

  // --- Walls ---
  // Build-phase upgrade; phase/turn gates live in canUpgradeRoadToWall.
  upgradeRoadToWall: {
    run: (room: GameRoom, player: Player, { edgeId }: { roomId: string; edgeId: string }) => {
      const check = canUpgradeRoadToWall(room, player, edgeId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot fortify that road');
      applyUpgradeRoadToWall(room, player, edgeId);
    },
  },
  // Pending participant: the crosser submits their 1-6 guess while the gate
  // is open (canWallGate checks the seat, not the acting turn).
  wallGuess: {
    run: (room: GameRoom, player: Player, { guess }: { roomId: string; guess: number }) => {
      const check = canWallGuess(room, player, guess);
      if (!check.allowed) return fail(check.reason ?? 'Cannot guess now');
      applyWallGuess(room, player, guess);
    },
  },
  // Pending participant: the wall owner triggers the resolving roll (the
  // server supplies the d6). The 30s auto-roll timer lives in
  // wallGateTimer.ts and calls this same apply path.
  rollWallGate: {
    run: (room: GameRoom, player: Player, _payload: { roomId: string }) => {
      const check = canRollWallGate(room, player);
      if (!check.allowed) return fail(check.reason ?? 'Cannot roll the gate now');
      applyRollWallGate(room, player, rollDie());
    },
  },

  // --- Ships ---
  buildShip: {
    run: (room: GameRoom, player: Player, { vertexId }: { roomId: string; vertexId: string }) => {
      const check = canBuildShip(room, player, vertexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot build a ship there');
      applyBuildShip(room, player, vertexId, newId('ship'));
    },
  },
  moveShip: {
    run: (
      room: GameRoom,
      player: Player,
      { shipId, vertexId }: { roomId: string; shipId: string; vertexId: string }
    ) => {
      const check = canMoveShip(room, player, shipId, vertexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot move that ship');
      applyMoveShip(room, player, shipId, vertexId);
    },
  },
  embarkSoldier: {
    run: (
      room: GameRoom,
      player: Player,
      { soldierId, shipId }: { roomId: string; soldierId: string; shipId: string }
    ) => {
      const check = canEmbarkSoldier(room, player, soldierId, shipId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot embark there');
      applyEmbarkSoldier(room, player, soldierId, shipId);
    },
  },
  disembarkSoldier: {
    run: (
      room: GameRoom,
      player: Player,
      { soldierId, vertexId }: { roomId: string; soldierId: string; vertexId: string }
    ) => {
      const check = canDisembarkSoldier(room, player, soldierId, vertexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot disembark there');
      applyDisembarkSoldier(room, player, soldierId, vertexId);
    },
  },
  convertShipToSettlement: {
    run: (
      room: GameRoom,
      player: Player,
      { shipId, vertexId }: { roomId: string; shipId: string; vertexId: string }
    ) => {
      const check = canConvertShipToSettlement(room, player, shipId, vertexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot settle that ship');
      applyConvertShipToSettlement(room, player, shipId, vertexId, newId('s'));
    },
  },
};
