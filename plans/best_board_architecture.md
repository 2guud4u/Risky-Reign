# Best Board Architecture for Custom Boards

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BOARD LAYER ABSTRACTION                   │
├─────────────────────────────────────────────────────────────┤
│  BoardProvider                                               │
│  ├─ BoardGraph (abstract graph structure)                   │
│  ├─ BoardRenderer (pluggable rendering)                     │
│  ├─ BoardInteractor (input handling)                        │
│  └─ BoardValidator (rules validation)                       │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼────┐  ┌──────▼──────┐  ┌────▼────────┐
    │  Hex Board   │  │ Custom JSON │  │ Procedural  │
    │  Generator   │  │   Board     │  │  Generator  │
    └──────────────┘  └─────────────┘  └─────────────┘
```

## 1. Core Board Graph Abstraction

### BoardGraph - Universal Representation

```typescript
// common/types/BoardGraph.ts

export type NodeId = string
export type EdgeId = string
export type TileId = string

export interface Vector2D {
  x: number
  y: number
}

export interface BoardNode {
  id: NodeId
  position: Vector2D
  type: 'vertex' | 'intersection' | 'junction' | 'custom'
  properties: Record<string, any>
  metadata?: {
    createdAt: number
    createdBy?: string
    version: number
  }
}

export interface BoardEdge {
  id: EdgeId
  from: NodeId
  to: NodeId
  type: 'road' | 'path' | 'connection' | 'custom'
  properties: Record<string, any>
  metadata?: {
    createdAt: number
    createdBy?: string
    version: number
  }
}

export interface BoardTile {
  id: TileId
  nodes: NodeId[]
  type: string
  properties: Record<string, any>
  resources?: {
    type: string
    number: number
  }
}

export interface BoardGraph {
  id: string
  name: string
  version: string
  generator: string
  metadata: BoardMetadata
  
  nodes: Map<NodeId, BoardNode>
  edges: Map<EdgeId, BoardEdge>
  tiles: Map<TileId, BoardTile>
  
  // Helper indexes
  nodeEdges: Map<NodeId, Set<EdgeId>>
  edgeNodes: Map<EdgeId, [NodeId, NodeId]>
}

// Validation
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  code: string
  message: string
  path?: string
}
```

## 2. Board Generator Interface

```typescript
// common/types/BoardGenerator.ts

export interface BoardGenerator {
  readonly name: string
  readonly version: string
  readonly description: string
  
  generate(config: GeneratorConfig): BoardGraph
  validate(board: BoardGraph): ValidationResult
  export(board: BoardGraph): ExportResult
  import(data: ImportData): BoardGraph
}

export interface GeneratorConfig {
  seed?: string
  parameters: Record<string, any>
  constraints?: BoardConstraints
}

export interface BoardConstraints {
  minNodes?: number
  maxNodes?: number
  minEdges?: number
  maxEdges?: number
  connectivity?: 'fully' | 'partially' | 'any'
  balance?: boolean
}
```

### Hexagonal Generator

```typescript
export class HexagonalGenerator implements BoardGenerator {
  readonly name = 'hexagonal'
  readonly version = '1.0.0'
  
  generate(config: HexConfig): BoardGraph {
    const { radius, size, layout = 'hexagonal' } = config
    
    const graph: BoardGraph = {
      id: uuid(),
      name: `Hex Board R${radius}`,
      version: '1.0',
      generator: this.name,
      metadata: { ... },
      nodes: new Map(),
      edges: new Map(),
      tiles: new Map()
    }
    
    // Generate hex grid
    const hexes = this.generateHexGrid(radius, size)
    const nodes = this.createNodesFromHexes(hexes)
    const edges = this.createEdgesFromNodes(nodes)
    
    // Populate graph
    nodes.forEach(n => graph.nodes.set(n.id, n))
    edges.forEach(e => graph.edges.set(e.id, e))
    
    // Build indexes
    this.buildIndexes(graph)
    
    return graph
  }
  
