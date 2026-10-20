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
  applyFireRangedShot,
  applyFireWallShot,
  applyRollCannonShot,
  applyConvertShipToSettlement,
  applyDowngradeCannon,
  applyBuildShip,
  applyDisembarkSoldier,
  applyEmbarkSoldier,
  applyMoveShip,
  applyRollWallGate,
  applyRollWallShot,
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
  canRollWallShot,
  canRollCannonShot,
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
import { freezeWhileBusy } from './boardFreeze';

const fail = (error: string) => ({ error });
const newId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const PIECE_ACTIONS: Record<string, ActionEntry> = freezeWhileBusy({
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
      // Committed on fire: the duel opens pending — the shooter rolls the
      // cannon die and the victim's owner rolls theirs via rollCannonShot.
      const vertexId = room.board!.soldiers[targetSoldierId]!.vertexId;
      applyFireRangedShot(room, player, soldierId, [targetSoldierId], vertexId, false);
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
      // Every soldier on the vertex (the firing cannon excluded) owes a die.
      const victimIds = Object.values(room.board!.soldiers)
        .filter((s) => s.vertexId === vertexId && s.id !== soldierId)
        .map((s) => s.id);
      applyFireRangedShot(room, player, soldierId, victimIds, vertexId, true);
    },
  },
  cannonAttackWall: {
    run: (
      room: GameRoom,
      player: Player,
      { soldierId, edgeId, explosive }: { roomId: string; soldierId: string; edgeId: string; explosive?: boolean }
    ) => {
      const check = canCannonAttackWall(room, player, soldierId, edgeId, explosive === true);
      if (!check.allowed) return fail(check.reason ?? 'Cannot fire on that wall');
      // Committed on fire: a Single shot opens pending (the breach lands in
      // rollWallShot), an Explosive shot resolves on the spot.
      applyFireWallShot(room, player, soldierId, edgeId, explosive === true);
    },
  },
  // Pending participant: the shooter rolls their breach die on the pending
  // Single shot (canRollWallShot checks the seat on room.cannonShot). The
  // server also rolls for them after WALL_SHOT_ROLL_MS (cannonShotTimer).
  rollWallShot: {
    run: (room: GameRoom, player: Player) => {
      const check = canRollWallShot(room, player);
      if (!check.allowed) return fail(check.reason ?? 'Cannot roll now');
      applyRollWallShot(room, player, rollDie());
    },
  },

  // Pending participant: a die on the open ranged shot — `soldierId` null is
  // the cannon's die (shooter only), otherwise that victim's die (owner
  // only). The server also rolls owed dice after the cannon-shot deadline.
  rollCannonShot: {
    run: (room: GameRoom, player: Player, { soldierId }: { roomId: string; soldierId?: string | null }) => {
      const target = soldierId ?? null;
      const check = canRollCannonShot(room, player, target);
      if (!check.allowed) return fail(check.reason ?? 'Cannot roll now');
      applyRollCannonShot(room, player, target, rollDie());
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
}, [
  'upgradeCannon',
  'downgradeCannon',
  'stationCannon',
  'unstationCannon',
  'cannonAttack',
  'cannonSplash',
  'cannonAttackWall',
  'upgradeRoadToWall',
  'buildShip',
  'moveShip',
  'embarkSoldier',
  'disembarkSoldier',
  'convertShipToSettlement',
]);
