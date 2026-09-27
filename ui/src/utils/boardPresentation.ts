import { Board, BoardUIState, PortType } from 'common';
import { PORT_DOCK_MAX_VERTICES } from '../constants';
import { BoardRenderState, PortGroup } from '../types/board';
import { SelectableObject } from '../types';

/**
 * Pure helpers that derive the board's SVG presentation from domain state —
 * no JSX and no interaction handling here.
 */


/**
 * Group boundary port vertices into docks. A dock serves 1-2 adjacent coastal
 * vertices and renders as a single PortDock (one icon, with a little road to
 * each vertex it serves). Vertices are grouped by port type in angular order,
 * capped at PORT_DOCK_MAX_VERTICES per group: the board stores only the port
 * type per vertex (not dock identity), so adjacent same-type docks (e.g. two
 * generic harbors) can merge into one long run — the cap keeps each rendered
 * port to 1-2 vertices, matching a single harbor.
 */
export function groupPortVertices(base: BoardUIState | null): PortGroup[] {
  if (!base) return [];
  const withPort = Object.values(base.vertices).filter((v) => v.port !== null);
  const sorted = withPort.slice().sort(
    (a, b) => Math.atan2(a.position.y, a.position.x) - Math.atan2(b.position.y, b.position.x)
  );
  const groups: PortGroup[] = [];
  for (const v of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.port === v.port && last.vertices.length < PORT_DOCK_MAX_VERTICES)
      last.vertices.push(v.position);
    else groups.push({ port: v.port as PortType, vertices: [v.position] });
  }
  return groups;
}

/** Group soldiers by vertex, then by owner (for count badges). */
export function countSoldiersByVertexAndOwner(
  board: Board | null
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  if (!board) return map;
  for (const s of Object.values(board.soldiers)) {
    let byOwner = map.get(s.vertexId);
    if (!byOwner) {
      byOwner = new Map();
      map.set(s.vertexId, byOwner);
    }
    byOwner.set(s.owner, (byOwner.get(s.owner) ?? 0) + 1);
  }
  return map;
}

/**
 * Layer ephemeral interaction state (hover/select) and owner colors onto the
 * projected presentation state, producing the lists the layer components map
 * over.
 */
export function layerBoardInteraction(
  base: BoardUIState,
  selectedObject: SelectableObject | null,
  hoveredVertexId: string | null,
  hoveredEdgeId: string | null,
  colorOf: (ownerId: string | null) => string | undefined
): BoardRenderState {
  const vertices = Object.values(base.vertices).map((v) => ({
    ...v,
    isSelected: v.id === (selectedObject?.type === 'vertex' ? selectedObject.id : null),
    isHovered: v.id === hoveredVertexId,
    ownerColor: colorOf(v.settlementOwnerId),
  }));
  const edges = Object.values(base.edges).map((e) => ({
    ...e,
    isSelected: e.id === (selectedObject?.type === 'edge' ? selectedObject.id : null),
    isHovered: e.id === hoveredEdgeId,
    ownerColor: colorOf(e.roadOwnerId),
  }));
  const hexes = Object.values(base.hexes);
  return { vertices, edges, hexes };
}