  private buildIndexes(graph: BoardGraph): void {
    graph.nodeEdges = new Map()
    graph.edgeNodes = new Map()
    
    for (const [edgeId, edge] of graph.edges) {
      // Index edge nodes
      graph.edgeNodes.set(edgeId, [edge.from, edge.to])
      
      // Index node edges
      for (const nodeId of [edge.from, edge.to]) {
        if (!graph.nodeEdges.has(nodeId)) {
          graph.nodeEdges.set(nodeId, new Set())
        }
        graph.nodeEdges.get(nodeId)!.add(edgeId)
      }
    }
  }
}
```

### Custom JSON Generator

```typescript
export class CustomBoardGenerator implements BoardGenerator {
  readonly name = 'custom'
  readonly version = '1.0.0'
  
  generate(config: { json: string }): BoardGraph {
    const data = JSON.parse(config.json)
    
    return {
      id: data.id || uuid(),
      name: data.name,
      version: data.version || '1.0',
      generator: this.name,
      metadata: data.metadata || {},
      nodes: new Map(data.nodes.map(n => [n.id, n])),
      edges: new Map(data.edges.map(e => [e.id, e])),
      tiles: new Map((data.tiles || []).map(t => [t.id, t]))
    }
  }
  
  export(board: BoardGraph): ExportResult {
    return {
      format: 'json',
      data: JSON.stringify({
        id: board.id,
        name: board.name,
        version: board.version,
        metadata: board.metadata,
        nodes: Array.from(board.nodes.values()),
        edges: Array.from(board.edges.values()),
        tiles: Array.from(board.tiles.values())
      }, null, 2)
    }
  }
}
```

## 3. Board Provider

```typescript
// frontend/src/contexts/BoardContext.tsx

interface BoardContextType {
  graph: BoardGraph | null
  generator: BoardGenerator | null
  renderer: BoardRenderer | null
  
  loadBoard(id: string): Promise<void>
  createBoard(generator: BoardGenerator, config: GeneratorConfig): Promise<void>
  saveBoard(): Promise<void>
  exportBoard(): string
  importBoard(data: string): Promise<void>
  
  // State management
  selectedNodes: Set<NodeId>
  selectedEdges: Set<EdgeId>
  hoveredNode: NodeId | null
  hoveredEdge: EdgeId | null
  
  // Actions
  selectNode(id: NodeId): void
  selectEdge(id: EdgeId): void
  hoverNode(id: NodeId | null): void
  hoverEdge(id: EdgeId | null): void
}

class BoardProvider {
  private graph: BoardGraph
  private renderer: BoardRenderer
  private interactor: BoardInteractor
  private validator: BoardValidator
  
  constructor(
    graph: BoardGraph,
    renderer: BoardRenderer,
    interactor: BoardInteractor
  ) {
    this.graph = graph
    this.renderer = renderer
    this.interactor = interactor
    this.validator = new BoardValidator()
  }
  
  // Transactional updates
  updateNode(id: NodeId, changes: Partial<BoardNode>): boolean {
    const validation = this.validator.validateNodeUpdate(id, changes)
    if (!validation.valid) {
      throw new Error(validation.errors[0].message)
    }
    
    const node = this.graph.nodes.get(id)
    if (node) {
      const updated = { ...node, ...changes, metadata: { ...node.metadata, version: node.metadata.version + 1 } }
      this.graph.nodes.set(id, updated)
      this.renderer.invalidate()
    }
  }
  
  // Undo/redo support
  private history: BoardGraph[] = []
  private historyIndex = -1
  
  saveToHistory(): void {
    this.history = this.history.slice(0, this.historyIndex + 1)
    this.history.push(this.cloneGraph(this.graph))
    this.historyIndex++
  }
}
```

## 4. Pluggable Renderer

```typescript
// common/types/BoardRenderer.ts

export interface RenderContext {
  canvas: HTMLCanvasElement | SVGElement
  viewport: {
    x: number
    y: number
    zoom: number
  }
  theme: BoardTheme
}

export interface BoardTheme {
  node: {
    radius: number
    fill: string
    stroke: string
    hoverFill: string
    selectedFill: string
  }
  edge: {
    width: number
    color: string
    hoverColor: string
    selectedColor: string
  }
  tile: {
    fill: string
    stroke: string
  }
}

