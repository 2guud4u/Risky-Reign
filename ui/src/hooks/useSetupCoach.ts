import { useMemo } from 'react';
import { Board, PixelCoord, canBuildRoadOn, canBuildSettlementAt } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useTutorialHints } from '../utils/tutorial';

/** One coaching step: what to do, and where on the board to point. */
export interface CoachStep {
  key: 'settlement' | 'road';
  /** The suggested vertex (settlement) or edge (road) id. */
  targetId: string;
  /** Board point the finger points at (a vertex, or an edge midpoint). */
  at: PixelCoord;
  /** Short caption drawn above the finger. */
  caption: string;
  /** Side-card text explaining the step. */
  title: string;
  body: string;
  /** Whether the matching build bubble is open (the finger moves to it). */
  bubbleOpen: boolean;
}

/**
 * Setup coach: while it's my SetUp turn (and hints are on), pick the next
 * thing to place and one legal spot for it — the same shared rule checks the
 * server enforces, so the suggestion is always valid. The settlement spot is
 * random but stable for the turn (seeded by the setup offset); the road hint
 * points at an edge touching the settlement just placed. Returns null when
 * there's nothing to coach.
 */
export function useSetupCoach(board: Board | null): CoachStep | null {
  const { gameRoom, currentPlayer, selectedObject } = useGameRoom();
  const hintsOn = useTutorialHints();
  const turn = gameRoom?.turnState;
  const active =
    hintsOn &&
    !!board &&
    !!turn &&
    !!currentPlayer &&
    gameRoom?.gameStatus === 'playing' &&
    turn.phase === 'SetUp' &&
    turn.player === currentPlayer.name;
  const name = currentPlayer?.name ?? '';

  // Candidate spots are recomputed only when the board or the step changes,
  // not on every hover/selection render.
  const step = useMemo(() => {
    if (!active || !board || !turn) return null;
    if (!turn.placedSettlement) {
      const legal = Object.keys(board.vertices).filter(
        (id) => canBuildSettlementAt(board, turn, name, id).allowed
      );
      if (legal.length === 0) return null;
      // Stable per turn: the same spot until the offset (turn) changes.
      const id = legal[(turn.offset * 7919) % legal.length];
      return { key: 'settlement' as const, id, at: board.vertices[id].position };
    }
    if (!turn.placedRoad) {
      const legal = Object.keys(board.edges).filter((id) => canBuildRoadOn(board, turn, name, id).allowed);
      if (legal.length === 0) return null;
      const id = legal[0];
      const e = board.edges[id];
      const a = board.vertices[e.vertexAId].position;
      const b = board.vertices[e.vertexBId].position;
      return { key: 'road' as const, id, at: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
    return null;
  }, [active, board, turn, name]);

  if (!step) return null;
  const firstRound = (turn?.offset ?? 0) < (turn?.playerOrder.length ?? 1);
  // The coach's spot (or any other spot of the right kind) is selected: the
  // matching build bubble is on screen, so point at it instead.
  const bubbleOpen = selectedObject?.type === (step.key === 'settlement' ? 'vertex' : 'edge');
  return step.key === 'settlement'
    ? {
        key: 'settlement',
        targetId: step.id,
        at: step.at,
        caption: 'Click here',
        title: firstRound ? 'Place your first settlement' : 'Place your second settlement',
        body:
          'Click the blue ring to pick that corner — or click any other corner you like. Settlements earn resources from the hexes they touch, so corners next to common numbers (6, 8, 5, 9) pay out the most.',
        bubbleOpen,
      }
    : {
        key: 'road',
        targetId: step.id,
        at: step.at,
        caption: 'Click here',
        title: 'Now place a road',
        body: 'Roads must touch your new settlement. Click the blue ring — or any other edge next to it — then confirm. Roads let you expand to new corners later.',
        bubbleOpen,
      };
}
