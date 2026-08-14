# Board Architecture Analysis

## Current Data Structure

### Game Board Model (Domain Layer)
```typescript
Board {
  Hexes: Array<HexNode>
  Intersections: Array<IntersectNode>
  Settlements: SettlementObj[]
  Roads: RoadObj[]
  Soldiers: SoldierObj[]
}
```

**IntersectNode**:
- coord: PixelCoord
- intersections: Set<number> (adjacent vertex IDs)
- id: number
- settlement: number | null
- soldiers: SoldierObj[]
- roads: Set<number> (road IDs)

### UI Data Model (Presentation Layer)
```typescript
BoardVertex {
  id: VertexId
  coord: PixelCoord
  settlement?: SettlementObj | null
  soldiers: SoldierObj[]
  roads: Set<EdgeId>
  adjacentVertices: Set<VertexId>
  adjacentEdges: Set<EdgeId>
}

BoardEdge {
  id: EdgeId
  vertexA: VertexId
  vertexB: VertexId
  coordA: PixelCoord
  coordB: PixelCoord
  road?: RoadObj | null
  adjacentVertices: [VertexId, VertexId]
}
```

## Current Rendering Approach

### Data Flow
```mermaid
graph TD
    A[GameRoom.board] --> B[BoardView useMemo]
    B --> C[intersectNodeToBoardVertex]
    B --> D[createBoardEdges]
    B --> E[mapRoadsToEdges]
    C --> F[BoardVertex[]]
    D --> G[BoardEdge[]]
    F --> H[BoardVertex Component]
    G --> I[BoardEdge Component]
```

### Rendering Layers
1. **Hexes layer** - Hexagon components
2. **Edges layer** - BoardEdge components (roads)
3. **Vertices layer** - BoardVertex components (settlements)
4. **Settlements layer** - Settlement components (overlays)

## Analysis: Strengths

### ✅ Good Practices

1. **Separation of Concerns**
   - Domain model (Board/IntersectNode) separate from UI model (BoardVertex/BoardEdge)
   - Conversion utilities (`intersectNodeToBoardVertex`) provide clean boundary

2. **React Optimization**
   - `useMemo` for expensive board conversion
   - Components receive minimal props
   - State management localized to BoardView

3. **Flexibility**
   - VertexId/EdgeId as `number | string` allows for future changes
   - Set-based adjacency for O(1) lookups

4. **Modern UI Patterns**
   - Hover states with visual feedback
   - Selection state management
   - Valid placement previews

## Analysis: Issues & Limitations

### ❌ Data Structure Problems

1. **Duplication of Data**
   ```
   IntersectNode.roads: Set<number>
   BoardVertex.roads: Set<EdgeId>
   BoardEdge.road: RoadObj | null
   ```
   Roads exist in three places with different representations

2. **Inconsistent ID Types**
   - IntersectNode uses `number` IDs
   - BoardUI uses `number | string` 
   - Conversion requires `Number()` casts

3. **Set Mutation Risk**
   - `Set` objects are mutable
   - React state updates may not detect changes
   - Conversion creates new Sets but source data is mutable

4. **Edge Creation is Expensive**
   ```typescript
   createBoardEdges(vertices) {
     // O(n²) complexity - loops through all vertices and adjacents
     vertices.forEach(vertex => {
       vertex.adjacentVertices.forEach(adjacentId => {
         // Find adjacent vertex again - O(n) search
         const adjacentVertex = vertices.find(v => v.id === adjacentId);
       })
     })
   }
   ```

5. **No Normalization**
   - Vertex adjacency stored in both vertices
   - No central index/map for O(1) lookups
   - Repeated `find()` calls throughout code

### ❌ Rendering Problems

1. **Layer Ordering Issues**
   - Edges render before vertices
   - Settlements render after vertices (good)
   - But all in same SVG - z-index conflicts possible

2. **Hover Detection**
   - SVG line elements have small hit targets
   - Required invisible hit area workaround
   - Better: use thicker invisible lines or canvas

3. **Re-renders**
   - `useMemo` depends on `gameRoom` object
   - Any gameRoom change triggers full board re-conversion
   - No fine-grained updates for individual pieces

4. **Mix of Models**
   ```typescript
   // In BoardView render
   {Settlements.map(settlement => 
     <Settlement {...settlement} />
   )}
   ```
   Using domain Settlements directly while vertices use UI model