export interface BoardRenderer {
  readonly type: 'svg' | 'canvas' | 'webgl'
  
  initialize(container: HTMLElement, theme: BoardTheme): void
  render(graph: BoardGraph): void
  renderNode(node: BoardNode, ctx: RenderContext): void
  renderEdge(edge: BoardEdge, ctx: RenderContext): void
  renderTile(tile: BoardTile, ctx: RenderContext): void
  
  hitTest(point: Vector2D): HitResult
  pan(delta: Vector2D): void
  zoom(factor: number, center: Vector2D): void
  invalidate(): void
}

// SVG Implementation
export class SVGRenderer implements BoardRenderer {
  private svg: SVGSVGElement
  private defs: SVGDefsElement
  
  render(graph: BoardGraph): void {
    this.clear()
    
    // Render tiles first
    for (const tile of graph.tiles.values()) {
      this.renderTile(tile)
    }
    
    // Render edges
    for (const edge of graph.edges.values()) {
      this.renderEdge(edge)
    }
    
    // Render nodes
    for (const node of graph.nodes.values()) {
      this.renderNode(node)
    }
  }
  
  private renderNode(node: BoardNode): void {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    
    // Node circle
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', node.position.x.toString())
    circle.setAttribute('cy', node.position.y.toString())
    circle.setAttribute('r', '8')
    circle.setAttribute('fill', this.theme.node.fill)
    circle.setAttribute('stroke', this.theme.node.stroke)
    circle.style.cursor = 'pointer'
    
    // Hit area
    const hitCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    hitCircle.setAttribute('cx', node.position.x.toString())
    hitCircle.setAttribute('cy', node.position.y.toString())
    hitCircle.setAttribute('r', '15')
    hitCircle.setAttribute('fill', 'transparent')
    hitCircle.style.cursor = 'pointer'
    
    g.appendChild(hitCircle)
    g.appendChild(circle)
    this.svg.appendChild(g)
  }
}
```

## 5. Board Interactor

```typescript
// common/types/BoardInteractor.ts

export interface BoardInteractor {
  onNodeClick: (id: NodeId) => void
  onEdgeClick: (id: EdgeId) => void
  onNodeHover: (id: NodeId | null) => void
  onEdgeHover: (id: EdgeId | null) => void
  onPan: (delta: Vector2D) => void
  onZoom: (factor: number) => void
}

export class MouseInteractor implements BoardInteractor {
  private renderer: BoardRenderer
  private state = {
    dragging: false,
    lastPoint: null as Vector2D | null
  }
  
  handlePointerDown(e: PointerEvent): void {
    const point = this.screenToWorld(e)
    const hit = this.renderer.hitTest(point)
    
    if (hit.type === 'node') {
      this.onNodeClick(hit.id)
    } else if (hit.type === 'edge') {
      this.onEdgeClick(hit.id)
    } else {
      this.state.dragging = true
      this.state.lastPoint = point
    }
  }
  
  handlePointerMove(e: PointerEvent): void {
    const point = this.screenToWorld(e)
    
    if (this.state.dragging && this.state.lastPoint) {
      const delta = {
        x: point.x - this.state.lastPoint.x,
        y: point.y - this.state.lastPoint.y
      }
      this.onPan(delta)
      this.state.lastPoint = point
    } else {
      const hit = this.renderer.hitTest(point)
      if (hit.type === 'node') {
        this.onNodeHover(hit.id)
      } else if (hit.type === 'edge') {
        this.onEdgeHover(hit.id)
      } else {
        this.onNodeHover(null)
        this.onEdgeHover(null)
      }
    }
  }
}
```

## 6. Game Integration

```typescript
// Integration with existing game logic

export class GameBoardAdapter {
  private graph: BoardGraph
  
