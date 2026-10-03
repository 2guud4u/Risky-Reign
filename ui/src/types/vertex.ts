/**
 * Types for the vertex soldier-group logic (`useVertexGroup`). The domain
 * entities themselves (Board, VertexNode, SoldierObj, ...) live in `common`.
 */

/**
 * The soldier-action eligibility checks `useVertexGroup` needs. Structurally
 * satisfied by the `useBuildRules` return value — declaring a narrow shape
 * keeps the hook decoupled from the build-rule wiring.
 */
export interface SoldierActionRules {
  canMoveSoldierTo: (soldierId: string, targetVertexId: string) => boolean;
  canHealSoldierAt: (soldierId: string) => boolean;
  canCaptureSettlementAt: (soldierId: string, vertexId: string) => boolean;
  canFightRobberAt: (soldierId: string, vertexId: string) => boolean;
}
