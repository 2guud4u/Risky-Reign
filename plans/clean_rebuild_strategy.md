# Clean Rebuild Strategy for Vertex-Based Board UI

## Current State Assessment

The codebase has undergone partial migrations with inconsistent state:
- **Type definitions**: Mixed `IntersectNode`/`VertexNode`, numeric/string IDs
- **File renames**: Incomplete, breaking imports
- **Property names**: `intersections` vs `vertices`, `intersectId` vs `vertexId`
- **Build status**: Fails with 50+ TypeScript errors

## Recommendation: Clean Rebuild

Building from scratch with correct architecture from day one is faster than fixing the partial migration.

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

## Migration Plan

### Phase 1: Preserve Logic, Extract Core
1. Extract working game logic from current codebase:
   - Board generation algorithms
   - Placement validation rules
   - Socket event handlers
   - Resource calculations

2. Document current working flows in markdown

### Phase 2: New Scaffolding
1. Create clean type definitions with string IDs from start
2. Set up coordinate-derived ID generation
3. Create pure adjacency computation utilities

### Phase 3: Port Logic
1. Port board generation with coordinate IDs
2. Port placement validation
3. Port socket handlers

### Phase 4: UI Implementation
1. Build BoardVertex with click handling
2. Build BoardEdge with selection
3. Wire up build mode state management
4. Connect to socket events

### Phase 5: Integration & Test
1. Verify build succeeds
2. Test vertex click → settlement flow
3. Test edge selection → road flow
4. Verify custom hex map support

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
    Coordinates.ts (new)
    NormalizedBoard.ts (new)
  utils/
    adjacency.ts (pure)
    idGenerator.ts (new)
  adapters/
    boardAdapter.ts (clean)

frontend/
  components/
    BoardVertex.tsx (new)
    BoardEdge.tsx (new)
    BoardView.tsx (new)
  hooks/
    useBoardSelection.ts (new)
    useBuildMode.ts (new)
  types/
    boardUI.ts (new)
```

Total: ~15 new files, port ~2000 lines of logic

## Risk Mitigation

- Keep old codebase intact during rebuild
- Port incrementally, test each phase
- Maintain feature parity with existing game
- Document all decisions in plans/
