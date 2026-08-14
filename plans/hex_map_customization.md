# Hex Placement Customization - Future Proof Analysis

## Understanding the Requirement

**Player custom map making with hex placements** means:
- Players can place hexes where they want
- Custom hex arrangements (not just regular grids)
- Maybe different hex sizes/shapes
- Maybe different tile types
- Possibly with constraints or freeform placement

## Current Architecture Analysis

### What Works Well

1. **Cube Coordinates**
   ```typescript
   export interface CubeCoord {
     q: number
     r: number
     s: number
   }
   ```
   - Excellent for hex grids
   - Supports axial coordinates
   - Can represent irregular placements

2. **Pixel Conversion**
   ```typescript
   cubeToPixel(q, r, s, size)
   ```
   - Flexible - any cube coord → pixel
   - Can handle irregular grids

3. **Generation is Separate**
   - `generateIntersections` is standalone
   - Could be replaced

### What Doesn't Work

1. **Fixed Generation Logic**
   ```typescript
   generateIntersections(hexes: HexNode[], size: number)
   ```
   - Assumes regular hex grid
   - No validation of hex positions
   - No support for overlapping/irregular

2. **Automatic Intersection Detection**
   ```typescript
   calcEuclideanDistance(vertex, coord) < 1
   ```
   - Relies on geometric proximity
   - Fails with irregular placements
   - Doesn't handle gaps/overlaps

3. **Hard-coded Adjacency**
   ```typescript
   distance < hexSize * 1.1
   ```
   - Assumes regular spacing
   - Won't work with custom placements

## Future-Proof Architecture for Hex Customization

### Option 1: Extended Cube Coordinates (Recommended)

**Keep cube coordinates, make placement flexible**

```typescript
interface CustomHexBoard {
  hexes: Array<{
    id: string
    q: number
    r: number
    s: number
    // Custom offset for irregular placement
    offset?: { x: number, y: number }
    // Custom size
    size?: number
    // Rotation
    rotation?: number
    properties: {
      resource: string
      number: number
    }
  }>
  
  // Explicit connections instead of automatic
  connections?: Array<{
    hexA: string
    hexB: string
    // Or edge connections
    vertices: [string, string]
  }>
}
```

**Benefits:**
- Minimal changes to existing code
- Backward compatible
- Supports irregular grids
- Can handle "almost regular" grids with offsets

**Example:**
```json
{
  "hexes": [
    { "id": "h1", "q": 0, "r": 0, "s": 0, "offset": { "x": 0, "y": 0 } },
    { "id": "h2", "q": 1, "r": 0, "s": -1, "offset": { "x": 5, "y": 10 } },
    { "id": "h3", "q": 0, "r": 1, "s": -1, "offset": { "x": -8, "y": 3 } }
  ]
}
```

### Option 2: Freeform Hex Placement

**Hexes have explicit pixel positions**

```typescript
interface FreeformHexBoard {
  hexes: Array<{
    id: string
    position: { x: number, y: number }
    size: number
    rotation: number
    q?: number  // Optional for game logic
    r?: number
    s?: number
    properties: {
      resource: string
      number: number
    }
  }>
  
  // Explicit adjacency
  adjacencies: Array<{
    hexA: string
    hexB: string
    sharedEdge: string
  }>
}
```

**Benefits:**
- Complete freedom
- Supports any arrangement
- Can handle non-hex shapes too

**Drawbacks:**
- Breaks cube coordinate benefits
- More complex game logic

### Option 3: Hybrid Approach (Best of Both)

**Cube coordinates for logic, pixel for rendering**

```typescript
interface HybridHexBoard {
  // Game logic uses cube coords
  hexes: Array<{
    id: string
    q: number
    r: number
    s: number
    properties: {...}
  }>
  
  // Rendering uses explicit positions
  layout: {
    type: 'regular' | 'custom' | 'freeform'
    baseSize: number
    placements: Array<{
      hexId: string
      pixelX: number
      pixelY: number
      rotation: number
      size: number
    }>
  }
  
  // Explicit topology
  topology: {
    nodes: Array<{ id: string, hexId: string, position: {x, y} }>
    edges: Array<{ id: string, nodeA: string, nodeB: string }>
  }
}
```

## Recommended Implementation

### Phase 1: Flexible Placement (Now)

```typescript
// common/types/Board.ts

export interface HexNode {
  id: string
  coord: CubeCoord
  // Add custom placement
  position?: PixelCoord  // Override calculated position
  size?: number          // Override default size
  rotation?: number      // Hex rotation
  
  resource: string
  number: number
  // ... existing fields
}

// Update generation
export function generateIntersections(
  hexes: HexNode[], 
  size: number,
  options?: {
    useCustomPositions: boolean
    explicitAdjacency?: boolean
  }
): IntersectNode[] {
  // If useCustomPositions, use hex.position instead of calculated
  // If explicitAdjacency, use provided adjacency instead of distance check
}
```

### Phase 2: Explicit Topology (6 months)

```typescript
export interface BoardTopology {
  nodes: Map<string, TopologyNode>
  edges: Map<string, TopologyEdge>
}

export interface TopologyNode {
  id: string
  position: PixelCoord
  hexId?: string
  connections: Set<string>  // Edge IDs
}

export interface TopologyEdge {
  id: string
  nodeA: string
  nodeB: string
  hexA?: string
  hexB?: string
}

// Board now has explicit topology
export interface Board {
  hexes: HexNode[]
  topology: BoardTopology
  settlements: SettlementObj[]
  roads: RoadObj[]
}
```

