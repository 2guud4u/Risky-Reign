import { Board, EdgeNode, VertexId, VertexNode } from 'common';

/**
 * Types for the sidebar vertex panel and its extracted helpers. The domain
 * entities themselves (Board, VertexNode, SoldierObj, ...) live in `common`.
 */

/** Props for the selected-vertex sidebar panel (`SideBar/Vertex`). */
export interface VertexPanelProps {
  board: Board;
  vertex: VertexNode;
}

/**
 * An edge touching a vertex, paired with the vertex id on its far side.
 * `edge`/`otherId` are null when the edge is missing from the board.
 */
export interface AdjacentEdgeInfo {
  edge: EdgeNode | null;
  otherId: VertexId | null;
}

/**
 * The soldier-action eligibility checks `useVertexGroup` needs. Structurally
 * satisfied by the `useBuildRules` return value — declaring a narrow shape
 * keeps the hook decoupled from the sidebar's build-rule wiring.
 */
export interface SoldierActionRules {
  canMoveSoldierTo: (soldierId: string, targetVertexId: string) => boolean;
  canHealSoldierAt: (soldierId: string) => boolean;
  canCaptureSettlementAt: (soldierId: string, vertexId: string) => boolean;
  canFightRobberAt: (soldierId: string, vertexId: string) => boolean;
}