## Recommended Improvements

### 1. Normalized Data Structure

```typescript
interface NormalizedBoard {
  vertices: Record<VertexId, BoardVertex>
  edges: Record<EdgeId, BoardEdge>
  settlements: Record<number, SettlementObj>
  roads: Record<number, RoadObj>
  
  // Index maps for fast lookups
  vertexEdges: Record<VertexId, Set<EdgeId>>
  edgeVertices: Record<EdgeId, [VertexId, VertexId]>
}
```

Benefits:
- O(1) lookups instead of `find()`
- No duplication
- Easier state management
- Immutable-friendly

### 2. Separate Domain from Presentation Completely

```typescript
// Domain layer - backend compatible
class BoardDomain {
  hexes: HexNode[]
  intersections: IntersectNode[]
  settlements: SettlementObj[]
  roads: RoadObj[]
}

// Presentation layer - UI optimized
class BoardPresentation {
  vertices: Map<VertexId, UI_Vertex>
  edges: Map<EdgeId, UI_Edge>
  
  // Computed from domain, cached
  updateFrom(domain: BoardDomain)
}
```

### 3. Use Canvas Instead of SVG for Performance

**Current SVG Issues:**
- 500+ DOM elements for full board
- Each element has event handlers
- React reconciliation overhead

**Canvas Benefits:**
- Single DOM element
- Pixel-perfect hit detection
- Better performance for 1000+ elements
- Easier animations

**Hybrid Approach:**
```typescript
<BoardCanvas>
  <CanvasLayer type="hexes" />
  <CanvasLayer type="edges" />
  <CanvasLayer type="vertices" />
  {/* SVG overlay for interactive elements only */}
  <SVGOverlay>
    <InteractiveVertex />
  </SVGOverlay>
</BoardCanvas>
```

### 4. Optimize Conversion Pipeline

Current:
```
Intersections → vertices (map) → edges (nested loops) → mapRoads (find)
```

Better:
```typescript
// One-pass conversion
function convertBoard(board: Board): {vertices, edges} {
  const vertices = new Map()
  const edges = new Map()
  
  // Build vertices
  for (const intersect of board.Intersections) {
    vertices.set(intersect.id, {
      id: intersect.id,
      coord: intersect.coord,
      settlementId: intersect.settlement,
      roadIds: [...intersect.roads]
    })
  }
  
  // Build edges from adjacency - one pass
  for (const [id, vertex] of vertices) {
    for (const adjId of vertex.adjacent) {
      if (id < adjId) { // Avoid duplicates
        edges.set(`${id}-${adjId}`, { ... })
      }
    }
  }
  
  return { vertices, edges }
}
```

### 5. Immutable Updates

```typescript
// Instead of mutating Sets
const newVertices = new Map(vertices)
newVertices.set(id, {
  ...vertices.get(id),
  roads: new Set([...vertices.get(id).roads, newRoadId])
})

// Or use Immer
import { produce } from 'immer'
const next = produce(state, draft => {
  draft.vertices[id].roads.add(newRoadId)
})
```

## Verdict

### Is Current Approach "Best"?

**For MVP: ✅ Yes**
- Works correctly
- Separation of concerns is good
- React patterns are reasonable
- Flexible enough for changes

**For Production: ❌ No**
- Performance will degrade with larger boards
- Data duplication creates sync bugs
- O(n²) algorithms won't scale
- SVG hit detection is fragile

### When to Refactor?

Refactor when you:
1. Add more game modes with larger boards
2. Need multiplayer with frequent updates
3. Add animations/transitions
4. See performance issues with 60fps
5. Need to support mobile (touch targets)

### Priority Improvements

1. **High**: Use Maps instead of arrays for O(1) lookups
2. **High**: Memoize conversion with proper dependency array
3. **Medium**: Normalize data to avoid duplication
4. **Medium**: Add canvas rendering for performance
5. **Low**: Implement proper immutable updates

## Migration Path

### Phase 1: Optimize Current Structure
- Replace `find()` with `Map` lookups
- Fix useMemo dependencies
- Cache conversion results

### Phase 2: Normalize Data
- Create normalized board state
- Update conversion utilities
- Keep existing components

### Phase 3: Performance
- Canvas rendering
- Virtualized rendering for large boards
- Web Workers for board calculations

Current implementation is good for prototyping but needs optimization for production use.
