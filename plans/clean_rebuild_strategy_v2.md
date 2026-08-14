# Clean Rebuild Strategy for Vertex-Based Board UI (v2)

## Current State Assessment

The codebase has undergone partial migrations with inconsistent state:
- **Type definitions**: Mixed `IntersectNode`/`VertexNode`, numeric/string IDs
- **File renames**: Incomplete, breaking imports
- **Property names**: `intersections` vs `vertices`, `intersectId` vs `vertexId`
- **Build status**: Fails with 50+ TypeScript errors

## Decision: Clean Rebuild

Building from scratch with correct architecture from day one. Old codebase stays intact and running until the new one reaches feature parity (see Rollback Criteria).

---

## Clean Architecture Blueprint

### 1. Domain Layer (Shape-Agnostic)
Location: `common/types/`
- `Board.ts` - Domain models with coordinate-based IDs
- `Hex.ts` - Hex nodes with string IDs
- `Pieces.ts` - Roads, Settlements with string IDs
- `Coordinates.ts` - ID generation utilities

**Key principle**: Domain works with ANY hex layout, doesn't assume 19 hexes

### 2. Presentation Layer (UI-Optimized)
Location: `common/types/BoardUI.ts`
- `BoardVertex` - UI-optimized vertex with position, selection state
- `BoardEdge` - UI-optimized edge with SVG path data
- `BoardUIState` - Interaction state (selected, hovered, build mode)

### 3. Adapter Layer
Location: `common/adapters/`
- `boardAdapter.ts` - Single conversion point domain ↔ presentation
- No leakage of domain types to UI

### 4. UI Components
Location: `frontend/src/components/`
- `BoardVertex.tsx` - Clickable vertex, hover states
- `BoardEdge.tsx` - Selectable edge, road visualization
- `BoardView.tsx` - Container for board rendering

---

## Phase 0: Canonicalization Spec (NEW — do this before any code)

This is the highest-risk part of the whole rebuild and needs to be nailed down on paper first, since a hex vertex touches 2–3 hexes and a hex edge touches 1–2 hexes — naive "derive ID from the hex I'm looking at" logic will mint multiple IDs for the same physical vertex/edge.

1. Choose a coordinate system for hexes (axial or cube recommended) and document it in `Coordinates.ts` with a comment, not just code.
2. Define **canonical vertex ID**: a deterministic function of the (up to 3) adjacent hex coordinates — e.g. sort the adjacent hex coordinate tuples lexicographically and join. Same for **canonical edge ID** from its (up to 2) adjacent hex coordinates, or its 2 adjacent vertex IDs (pick one source of truth, not both).
3. Write property-based tests *before* Phase 2 starts:
   - Every vertex has exactly 2 or 3 distinct hex neighbors.
   - Every edge has exactly 1 or 2 distinct hex neighbors (1 = board boundary).
   - No two distinct physical vertices/edges collide on the same ID.
   - The same physical vertex, computed by starting from any of its adjacent hexes, always yields the identical ID.
4. Only move to Phase 2 once these tests pass on a throwaway prototype.

## Phase 1: Preserve Logic & Establish Regression Baseline
1. Extract working game logic from current codebase:
   - Board generation algorithms
   - Placement validation rules
   - Socket event handlers
   - Resource calculations
2. Document current working flows in markdown.
3. **Golden fixtures (NEW)**: from the *current* running implementation, capture and commit output for:
   - The standard 19-hex board, at 2–3 fixed random seeds
   - At least one non-standard/custom hex layout
   - Include: full vertex list, edge list, adjacency maps, and a couple of sample placement-validation results (legal + illegal moves)
   - These become the diff target in Phase 5 — no eyeballing correctness.

## Phase 2: New Scaffolding
1. Create clean type definitions with string IDs from start, per the Phase 0 spec.
2. Implement coordinate-derived ID generation exactly as specified in Phase 0.
3. Create pure adjacency computation utilities, tested against the Phase 0 property tests.

## Phase 3: Port Logic
1. Port board generation with coordinate IDs; diff hex/vertex/edge counts against golden fixtures.
2. Port placement validation; run the golden legal/illegal move cases through it.
3. Port socket handlers.
4. **Wire protocol note (NEW)**: the ID format change is a breaking change to any socket payload that carries vertex/edge IDs. Frontend and backend must ship together (no partial rollout) — either behind a single feature flag flipped atomically, or a version field in the socket handshake that rejects mismatched clients. Decide which before writing handler code.

## Phase 4: UI Implementation
1. Build BoardVertex with click handling.
2. Build BoardEdge with selection.
3. Wire up build mode + selection state. Use a single `useBoardInteraction` hook composing selection and build-mode logic rather than two independent hooks — selection behavior differs depending on build mode (e.g. clicking a vertex means "inspect" vs. "place settlement"), so the two need to see each other's state anyway.
4. Connect to socket events.

## Phase 5: Integration & Test
1. Verify build succeeds (zero TS errors).
2. Diff generated board output against Phase 1 golden fixtures for every fixture case.
3. Test vertex click → settlement flow.
4. Test edge selection → road flow.
5. Verify custom hex map support against the non-standard fixture.

---

## Rollback Criteria (NEW)

Old codebase stays deployed and untouched until the new one clears Phase 5. Concrete triggers to abandon/pause the rebuild and fall back to fixing the old codebase incrementally:
- Phase 0 canonicalization tests can't be made to pass within a fixed time-box (suggest: 1–2 days) — this signals the domain model itself needs more thought, not more code.
- Phase 3 (port logic) blows past its estimate by >2x.
- Golden fixture diffs in Phase 5 reveal behavioral drift you can't explain (silent rule changes are worse than a slow rebuild).

## Benefits of Clean Rebuild

- **Correct from start**: No legacy baggage
- **Consistent naming**: Vertex throughout, no Intersect confusion
- **Type safety**: String IDs everywhere from day one
- **Testable**: Pure functions, easy to test
- **Maintainable**: Clear separation of concerns

## Estimated Files to Create

```
common/
  types/
    Board.ts (clean)
    Hex.ts (string IDs)
    Pieces.ts (string IDs)
    Coordinates.ts (new — includes canonicalization spec as comments)
    NormalizedBoard.ts (new)
  utils/
    adjacency.ts (pure)
    idGenerator.ts (new)
  adapters/
    boardAdapter.ts (clean)
  __fixtures__/
    golden-board-standard-seed1.json (new)
    golden-board-standard-seed2.json (new)
    golden-board-custom-layout.json (new)

frontend/
  components/
    BoardVertex.tsx (new)
    BoardEdge.tsx (new)
    BoardView.tsx (new)
  hooks/
    useBoardInteraction.ts (new — replaces separate selection/build-mode hooks)
  types/
    boardUI.ts (new)
```

Total: ~16 new files (+ fixture files), port ~2000 lines of logic

## Risk Mitigation

- Keep old codebase intact and deployed during rebuild
- Port incrementally, test each phase against golden fixtures
- Maintain feature parity with existing game
- Document all decisions, especially the canonicalization spec, in `plans/`
- Ship frontend/backend ID-format changes atomically, never partially rolled out
