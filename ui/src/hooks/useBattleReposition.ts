import React, { useRef, useState } from 'react';
import { BattleState, Board, Player } from 'common';
import { RepositionDrag, RepositionTroop } from '../types/battleModal';
import { adjacentViaRoad, injuredTroopsOf } from '../utils/battleModal';
import { DROP_THRESHOLD_FRACTION, PROJ_SIZE } from '../constants';

/**
 * Post-battle repositioning: drag injured soldiers to adjacent vertices along
 * existing roads. Owns the mini-map svg ref, the in-flight drag state, the
 * cursor position (for the drag ghost), and the mouse handlers that resolve a
 * drop onto the nearest valid target vertex. Injured survivors are exposed as
 * `injuredTroops`, keyed by their current resting vertex.
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
  const [drag, setDrag] = useState<RepositionDrag | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const injuredTroops: RepositionTroop[] =
    battle && board ? injuredTroopsOf(battle, board) : [];

  const startRepositionDrag = (
    e: React.MouseEvent,
    soldierId: string,
    ownerName: string,
    vertexId: string
  ) => {
    // Only the owner may reposition their own injured troops, and only
    // while it is their side's repositioning turn (attacker first).
    if (!battle || !board || currentPlayer?.name !== ownerName) return;
    const turn = battle.repositionTurn;
    if (turn !== undefined && turn !== null) {
      const isAttacker = currentPlayer.name === battle.attacker;
      const isDefender = currentPlayer.name === battle.defender;
      if (!isAttacker && !isDefender) return;
      if (turn !== (isAttacker ? 'attacker' : 'defender')) return;
    }
    e.stopPropagation();
    setDrag({ soldierId, ownerName, fromVertexId: vertexId, validTargets: adjacentViaRoad(board, vertexId) });
  };

  // Map a mouse event to the mini-map SVG's world coordinates.
  const toMiniSvgCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const handleMiniMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drag) return;
    setMousePos(toMiniSvgCoords(e));
  };

  const handleMiniMouseUp = () => {
    if (!drag || !mousePos || !currentPlayer || !board || !roomId) {
      setDrag(null);
      setMousePos(null);
      return;
    }
    // Drop on the nearest valid target vertex within reach.
    let best: string | null = null;
    let bestDist = Infinity;
    for (const tid of drag.validTargets) {
      const v = board.vertices[tid];
      if (!v) continue;
      const d = Math.hypot(v.position.x - mousePos.x, v.position.y - mousePos.y);
      if (d < bestDist) {
        bestDist = d;
        best = tid;
      }
    }
    const threshold = PROJ_SIZE * DROP_THRESHOLD_FRACTION;
    if (best && bestDist <= threshold) {
      repositionSoldier(currentPlayer.id, drag.soldierId, best, roomId);
    }
    setDrag(null);
    setMousePos(null);
  };

  const handleMiniMouseLeave = () => {
    setDrag(null);
    setMousePos(null);
  };

  return {
    svgRef,
    drag,
    mousePos,
    injuredTroops,
    startRepositionDrag,
    handleMiniMouseMove,
    handleMiniMouseUp,
    handleMiniMouseLeave,
  };
}
