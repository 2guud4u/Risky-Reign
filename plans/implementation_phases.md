# Board Architecture Implementation Phases

## Overview

This document translates the architecture plan into actionable implementation phases for supporting player-defined custom hex layouts. Each phase builds on the previous one.

## Phase 0: Baseline Safety Net

### Objective
Establish measurable baseline to ensure refactoring doesn't break functionality.

### Tasks

1. **Add Unit Tests**
   ```typescript
   // tests/board/board-generation.test.ts
   describe('Board Generation', () => {
     test('generates standard board with correct hex count', () => {...})
     test('generates correct number of vertices', () => {...})
     test('generates correct number of edges', () => {...})
   })
   
   describe('Adjacency', () => {
     test('vertices have correct neighbors', () => {...})
     test('edges connect correct vertices', () => {...})
   })
   
   describe('Placement Validity', () => {
     test('settlement placement validates correctly', () => {...})
     test('road placement validates correctly', () => {...})
   })
   ```

2. **Performance Benchmarks**
   ```typescript
   // tests/benchmarks/board-conversion.bench.ts
   benchmark('board conversion', () => {
     const board = generateStandardBoard()
     const start = performance.now()
     domainToPresentation(board)
     return performance.now() - start
   })
   
   benchmark('DOM element count', () => {
     // Render board and count elements
   })
   ```

### Acceptance Criteria
- All tests pass on current main
- Baseline metrics recorded in `tests/baseline.md`

---

## Phase 1: Coordinate-Derived IDs

### Objective
Replace counter-based IDs with deterministic coordinate-derived IDs.

### Current State
```typescript
export interface IntersectNode {
  id: number  // Counter-assigned
  coord: PixelCoord
}
```

### Target State
```typescript
export type VertexId = string
export type EdgeId = string

export interface IntersectNode {
  id: VertexId  // Derived from coordinates
  coord: PixelCoord
}

// ID generation
function vertexIdFromCoords(coords: PixelCoord[]): string
function edgeIdFromVertices(v1: VertexId, v2: VertexId): string
```

### Implementation Steps

1. **Define Coordinate Types**
   ```typescript
   // common/types/Coordinates.ts
   export interface HexCoord { q: number; r: number; s: number }
   export interface VertexCoord { q: number; r: number; direction: number }
   export interface EdgeCoord { q: number; r: number; direction: number }
   ```

2. **Create ID Generators**
   ```typescript
   // common/utils/idGeneration.ts
   export function generateVertexId(
     hexCoords: HexCoord[],
     corner: number
   ): VertexId {
     const sorted = [...hexCoords].sort((a, b) => ...)
     return `v_${sorted.map(c => `${c.q},${c.r},${c.s}`).join('|')}_${corner}`
   }
   
   export function generateEdgeId(
     vertexA: VertexId,
     vertexB: VertexId
   ): EdgeId {
     const [a, b] = [vertexA, vertexB].sort()
     return `e_${a}_${b}`
   }
   ```

3. **Update Board Generation**
   - Modify `generateIntersections` to use derived IDs
   - Update `IntersectNode.id` type from `number` to `string`
   - Update all references

4. **Migration Script**
   ```typescript
   // scripts/migrate-ids.ts
   // Convert existing boards to new ID scheme
   ```

### Acceptance Criteria
- Generating same board twice produces identical IDs
- No `Number(id)` casts remain
- All Phase 0 tests pass

---

## Phase 2: Pure Adjacency Computation

### Objective
Make adjacency computation a pure function independent of board shape.

### Current State
```typescript
// Mixed with generation
function generateIntersections(hexes) {
  // Generates AND connects
}
```

### Target State
```typescript
function computeAdjacency(hexes: HexNode[]): AdjacencyGraph {
  // Pure function, no side effects
  // Works with any hex layout
}

function generateStandardBoard(): Board {
  const hexes = getStandardHexes()
  const adjacency = computeAdjacency(hexes)
  return assembleBoard(hexes, adjacency)
}
```

### Implementation Steps

1. **Extract Adjacency Logic**
   ```typescript
   // common/utils/adjacency.ts
   export interface AdjacencyGraph {
     vertices: Map<VertexId, Set<VertexId>>
     edges: Map<EdgeId, [VertexId, VertexId]>
     vertexEdges: Map<VertexId, Set<EdgeId>>
   }
   
   export function computeAdjacency(
     hexes: HexNode[]
   ): AdjacencyGraph {
     // Pure computation
     // No assumptions about board shape
   }
   ```

2. **Update Board Generation**
   ```typescript
   export function generateBoard(
     hexCoords: HexCoord[]
   ): Board {
     const hexes = hexCoords.map(coord => ({
       coord,
       // ...
     }))
     
     const adjacency = computeAdjacency(hexes)
     
     return {
       hexes,
       vertices: buildVertices(hexes, adjacency),
       edges: buildEdges(adjacency)
     }
   }
   ```

