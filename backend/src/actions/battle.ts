/**
 * Battle actions: starting an attack, rolling battle dice, driving the
 * battle (continue/end), repositioning injured survivors, dismissing the
 * battle window, and the post-win robber move. Check + commit halves live
 * in common (`utils/battle` decides, `rules/battle` commits) — the
 * robber-fight result is returned as a GameEffect the dispatch adapter
 * performs.
 */
import {
  canStartBattle,
  createBattleState,
  canRollBattleDie,
  rollBattleDie,
  allSoldiersRolled,
  resolveBattleRoundIfComplete,
  applyRobberFightOutcome,
  canDriveBattle,
  applyContinueBattle,
  applyEndBattle,
  canMoveRobberAfterWin,
  applyMoveRobberAfterWin,
  roadNeighbors,
  injuredLeftToMove,
  nextRepositionTurn,
  GameEffect,
  GameRoom,
  Player,
} from 'common';
import { passKnockedOutTurn } from '../turn';
import type { ActionEntry } from '../dispatch';

const fail = (error: string) => ({ error });

export const BATTLE_ACTIONS: Record<string, ActionEntry> = {
  // Begin an attack on a vertex (or a robber fight): creates the battle
  // state and moves the room into battle.
  startAttack: {
    run: (
      room: GameRoom,
      currentPlayer: Player,
      { soldierIds, targetVertexId, defenderName }: {
        roomId: string;
        soldierIds: string[];
        targetVertexId: string;
        defenderName?: string;
      }
    ) => {
      const board = room.board;
      if (!board) return fail('Game board is not available');
      const turnState = room.turnState;
      // A battle can only be started during the Action phase, on your turn.
      if (turnState.phase !== 'Action' || turnState.player !== currentPlayer.name) {
        return fail('You can only start a battle on your turn in the Action phase');
      }
      // A battle can only be started if no battle is already in progress.
      if (room.battleState) return fail('A battle is already in progress');

      // Authoritative rules live in common (shared with the UI).
      const check = canStartBattle(room, currentPlayer.name, soldierIds, targetVertexId, defenderName);
      if (!check.allowed) return fail(check.reason ?? 'Cannot start a battle here');

      // Create the battle state and move to the battle phase.
      room.battleState = createBattleState(room, currentPlayer.name, soldierIds, targetVertexId, defenderName);

      // Track the soldiers as having acted (Rules.md line 30).
      for (const sid of soldierIds) {
        turnState.soldiersActedThisTurn.push(sid);
      }
    },
  },

  // Roll the die for one soldier during the rolling phase; once every
  // soldier on both sides has rolled, the round resolves.
  rollBattleDie: {
    run: (room: GameRoom, currentPlayer: Player, { soldierId }: { roomId: string; soldierId: string }) => {
      const board = room.board;
      if (!board || !room.battleState) return fail('No battle in progress');
      if (room.battleState.phase !== 'rolling') {
        return fail('The battle is not in the rolling phase');
      }
      const battle = room.battleState;
      if (!canRollBattleDie(battle, currentPlayer.name, soldierId)) {
        return fail('Cannot roll for this soldier');
      }

      // Roll the die and record the result.
      rollBattleDie(battle, currentPlayer.name, soldierId);

      let effects: GameEffect[] | undefined;
      // Once every soldier on both sides has rolled, resolve the round:
      // compute casualties and move to the betweenRounds phase.
      if (allSoldiersRolled(battle)) {
        room.battleState = resolveBattleRoundIfComplete(battle).updatedBattleState;
        // Robber fight: a single round. Once resolved, apply the outcome
        // (win → take the bag; lose → the soldier is killed) and end the
        // battle so the player can dismiss it.
        if (battle.robberFight) {
          effects = applyRobberFightOutcome(room, battle);
          room.battleState = {
            ...room.battleState,
            phase: 'repositioning',
            repositionTurn: nextRepositionTurn(board, battle, null),
          };
        }
      }
      return effects ? { effects } : undefined;
    },
  },

  // Move one injured soldier off the battle vertex along a road to a
  // neighboring vertex. Each troop moves exactly one step.
  repositionSoldier: {
    run: (
      room: GameRoom,
      currentPlayer: Player,
      { soldierId, targetVertexId }: { roomId: string; soldierId: string; targetVertexId: string }
    ) => {
      const board = room.board;
      if (!board || !room.battleState) return fail('No battle in progress');
      if (room.battleState.phase !== 'repositioning') {
        return fail('The battle is not in the repositioning phase');
      }
      // The attacker repositions first; only the side whose turn it is may
      // move (Rules.md: "attacker gets to move injured soldiers away first").
      const turn = room.battleState.repositionTurn;
      if (turn !== undefined && turn !== null) {
        const isAttacker = currentPlayer.name === room.battleState.attacker;
        const isDefender = currentPlayer.name === room.battleState.defender;
        if (!isAttacker && !isDefender) {
          return fail('Only a battle participant can reposition injured soldiers');
        }
        if (turn !== (isAttacker ? 'attacker' : 'defender')) {
          return fail('It is not your turn to reposition injured soldiers');
        }
      }
      const soldier = board.soldiers[soldierId];
      if (!soldier || soldier.owner !== currentPlayer.name) {
        return fail('You cannot move that soldier');
      }
      // Must be one of this battle's injured survivors still on the battle
      // vertex (each troop gets exactly one step away).
      if (!(room.battleState.injuredSettled ?? {})[soldierId]) {
        return fail('Only injured soldiers from this battle can be moved');
      }
      if (soldier.vertexId !== room.battleState.vertexId) {
        return fail('This soldier has already moved away from the battle');
      }
      // Destination must be adjacent via an existing road.
      if (!roadNeighbors(board, soldier.vertexId).includes(targetVertexId)) {
        return fail('That vertex is not reachable by a road from this soldier');
      }
      soldier.vertexId = targetVertexId;
      soldier.stationed = false;
      room.battleState.injuredSettled = { ...room.battleState.injuredSettled, [soldierId]: targetVertexId };
    },
  },

  // The side whose repositioning turn it is signals they are done moving
  // their injured troops; the turn passes to the other side if they have
  // injured troops to move (Rules.md: the attacker moves first).
  finishRepositioning: {
    run: (room: GameRoom, currentPlayer: Player) => {
      if (!room.battleState) return fail('No battle in progress');
      if (room.battleState.phase !== 'repositioning') {
        return fail('The battle is not in the repositioning phase');
      }
      const turn = room.battleState.repositionTurn;
      if (turn === undefined || turn === null) {
        return fail('Repositioning is already finished');
      }
      const isAttacker = currentPlayer.name === room.battleState.attacker;
      const isDefender = currentPlayer.name === room.battleState.defender;
      if (!isAttacker && !isDefender) {
        return fail('Only a battle participant can finish repositioning');
      }
      if (turn !== (isAttacker ? 'attacker' : 'defender')) {
        return fail('It is not your turn to reposition injured soldiers');
      }
      // All of this side's injured troops must be moved off the battle
      // vertex before the player can confirm (unless there is no road out).
      const mySide = isAttacker ? room.battleState.attacker : room.battleState.defender;
      if (injuredLeftToMove(room.board!, room.battleState, mySide).length > 0) {
        return fail('Move all your injured troops before confirming');
      }
      const next = nextRepositionTurn(room.board!, room.battleState, turn);
      room.battleState = { ...room.battleState, repositionTurn: next };
    },
  },

  // Dismiss the battle window once the outcome has been seen. While
  // repositioning is pending (an injured troop still has to move off the
  // battle vertex) the window cannot be dismissed: injured troops MUST
  // leave unless there is no road out. Open: any socket may dismiss it —
  // spectators watching the battle need the window to close too.
  exitBattle: {
    open: (room: GameRoom) => {
      const bs = room.battleState;
      if (!bs || (bs.phase !== 'finished' && bs.phase !== 'repositioning')) {
        return { broadcast: false };
      }
      if (bs.phase === 'repositioning' && bs.repositionTurn) {
        return fail('Injured troops must be moved before the battle can be closed');
      }
      // A pending post-win robber move (robberDefeatedBy) survives the
      // dismissal — it is resolved by `moveRobberAfterWin`, or expires when
      // the Action phase advances. Only clear the battle state itself.
      room.battleState = null;
      passKnockedOutTurn(room);
    },
  },

  // Continue the battle to the next round: applies the resolved round's
  // casualties to the board, then either ends the battle (if a side has no
  // living troops left, entering repositioning) or resets all rolls and
  // starts the next round.
  continueBattle: {
    run: (room: GameRoom, currentPlayer: Player) => {
      // Only the attacker can continue a battle (Rules.md line 7), and only
      // once the round has been resolved (betweenRounds).
      const check = canDriveBattle(room, currentPlayer.name);
      if (!check.allowed) return fail(check.reason ?? 'Cannot continue this battle');
      applyContinueBattle(room);
    },
  },

  // The attacker may end the battle after any resolved round — even while
  // both sides still have troops. Ending while undecided is a forfeit: the
  // attacker is marked as having fled and the defender is credited the win.
  endBattle: {
    run: (room: GameRoom, currentPlayer: Player) => {
      const check = canDriveBattle(room, currentPlayer.name);
      if (!check.allowed) {
        return fail(
          check.reason === 'Only the attacker can continue this battle'
            ? 'Only the attacker can end this battle'
            : check.reason ?? 'Cannot end this battle'
        );
      }
      applyEndBattle(room);
    },
  },

  // The winner of a robber fight moves the robber to a hex adjacent to its
  // current position (Rules.md: "after the robber is defeated, the winner
  // can move the robber to any adjacent hex").
  moveRobberAfterWin: {
    run: (room: GameRoom, player: Player, { hexId }: { roomId: string; hexId: string }) => {
      const check = canMoveRobberAfterWin(room, player.name, hexId);
      if (!check.allowed) return fail(check.reason ?? 'Cannot move the robber there');
      applyMoveRobberAfterWin(room, hexId);
    },
  },
};