### Phase 3: Custom Map Editor (12 months)

```typescript
// Editor data format
interface CustomMap {
  metadata: {
    name: string
    author: string
    version: string
    created: number
  }
  
  settings: {
    hexSize: number
    gridType: 'regular' | 'irregular' | 'freeform'
    allowOverlap: boolean
    allowGaps: boolean
  }
  
  hexes: Array<{
    id: string
    // Either cube coords OR pixel position
    coord?: CubeCoord
    position?: PixelCoord
    size?: number
    rotation?: number
    
    resource: string
    numberToken: number
    
    // Validation
    constraints?: {
      minNeighbors: number
      maxNeighbors: number
      requiredResources: string[]
    }
  }>
  
  // Optional explicit connections
  connections?: Array<{
    type: 'edge' | 'vertex'
    nodes: [string, string]
  }>
}
```

## Code Changes Needed

### Minimal Changes (Support custom hex positions)

```typescript
// common/types/Hex.ts

export interface HexNode {
  id: string
  coord: CubeCoord
  // NEW: Custom placement
  customPosition?: PixelCoord
  customSize?: number
  customRotation?: number
  
  // Existing
  resource: string
  number: number
  intersections: Set<number>
}

// common/utils/hexUtils.ts

export function getHexPixelPosition(
  hex: HexNode,
  defaultSize: number
): PixelCoord {
  if (hex.customPosition) {
    return hex.customPosition
  }
  
  const { q, r, s } = hex.coord
  const size = hex.customSize || defaultSize
  return cubeToPixel(q, r, s, size)
}

// Update adjacency detection
export function areHexesAdjacent(
  hexA: HexNode,
  hexB: HexNode,
  options?: { useDistance: boolean }
): boolean {
  if (options?.useDistance === false) {
    // Use explicit adjacency
    return hexA.explicitAdjacency?.has(hexB.id)
  }
  
  // Default: use distance
  const posA = getHexPixelPosition(hexA, defaultSize)
  const posB = getHexPixelPosition(hexB, defaultSize)
  return calcEuclideanDistance(posA, posB) < threshold
}
```

### Recommended Changes (Full support)

```typescript
// Add board configuration
export interface BoardConfig {
  id: string
  name: string
  generator: 'regular' | 'custom' | 'editor'
  
  layout: {
    type: 'hex_grid' | 'freeform' | 'mixed'
    hexSize: number
    // For custom layouts
    placements?: Record<string, PixelCoord>
  }
  
  topology: {
    // If not provided, auto-generate
    explicit?: boolean
    nodes?: TopologyNode[]
    edges?: TopologyEdge[]
  }
  
  validation: {
    checkConnectivity: boolean
    checkBalance: boolean
    checkResources: boolean
  }
}
```

## Future Proof Checklist

### ✅ Already Good

- [x] Cube coordinates support irregular grids
- [x] Pixel conversion is separate
- [x] Generation is modular
- [x] Component-based rendering

### ⚠️ Needs Work

- [ ] Hex position customization
- [ ] Explicit adjacency support
- [ ] Board configuration system
- [ ] Validation for custom layouts

### ❌ Missing

- [ ] Map editor
- [ ] Board import/export
- [ ] Topology validation
- [ ] Custom constraints

## Verdict

### Is Current Architecture Future Proof?

**For hex placement customization: Partially Yes**

**Why it works:**
- Cube coordinates can handle irregular grids
- Pixel conversion is flexible
- Can add custom positions with minimal changes

**Why it needs work:**
- Automatic adjacency detection fails with irregular grids
- No explicit topology
- No validation

### Recommendation

**The architecture CAN support custom hex placements with 2-3 weeks of work:**

1. **Week 1**: Add custom position/size/rotation to HexNode
2. **Week 2**: Update generation to use custom positions
3. **Week 3**: Add explicit adjacency option

**For full custom map making:**
- Add BoardConfig system
- Add topology management
- Add validation
- Build editor (6-12 months)

## Example Custom Board

```json
{
  "config": {
    "name": "Irregular Catan",
    "layout": "custom",
    "hexSize": 50
  },
  "hexes": [
    {
      "id": "desert",
      "q": 0, "r": 0, "s": 0,
      "position": { "x": 400, "y": 300 },
      "resource": "desert",
      "numberToken": 0
    },
    {
      "id": "forest",
      "q": 1, "r": 0, "s": -1,
      "position": { "x": 475, "y": 250 },
      "rotation": 15,
      "resource": "wood",
      "numberToken": 9
    },
    {
      "id": "mountain",
      "q": 0, "r": 1, "s": -1,
      "position": { "x": 475, "y": 350 },
      "size": 60,
      "resource": "ore",
      "numberToken": 10
    }
  ]
}
```

## Conclusion

**Current architecture is 70% future-proof for hex placement customization.**

The foundation is solid - cube coordinates, pixel conversion, modular generation.

**Needs:**
- Custom position/size/rotation support
- Explicit adjacency option
- Board configuration system
- Validation

**Timeline:** 2-3 weeks to support custom hex placements, 3-6 months for full editor.

The architecture will work well for your use case with modest refactoring.
