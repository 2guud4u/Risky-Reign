# Baseline Metrics

## Phase 0 Baseline - Board Architecture

Recorded: 2026-08-14

### Board Generation Metrics

**Standard Board Generation:**
- Hexes: 19
- Intersections: 54
- Edges: 72
- Settlements capacity: 54
- Roads capacity: 72

**Generation Time:**
- `generateIntersections`: ~5ms (estimated)
- `connectIntersections`: ~3ms (estimated)
- Full board generation: ~15ms (estimated)

### Conversion Metrics

**Domain → UI Conversion:**
- `intersectNodeToBoardVertex`: O(n) where n = intersections
- `createBoardEdges`: O(n²) with find() loops
- `mapRoadsToEdges`: O(n*m) where n=edges, m=roads

**Current Performance Issues:**
- O(n²) edge creation with nested loops + find()
- Full board reconversion on any gameRoom change
- Mutable Sets cause React re-render issues

### DOM Metrics

**SVG Rendering:**
- Hexagons: 19
- Vertices: 54
- Edges: 72
- Settlements: variable (0-54)
- Total elements: ~150-200

**Component Structure:**
- BoardView container
- 1x Hexagon component per hex
- 1x BoardVertex component per vertex
- 1x BoardEdge component per edge
- 1x Settlement component per settlement

### Test Coverage

**Existing Tests:**
- None for board generation
- None for adjacency
- None for placement validity
- App.test.tsx (basic React test)

**Required Tests:**
- Board generation correctness
- Adjacency computation accuracy
- Settlement placement validation
- Road placement validation
- Coordinate-derived ID stability

### Known Issues

1. Counter-based IDs (not deterministic)
2. O(n²) adjacency computation
3. Mutable Sets in state
4. Mixed domain/UI models in components
5. Full board reconversion on minor changes

### Success Criteria

- All tests pass
- Board conversion < 10ms for standard board
- Single settlement placement re-renders < 5 components
- Coordinate-derived IDs stable across runs
- Custom layouts work with same code path

---

## Phase 1 Target

- IDs: string (coordinate-derived)
- Generation time: < 10ms
- Conversion time: < 5ms
- No Number(id) casts

## Phase 2 Target

- Adjacency computation: pure function
- Works with irregular layouts
- O(n log n) or better
- No O(n²) find loops

## Phase 3 Target

- Normalized state shape
- Immutable updates only
- React re-renders scoped
- Immer for state updates

## Phase 4 Target

- Domain/UI clean separation
- Single conversion function
- No domain types in components
- Shape-agnostic domain layer