  // Convert BoardGraph to game Board
  toGameBoard(graph: BoardGraph): Board {
    const intersections: IntersectNode[] = []
    const settlements: SettlementObj[] = []
    const roads: RoadObj[] = []
    
    for (const node of graph.nodes.values()) {
      if (node.type === 'vertex') {
        intersections.push({
          id: Number(node.id),
          coord: { x: node.position.x, y: node.position.y },
          intersections: new Set(Array.from(this.getConnectedNodes(node.id))),
          settlement: node.properties.settlementId || null,
          soldiers: node.properties.soldiers || [],
          roads: new Set(Array.from(this.getRoadIds(node.id)))
        })
      }
    }
    
    for (const edge of graph.edges.values()) {
      if (edge.type === 'road') {
        roads.push({
          id: Number(edge.id),
          intersect1: Number(edge.from),
          intersect2: Number(edge.to),
          owner: edge.properties.owner
        })
      }
    }
    
    return {
      Hexes: [], // Could generate from tiles
      Intersections: intersections,
      Settlements: settlements,
      Roads: roads,
      Soldiers: []
    }
  }
  
  // Convert game Board to BoardGraph
  fromGameBoard(board: Board): BoardGraph {
    // Existing conversion logic
  }
}
```

## 7. File Structure

```
common/
├── types/
│   ├── BoardGraph.ts
│   ├── BoardGenerator.ts
│   ├── BoardRenderer.ts
│   ├── BoardInteractor.ts
│   └── BoardValidator.ts
├── generators/
│   ├── HexagonalGenerator.ts
│   ├── CustomBoardGenerator.ts
│   ├── ProceduralGenerator.ts
│   └── GeneratorRegistry.ts
└── adapters/
    └── GameBoardAdapter.ts

frontend/
├── contexts/
│   ├── BoardContext.tsx
│   └── BoardProvider.tsx
├── components/
│   ├── BoardView.tsx
│   ├── BoardCanvas.tsx
│   ├── BoardControls.tsx
│   └── BoardEditor.tsx
├── renderers/
│   ├── SVGRenderer.ts
│   ├── CanvasRenderer.ts
│   └── WebGLRenderer.ts
└── interactors/
    ├── MouseInteractor.ts
    ├── TouchInteractor.ts
    └── KeyboardInteractor.ts
```

## 8. Key Benefits

1. **Complete Abstraction**: BoardGraph works with any topology
2. **Pluggable Generators**: Add new board types without changing core
3. **Multiple Renderers**: SVG, Canvas, WebGL support
4. **Editor Ready**: BoardJSON format for player-made boards
5. **Validation**: Ensure board integrity before gameplay
6. **Undo/Redo**: Built-in history management
7. **Performance**: Maps for O(1) lookups, optimized rendering
8. **Extensible**: Easy to add new node/edge types

## 9. Migration Path

### Step 1: Create Core Abstractions (1 week)
- BoardGraph types
- Generator interface
- Renderer interface

### Step 2: Implement Adapters (1 week)
- GameBoardAdapter
- HexagonalGenerator
- SVGRenderer

### Step 3: Refactor BoardView (1 week)
- Use BoardProvider
- Replace direct board access
- Test with existing game

### Step 4: Add Custom Support (1 week)
- CustomBoardGenerator
- BoardJSON format
- Import/export UI

Total: 4 weeks for production-ready custom board support

## 10. Example Custom Board

```json
{
  "id": "custom-desert-islands",
  "name": "Desert Islands",
  "version": "1.0",
  "generator": "custom",
  "metadata": {
    "author": "Player123",
    "created": "2024-01-01"
  },
  "nodes": [
    {
      "id": "n1",
      "position": { "x": 100, "y": 100 },
      "type": "vertex",
      "properties": { "terrain": "desert" }
    },
    {
      "id": "n2",
      "position": { "x": 200, "y": 150 },
      "type": "vertex",
      "properties": { "terrain": "island" }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "from": "n1",
      "to": "n2",
      "type": "path",
      "properties": { "terrain": "bridge" }
    }
  ],
  "tiles": [
    {
      "id": "t1",
      "nodes": ["n1", "n2", "n3"],
      "type": "desert",
      "properties": { "resource": "sand" }
    }
  ]
}
```

This architecture supports:
- ✅ Hexagonal boards (current)
- ✅ Custom boards (future)
- ✅ Procedural generation (future)
- ✅ Player-made boards (future)
- ✅ Different rendering backends
- ✅ Different input methods
- ✅ Board validation
- ✅ Undo/redo
- ✅ Export/import