3. **Add Tests for Irregular Layouts**
   ```typescript
   test('L-shaped board', () => {
     const hexes = [
       { q: 0, r: 0, s: 0 },
       { q: 1, r: 0, s: -1 },
       { q: 0, r: 1, s: -1 },
       // L shape
     ]
     const adjacency = computeAdjacency(hexes)
     expect(adjacency.vertices.size).toBe(expected)
   })
   ```

### Acceptance Criteria
- `computeAdjacency` works with irregular layouts
- O(n²) loops replaced with Map lookups
- Performance benchmark improves or stays same

---

## Phase 3: Normalized Immutable State

### Objective
Single source of truth with immutable updates.

### Current State
```typescript
// Mixed, mutable
interface Board {
  Intersections: IntersectNode[]
  Settlements: SettlementObj[]
  Roads: RoadObj[]
}
```

### Target State
```typescript
interface NormalizedBoard {
  vertices: Record<VertexId, BoardVertex>
  edges: Record<EdgeId, BoardEdge>
  settlements: Record<SettlementId, SettlementObj>
  roads: Record<RoadId, RoadObj>
}

// All updates immutable
function placeSettlement(
  state: NormalizedBoard,
  vertexId: VertexId,
  playerId: string
): NormalizedBoard {
  return {
    ...state,
    settlements: {
      ...state.settlements,
      [newId]: { ... }
    },
    vertices: {
      ...state.vertices,
      [vertexId]: {
        ...state.vertices[vertexId],
        settlement: newId
      }
    }
  }
}
```

### Implementation Steps

1. **Define Normalized Types**
   ```typescript
   // common/types/NormalizedBoard.ts
   export interface NormalizedBoard {
     vertices: Record<VertexId, BoardVertex>
     edges: Record<EdgeId, BoardEdge>
     settlements: Record<SettlementId, SettlementObj>
     roads: Record<RoadId, RoadObj>
   }
   ```

2. **Add Immer**
   ```bash
   npm install immer
   ```
   
   ```typescript
   import { produce } from 'immer'
   
   function updateBoard(
     draft: NormalizedBoard,
     changes: Partial<NormalizedBoard>
   ) {
     return produce(draft, draft => {
       Object.assign(draft, changes)
     })
   }
   ```

3. **Update BoardView**
   ```typescript
   // Use normalized state
   const { vertices, edges } = useMemo(() => {
     return domainToNormalized(board)
   }, [board.hexes, board.settlements, board.roads])
   
   // Fine-grained dependencies
   const validPlacements = useMemo(() => {
     return computeValidPlacements(vertices, edges, player)
   }, [vertices, edges, player.id, buildMode])
   ```

4. **Optimize Rendering**
   ```typescript
   // Memoize components
   const BoardVertexMemo = React.memo(BoardVertex)
   
   // Only re-render when props change
   {Object.values(vertices).map(v => (
     <BoardVertexMemo key={v.id} vertex={v} />
   ))}
   ```

### Acceptance Criteria
- Placement updates only re-render affected components
- No in-place Set/Map mutations
- All writes produce new references

---

## Phase 4: Domain/Presentation Boundary

### Objective
Clean separation between domain and UI.

### Implementation Steps

1. **Create Conversion Layer**
   ```typescript
   // common/adapters/boardAdapter.ts
   export function domainToPresentation(
     board: BoardDomain
   ): NormalizedBoard {
     // Single conversion point
   }
   
   export function presentationToDomain(
     state: NormalizedBoard
   ): BoardDomain {
     // For saving
   }
   ```

2. **Update Components**
   ```typescript
   // BoardView.tsx
   const normalized = useMemo(() => {
     return domainToPresentation(gameRoom.board)
   }, [gameRoom.board])
   
   // Use normalized data, never domain data
   ```

3. **Remove Domain Types from Components**
   ```bash
   # Grep for violations
   grep -r "IntersectNode" frontend/src/components/
   grep -r "SettlementObj" frontend/src/components/
   ```

### Acceptance Criteria
- Components only import from UI types
- No domain types in render functions
- Conversion happens in one place

---

## Implementation Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 0 | 2 days | None |
| 1 | 3 days | Phase 0 |
| 2 | 4 days | Phase 1 |
| 3 | 5 days | Phase 2 |
| 4 | 3 days | Phase 3 |

**Total: ~17 days** for full architecture refactor

## Risks and Mitigations

### Risk 1: ID Changes Break Persistence
**Mitigation**: Migration script, backward compatibility layer

### Risk 2: Performance Regression
**Mitigation**: Benchmarks in Phase 0, compare after each phase

### Risk 3: Complex Refactoring
**Mitigation**: Incremental changes, tests at each phase

## Success Metrics

1. **Tests Pass**: All Phase 0 tests pass at end
2. **Performance**: Board conversion time ≤ baseline
3. **Re-renders**: Single settlement placement re-renders < 5 components
4. **Custom Board**: Can generate board with 5 hexes in L-shape
5. **Type Safety**: No `any` types in board code

## Next Steps After Phase 4

Once architecture is solid:
1. Build board editor UI
2. Add board validation
3. Add board import/export
4. Community board sharing
