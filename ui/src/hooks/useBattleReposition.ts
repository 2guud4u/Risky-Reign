import React, { useRef, useState } from 'react';
import { BattleState, Board, PixelCoord, Player, roadNeighbors } from 'common';
import { RepositionTroop } from '../types/battleModal';
import { injuredTroopsOf } from '../utils/battleModal';
import { DROP_TARGET_RING_R } from '../constants';

/** Pointer travel (px, screen) before a press on a troop becomes a drag. */
const DRAG_THRESHOLD_PX = 4;
/** Drop radius around a target vertex, in multiples of the target ring. */
const DROP_RADIUS_SCALE = 2.2;

/**
 * Post-battle repositioning, on the battle mini-map. Injured survivors wait on
 * the battle vertex; on your turn your next one is picked automatically, so
 * its road-adjacent targets light up straight away. Move it by dragging it
 * onto a lit vertex, or by clicking a lit vertex. Pressing another of your
 * troops picks it (and starts dragging it). Once your last troop has moved,
 * your turn is finished for you. Owns the mini-map svg ref, the selection
 * and the drag.
 */
export function useBattleReposition(opts: {
  board: Board | null;
  battle: BattleState | null;
  currentPlayer: Player | null;
  roomId: string | undefined;
  repositionSoldier: (playerId: string, soldierId: string, targetVertexId: string, roomId: string) => void;
  finishRepositioning: (playerId: string, roomId: string) => void;
}) {
  const { board, battle, currentPlayer, roomId, repositionSoldier, finishRepositioning } = opts;

  const svgRef = useRef<SVGSVGElement>(null);
  // The troop the player picked; falls back to their first waiting troop.
  const [pickedId, setPickedId] = useState<string | null>(null);
  // The press on a troop (screen coords) and, once it moves far enough, the
  // ghost's position in SVG space.
  const press = useRef<{ soldierId: string; x: number; y: number } | null>(null);
  const [ghost, setGhost] = useState<PixelCoord | null>(null);

  const injuredTroops: RepositionTroop[] = battle && board ? injuredTroopsOf(battle, board) : [];
  // Troops still waiting on the battle vertex, and those already moved.
  const stagedTroops = injuredTroops.filter((t) => t.vertexId === battle?.vertexId);
  const placedTroops = injuredTroops.filter((t) => t.vertexId !== battle?.vertexId);

  // Whose turn it is to move (attacker first), by player name.
  const turn = battle?.phase === 'repositioning' ? battle.repositionTurn ?? null : null;
  const moverName = turn === 'attacker' ? battle?.attacker : turn === 'defender' ? battle?.defender : undefined;
  const isMyRepositionTurn = !!currentPlayer && !!moverName && moverName === currentPlayer.name;

  // My troops still to move, and the one currently selected.
  const myStaged = isMyRepositionTurn ? stagedTroops.filter((t) => t.ownerName === currentPlayer!.name) : [];
  const selectedTroop = myStaged.find((t) => t.soldierId === pickedId) ?? myStaged[0] ?? null;
  const validTargets = selectedTroop && board ? roadNeighbors(board, selectedTroop.vertexId) : [];

  /** Screen point → SVG (board) coordinates of the mini-map. */
  const toSvg = (clientX: number, clientY: number): PixelCoord | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  /** The lit target under an SVG point (within the drop radius), if any. */
  const targetAt = (p: PixelCoord): string | null => {
    if (!board) return null;
    let best: string | null = null;
    let bestDist = DROP_TARGET_RING_R * DROP_RADIUS_SCALE;
    for (const id of validTargets) {
      const v = board.vertices[id]?.position;
      if (!v) continue;
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d <= bestDist) {
        best = id;
        bestDist = d;
      }
    }
    return best;
  };

  /** Move the selected troop to a lit vertex; the last move also ends my turn. */
  const assignTo = (vertexId: string) => {
    if (!selectedTroop || !currentPlayer || !roomId || !validTargets.includes(vertexId)) return;
    repositionSoldier(currentPlayer.id, selectedTroop.soldierId, vertexId, roomId);
    setPickedId(null);
    // Socket.io keeps per-connection order, so the server sees the move first.
    if (myStaged.length === 1) finishRepositioning(currentPlayer.id, roomId);
  };

  /** Press on one of my waiting troops: pick it, and arm a drag. */
  const startTroopPress = (troop: RepositionTroop, e: React.MouseEvent) => {
    if (!myStaged.some((t) => t.soldierId === troop.soldierId)) return;
    e.stopPropagation();
    setPickedId(troop.soldierId);
    press.current = { soldierId: troop.soldierId, x: e.clientX, y: e.clientY };
  };

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const p = press.current;
    if (!p) return;
    if (!ghost && Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_THRESHOLD_PX) return;
    setGhost(toSvg(e.clientX, e.clientY));
  };

  const endDrag = (e?: React.MouseEvent<SVGSVGElement>) => {
    const dragging = !!ghost;
    press.current = null;
    setGhost(null);
    if (!dragging || !e) return;
    const p = toSvg(e.clientX, e.clientY);
    const target = p && targetAt(p);
    if (target) assignTo(target);
  };

  return {
    svgRef,
    stagedTroops,
    placedTroops,
    moverName,
    isMyRepositionTurn,
    myStagedCount: myStaged.length,
    selectedTroop,
    validTargets,
    assignTo,
    startTroopPress,
    /** Drag ghost position (SVG space) and the target it's over, while dragging. */
    drag: ghost ? { at: ghost, overTarget: targetAt(ghost) } : null,
    /** Mouse handlers for the mini-map svg. */
    svgHandlers: { onMouseMove, onMouseUp: endDrag, onMouseLeave: () => endDrag() },
  };
}
