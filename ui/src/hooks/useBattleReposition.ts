import { useRef, useState } from 'react';
import { BattleState, Board, Player } from 'common';
import { RepositionTroop } from '../types/battleModal';
import { adjacentViaRoad, injuredTroopsOf } from '../utils/battleModal';

/**
 * Post-battle repositioning (click-to-assign): injured survivors collect in a
 * staging column on the left of the battle window. The active player clicks a
 * troop to select it — its valid destinations (road-adjacent vertices) light up
 * on the mini-map — then clicks a lit vertex to place the troop. Troops already
 * moved stack on their target vertex. Owns the mini-map svg ref and the
 * selection state; `injuredTroops` lists survivors keyed by their resting vertex.
 */
export function useBattleReposition(opts: {
  board: Board | null;
  battle: BattleState | null;
  currentPlayer: Player | null;
  roomId: string | undefined;
  repositionSoldier: (playerId: string, soldierId: string, targetVertexId: string, roomId: string) => void;
}) {
  const { board, battle, currentPlayer, roomId, repositionSoldier } = opts;

  const svgRef = useRef<SVGSVGElement>(null);
  // The currently-selected staged troop and the vertices it may move to.
  const [selected, setSelected] = useState<{ soldierId: string; validTargets: string[] } | null>(null);

  const injuredTroops: RepositionTroop[] =
    battle && board ? injuredTroopsOf(battle, board) : [];

  // Troops still waiting at the battle vertex — shown in the left staging rail.
  const stagedTroops = injuredTroops.filter((t) => t.vertexId === battle?.vertexId);
  // Troops already placed on a different vertex — stacked on the map.
  const placedTroops = injuredTroops.filter((t) => t.vertexId !== battle?.vertexId);

  /** Whether it's this player's turn to reposition (attacker moves first). */
  const isMyRepositionTurn = (): boolean => {
    if (!battle || !currentPlayer) return false;
    const turn = battle.repositionTurn;
    if (turn === undefined || turn === null) return true;
    const isAttacker = currentPlayer.name === battle.attacker;
    const isDefender = currentPlayer.name === battle.defender;
    if (!isAttacker && !isDefender) return false;
    return turn === (isAttacker ? 'attacker' : 'defender');
  };

  /** Select a staged troop (owner + turn gated). Toggles off if re-clicked. */
  const selectTroop = (troop: RepositionTroop) => {
    if (!battle || !board || !isMyRepositionTurn()) return;
    if (currentPlayer?.name !== troop.ownerName) return;
    if (selected?.soldierId === troop.soldierId) {
      setSelected(null);
      return;
    }
    setSelected({ soldierId: troop.soldierId, validTargets: adjacentViaRoad(board, troop.vertexId) });
  };

  /** Place the selected troop onto a target vertex. */
  const assignTo = (vertexId: string) => {
    if (!selected || !currentPlayer || !roomId) return;
    if (!selected.validTargets.includes(vertexId)) return;
    repositionSoldier(currentPlayer.id, selected.soldierId, vertexId, roomId);
    setSelected(null);
  };

  return {
    svgRef,
    injuredTroops,
    stagedTroops,
    placedTroops,
    selected,
    selectTroop,
    assignTo,
    isMyRepositionTurn,
  };
}
