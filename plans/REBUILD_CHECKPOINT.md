# RiskOfCatan Clean Rebuild — RESUMABLE CHECKPOINT

> **Purpose:** This is a handoff checkpoint for an LLM (or human) to resume the
> vertex-based board rebuild. Read top-to-bottom, then start at "NEXT ACTION".
> Last updated: 2026-08-14.

---

## 1. TASK & SCOPE

Rebuild the Catan board as a **vertex/edge graph** (not the old
"intersection + Set<number>" model) so that:

- The UI (`ui/`) renders an SVG board with clickable **vertices** (settlements)
  and **edges** (roads), with hover/selection/build-mode states.
- A **shared clean type layer** lives in `common/v2/` (imported as `common/v2`)
  and is used by BOTH the new `ui/` client AND the backend.
- The **backend** is adapted to emit/consume the clean `common/v2` `Board`
  (user explicitly approved touching the backend: "you can touch the back end
  as well to adapt it to be the same types in new common").

**Out of scope / do NOT touch:** the old `frontend/` app and the legacy
`common/` top-level types. The old frontend still works against the **prebuilt**
`common/dist` (legacy). We are building a NEW `ui/` alongside it. Do not
overwrite `common/index.ts`, `common/types/*` (top-level), or `frontend/*`.

---

## 2. CRITICAL CONTEXT (why the codebase looks the way it does)

### 2.1 The legacy `common/` SOURCE is broken (but the app still runs)
- `common/dist/` is **prebuilt** and checked in. The running `backend/` and
  `frontend/` resolve `common` → `node_modules/common` (a **symlink** to
  `../common`) and consume the **stale legacy `dist`**, NOT the source.
- The `common/` **source** is half-migrated and does NOT compile. Verified:
  `cd common && ../node_modules/.bin/tsc -b` fails with ~18 errors
  (duplicate `HexId`/`HexNode`/`RoadObj`/`SettlementObj` exports from
  `index.ts`; `PixelCoord`/`CubeCoord` declared-but-not-exported in
  `types/Board.ts`; `types/Logic.ts` imports `connectVertices`/
  `generateVertices`/`IntersectId` from `./Board` which don't exist there;
  `types/Pieces.ts` imports `Coords` from `./Board`; etc.)
- **Do not try to fix the legacy `common` source.** Leave it. The old app runs
  off `dist`. Our clean layer is `common/v2/`.

### 2.2 `common/v2/` is the clean layer (NEW, built by this work)
- Lives at `common/v2/` with its own `package.json`, `tsconfig.json`, and
  `dist/`. It is **excluded** from the legacy `common/tsconfig.json` build
  (added `"v2"` to its `exclude`) so the broken legacy build isn't affected.
- Because `node_modules/common` is a symlink to `../common`, a CRA app can
  `import ... from 'common/v2'` and it resolves to the real source path
  (outside `node_modules`), so CRA transpiles it. **This is the import path
  the `ui/` app must use.**
- `common/v2/dist` is currently BUILT and VERIFIED (see §3).

### 2.3 The backend wire protocol (legacy) — what the backend actually emits
Read `backend/src/index.ts` (516 lines) and `backend/src/utils/*`. Facts:
- **Server→client events:** `roomUpdate`, `gameUpdate` (both send the whole
  `GameRoom`), `error`.
- **Client→server events:** `joinRoom`, `startGame`, `refreshMap`, `resetGame`,
  `endTurn`, `rollDice`, `buildSettlement`, `buildRoad`, `makeMove`.
- `buildSettlement` payload: `{ roomId, playerId, vertexId: number }`
- `buildRoad` payload: `{ roomId, playerId, startIntersectId: number,
  endIntersectId: number }`
- The backend `GameRoom.board` is the **legacy** board shape
  (`{ Hexes, Vertices, Settlements, Roads, Soldiers }` — note `Vertices`,
  whereas the old frontend reads `Vertexs`; part of why the old UI is broken).
  Legacy `VertexNode` = `{ coord: PixelCoord, vertices: Set<number>, id: number,
  settlement: number|null, soldiers: SoldierObj[], roads: Set<number> }`.
  Legacy `HexNode` = `{ id: number, coord: CubeCoord, vertices: Set<number>,
  terrain, robber, rollNumber }`.
- **Only 3 backend functions touch board internals:** `createBoard()` (line
  ~57), the `buildSettlement` handler (~380), and the `buildRoad` handler
  (~439). Everything else (dice/turn logic) only does `if (!board)`. So the
  backend adaptation is contained.
- `createBoard()` currently does:
  ```ts
  let {hexes, vertices} = generateGameBoard(boardRadius, hexSize);
  return { Hexes: hexes, Vertices: vertices, Settlements: [], Roads: [], Soldiers: [] };
  ```
  where `generateGameBoard` is the backend's OWN `backend/src/utils/gameUtils.ts`
  (returns `{ hexMap: Map, intersectMap: Map }`), NOT from `common`.

### 2.4 The plan spec had TWO bugs (both now fixed in `common/v2`)
The original plan (`plans/clean_rebuild_strategy*.md`) specified:
1. **Vertex id = f(sorted adjacent hex coords), "2-3 hexes".** WRONG: boundary
   vertices touch only **1** hex, and several outer corners of the same
   boundary hex each have hex-set `{that hex}` → they collide to ONE id (two
   distinct physical points, same id). This caused self-loop edges and a wrong
   vertex count (48 instead of 54).
2. **Edge id = f(adjacent hex coords), "1-2 hexes".** WRONG for boundary edges:
   a boundary edge has only ONE adjacent hex, and several distinct boundary
   edges share that hex → id collisions.

**The fix:** the canonical id is the **exact geometric position**.
- A pointy-top hex corner k is at `center + size*(cos(60k-30), sin(60k-30))`.
  Those trig values are always in {0, ±1/2, ±√3/2}, so the corner is EXACTLY
  `x = size * Xb * √3 / 2`, `y = size * Ya / 2` where `Xb, Ya` are INTEGERS:
  `Xb = 2q + r + bx[k]`, `Ya = 3r + by[k]`, with `bx=[1,1,0,-1,-1,0]`,
  `by=[-1,1,2,1,-1,-2]`.
- **Vertex id = `v_${Xb}_${Ya}`** (unique per physical point, deterministic,
  order-independent). Edge id = `e_${min(va,vb)}_${max(va,vb)}` from its two
  endpoint vertex ids. This satisfies "no two distinct vertices/edges share an
  id" and is immune to floating-point noise.
- This is implemented in `common/v2/types/Coordinates.ts`
  (`hexCornersExact`, `exactVertexId`, `exactCornerKey`, `exactCornerToPixel`,
  `canonicalEdgeId`) and `common/v2/utils/adjacency.ts` (`computeAdjacency`).

---

## 3. WHAT IS DONE + VERIFIED

### 3.1 `common/v2/` clean layer — COMPLETE and BUILDING
Files (all under `common/v2/`):
- `types/Coordinates.ts` — Cube/Pixel coords, `hexId`, `cubeToPixel`,
  `hexCorners`, **`hexCornersExact`**, **`exactVertexId`**, `exactCornerKey`,
  `exactCornerToPixel`, `canonicalEdgeId`, `getNeighbors`, `isValidCubeCoord`,
  `hexCoordsForRadius`. (The canonicalization spec + the two bug fixes are
  documented in the header comment.)
- `types/Board.ts` — `HexNode`, `VertexNode` (hexIds: 1-3), `EdgeNode`
  (vertexAId/vertexBId, hexIds: 1-2), `SettlementObj`, `RoadObj`, `Board`
  (Record<Id, Node> + metadata). All string ids.
- `types/Hex.ts` — `TOKENS`, `TERRAIN_COUNTS`, `TerrainResourceMap`,
  `terrainColors`, `assignStandardHexes(radius)` (desert always center),
  `shuffle`.
- `types/Pieces.ts` — `SoldierObj`, `DevCard`, `BuildType`,
  `SettlementPlacement`, `RoadPlacement`.
- `types/Player.ts`, `types/Logic.ts` (TurnState, TradeState, BattleState,
  ResourceCount, Price, SettlementPrice/RoadPrice/SoldierPrice, `canAfford`),
  `types/Room.ts` (`GameRoom` — **see §5, `board` field still needs to be
  switched to the clean `Board`**), `types/BoardUI.ts` (BoardVertex/BoardEdge/
  BoardHex/BoardUIState/BuildMode).
- `utils/adjacency.ts` — `computeAdjacency(coords, size)` →
  `{ vertices, edges, vertexNeighbors, vertexEdges }` (all Maps, string ids),
  and `validateAdjacency(coords, size)` → string[] of failures (empty = pass).
- `utils/boardGenerator.ts` — `generateBoard(layouts, opts)`,
  `generateStandardBoard(hexSize=50)`, `generateCustomBoard(hexSize=50)`
  (5-hex L-shape fixture).
- `utils/placement.ts` — `validSettlementVertices`, `validRoadEdges`,
  `playerSettlementVertexIds`.
- `adapters/boardAdapter.ts` — `domainToPresentation(board, hexSize=50)` →
  `BoardUIState`, `updatePresentationState`, `extractBuildActions`.
- `adapters/wireAdapter.ts` — `wireBoardToDomain(wire, hexSize)` (converts a
  legacy WireBoard to the clean Board). **NOTE: if we make the backend emit
  the clean Board directly (§5), this adapter may become unnecessary for the
  new ui — keep it for now but it's lower priority.**
- `Constant.ts` — `GAME_HEX_SIZE=100`, `LOBBY_HEX_SIZE=50`, `SOCKET_URL`.
- `index.ts` — barrel re-exporting everything above.
- `tsconfig.json` — target es2020, module/moduleResolution node16, declaration,
  outDir dist, strict.
- `package.json` — name `common-v2`, private, main/types → dist.

### 3.2 VERIFICATION (run this to confirm the core is intact)
```bash
cd /home/jia/Code/RiskOfCatan/common/v2 && rm -rf dist && \
  ../../node_modules/.bin/tsc -p tsconfig.json && echo BUILD_OK && \
  node -e 'const v2=require("/home/jia/Code/RiskOfCatan/common/v2/dist");
    const b=v2.generateStandardBoard(50);
    console.log("std", Object.keys(b.hexes).length, Object.keys(b.vertices).length, Object.keys(b.edges).length,
      "fails", v2.validateAdjacency(Object.values(b.hexes).map(h=>h.coord),50).length);
    const c=v2.generateCustomBoard(50);
    console.log("custom", Object.keys(c.hexes).length, Object.keys(c.vertices).length, Object.keys(c.edges).length,
      "fails", v2.validateAdjacency(Object.values(c.hexes).map(h=>h.coord),50).length)'
```
**Expected output (this is the golden reference):**
```
BUILD_OK
std 19 54 72 fails 0
custom 5 19 23 fails 0
```
Standard radius-2 board: 19 hexes, 54 vertices, 72 edges.
Vertex hex-neighbour distribution: 18×1-hex (boundary), 12×2-hex, 24×3-hex.
Edge hex-neighbour distribution: 30×1-hex (boundary), 42×2-hex.
If you do NOT see `fails 0` for both, the core is broken — stop and re-read §2.4.

### 3.3 `ui/` scaffolding — PARTIAL
Created: `ui/package.json`, `ui/tsconfig.json` (**has deprecation errors, see
§5**), `ui/public/index.html`, `ui/src/index.tsx`, `ui/src/index.css`,
`ui/src/reportWebVitals.ts`, `ui/src/react-app-env.d.ts`.
**NOT yet created:** `ui/src/App.tsx` (so `index.tsx` currently fails to
resolve `./App`), all components/containers/contexts/hooks/pages/services.
A vendored `ui/src/common/` was created earlier and then **DELETED** (superseded
by `common/v2`). Do not recreate it — import from `common/v2`.

---

## 4. ARCHITECTURE DECISIONS (keep these)

- **Clean types in `common/v2/`, imported as `'common/v2'`.** Shared by `ui/`
  and backend. (User requirement: "the types should come from ./common because
  it is shared with backend".)
- **The clean `Board` becomes the wire protocol.** Backend emits the clean
  `Board` directly (string ids, plain arrays/objects — JSON-safe). This means
  the new `ui/` needs NO wire adapter for the board (it just receives a
  `Board`). This is the "atomic shipping" from the plan: backend + ui ship
  together. (The old `frontend/` is unaffected because it reads the stale
  legacy `common/dist`.)
- **Vertex/edge ids are exact-position-based strings** (§2.4). Never revert to
  hex-set-based ids.
- **UI state** = `BoardUIState` (from `common/v2`), produced by
  `domainToPresentation(board)`. Interaction (hover/select/build-mode) is a
  reducer over `BoardUIState` (mirror `frontend/src/contexts/BoardContext.tsx`
  and `frontend/src/hooks/useBoardInteraction.ts` as reference implementations).
- **CRA** for `ui/` (mirror `frontend/`: react-scripts 5.0.1, react 19,
  socket.io-client).

---

## 5. NEXT ACTION (start here)

Work in this order. After each step, run the relevant verification.

### Step A — Make the clean `Board` the wire protocol in `common/v2`
1. In `common/v2/types/Room.ts`, change `GameRoom.board` from `WireBoard | null`
   to the clean `Board | null` (import `Board` from `./Board`). Keep the
   `Wire*` interfaces only if you still want `wireAdapter.ts` to type-check;
   otherwise you can drop `wireAdapter.ts` and the `Wire*` types (decide based
   on whether the backend will ever emit the legacy shape — it won't after
   Step B, so dropping is fine and cleaner).
2. Rebuild `common/v2` (command in §3.2) and confirm `BUILD_OK` + `fails 0`.

### Step B — Adapt the backend to `common/v2`
Edit `backend/src/index.ts` (and only what's needed):
1. Change the import (line 33) to pull the clean types from `common/v2`:
   ```ts
   import { GameRoom, Player, Board, SettlementPrice, generateStandardBoard } from 'common/v2';
   ```
   (Drop `generateGameBoard`, `getRollMap` from `common` — the backend will use
   `generateStandardBoard` from `common/v2` instead. `getRollMap` is only used
   in a commented-out line; `SettlementPrice` may be unused — verify with tsc.)
2. Rewrite `createBoard()` (line ~57) to return the clean `Board`:
   ```ts
   function createBoard(): Board {
     return generateStandardBoard(hexSize);
   }
   ```
   (Remove the `let {hexes, vertices} = generateGameBoard(...)` and the
   `{ Hexes, Vertices, ... }` object. `hexSize` is already `100` in scope.)
3. Rewrite the `buildSettlement` handler (~380):
   - Payload `vertexId` becomes a **string** (clean id). Update the handler's
     param type to `vertexId: string`.
   - Look up `const vertex = board.vertices[vertexId];` (Record lookup, not
     `.find`).
   - Occupancy check: `if (vertex.settlementId !== null) { ... }`.
   - Create settlement:
     ```ts
     const newSettlementId = `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
     board.settlements[newSettlementId] = {
       id: newSettlementId, vertexId, ownerId: currentPlayer.name,
       level: 'settlement', builtAt: Date.now(),
     };
     vertex.settlementId = newSettlementId;
     ```
4. Rewrite the `buildRoad` handler (~439):
   - Payload becomes `{ roomId, playerId, edgeId: string }` (a road is now
     placed on a single EDGE, not between two vertices — this is the whole
     point of the edge-based model). Update param type to `edgeId: string`.
   - Look up `const edge = board.edges[edgeId];`
   - Adjacency/occupancy: `if (edge.roadId !== null) { ... }` (road exists).
     (Optionally also verify the edge touches the player's settlements via
     `common/v2` `validRoadEdges` — but keep minimal to match current
     "adjacency check skipped" behavior.)
   - Create road:
     ```ts
     const newRoadId = `r_${Date.now()}_${Math.random().toString(36).slice(2)}`;
     board.roads[newRoadId] = { id: newRoadId, edgeId, ownerId: currentPlayer.name, builtAt: Date.now() };
     edge.roadId = newRoadId;
     board.vertices[edge.vertexAId].roadIds.push(edgeId);
     board.vertices[edge.vertexBId].roadIds.push(edgeId);
     ```
5. **Verify backend typechecks.** The backend uses `ts-node` at runtime and
   `tsc -b` for build. Run:
   ```bash
   cd /home/jia/Code/RiskOfCatan/backend && ../node_modules/.bin/tsc -b 2>&1 | head -40
   ```
   NOTE: `backend/tsconfig.json` has `"references": [{ "path": "../common" }]`
   and `rootDir: ./src`. Because it imports `common/v2` (a subpath), TS project
   references may not cover it. If `tsc -b` complains about the `common/v2`
   module, the simplest fix is to ensure `common/v2/dist` is built (it is) and
   that module resolution finds it. If references cause trouble, you may need
   to add `common/v2` as a reference or adjust `paths`. **Do NOT break the
   legacy `common` reference** (the backend still imports `Player`,
   `SettlementPrice`, etc. — after Step B it should import ALL of those from
   `common/v2`, so the legacy `common` reference may become unused; verify with
   tsc whether it's still needed, and only remove it if tsc confirms it's
   unused). Prefer minimal changes.
   - **Runtime check:** `cd backend && npm run dev` (nodemon + ts-node). Confirm
     the server starts and logs "Server running on port 3001". (It won't do
     much without a client, but it must boot without a TS error.)

### Step C — Build the `ui/` React app
Mirror `frontend/src/` structure but import from `common/v2`. Create:
1. **Fix `ui/tsconfig.json`** — it currently errors on deprecated options
   (`target: es5`, `moduleResolution: node`, `baseUrl`). The workspace TS is
   **5.9.3**. Change to: `"target": "es2020"`, `"module": "esnext"`,
   `"moduleResolution": "bundler"` (CRA 5 supports it) or `"node16"`, and
   drop `"baseUrl"`. Keep `strict`, `jsx: react-jsx`, `noEmit`, `lib:
   ["dom","dom.iterable","esnext"]`, `isolatedModules`, `esModuleInterop`,
   `skipLibCheck`. (CRA's react-scripts uses its own babel for the actual
   build; tsconfig is for `tsc --noEmit` typechecking. Make `tsc --noEmit`
   pass.)
2. `ui/src/App.tsx` — wraps `SocketProvider` → `GameProvider` →
   `GameLogic`-style router (Lobby vs Game). Mirror
   `frontend/src/components/GameLogic.tsx`.
3. `ui/src/contexts/SocketContext.tsx` — mirror
   `frontend/src/contexts/SocketContext.tsx`, but:
   - `buildSettlement(playerId, vertexId: string, roomId)`
   - `buildRoad(playerId, edgeId: string, roomId)` (single edgeId, not two
     vertices)
   - `SOCKET_URL` from `common/v2` (`SOCKET_URL` const) or
     `process.env.REACT_APP_SOCKET_URL || 'http://localhost:3001'`.
4. `ui/src/contexts/GameContext.tsx` — holds `GameRoom` + `currentPlayer`
   (mirror `frontend/src/contexts/GameContext.tsx`).
5. `ui/src/contexts/BoardContext.tsx` — `useReducer` over `BoardUIState`
   (mirror `frontend/src/contexts/BoardContext.tsx`; it's already clean and
   imports `BoardUIState` — just point the import at `common/v2`).
6. `ui/src/hooks/useBoardInteraction.ts` — mirror
   `frontend/src/hooks/useBoardInteraction.ts` (vertex/edge click + hover,
   build-mode, valid-target computation using `common/v2` `validSettlementVertices`
   / `validRoadEdges`).
7. `ui/src/components/` — `BoardVertex.tsx`, `BoardEdge.tsx`, `Hexagon.tsx`
   (SVG), `Settlement.tsx`. Mirror `frontend/src/components/BoardVertex.tsx`
   & `BoardEdge.tsx` (they already take `BoardVertex`/`BoardEdge` props from
   `common/types/BoardUI` — repoint to `common/v2`).
8. `ui/src/containers/BoardView.tsx` — SVG canvas with Hex layer + Edge layer +
   Vertex layer (z-order), uses BoardContext + useBoardInteraction. This is the
   main new container (the old `NewBoardView.tsx` is a stub; write a real one).
9. `ui/src/containers/Game.tsx`, `PlayersList.tsx`, `Inventory.tsx`,
   `EndTurnButton.tsx`, `TradeHud.tsx`, `BattleHud.tsx` — mirror the
   `frontend/src/containers/*` versions, repointing imports to `common/v2`.
10. `ui/src/pages/Lobby.tsx`, `ui/src/pages/Game.tsx` — mirror
    `frontend/src/pages/*`.
11. `ui/src/services/` + `ui/src/utils/` — only if needed; prefer keeping logic
    in `common/v2` (pure) and thin wrappers in `ui/`.

**Key UI data flow:**
```
socket 'roomUpdate'/'gameUpdate' → GameContext.setGameRoom(room: GameRoom)
  → room.board is a clean Board (after Step B)
  → BoardView: domainToPresentation(room.board, GAME_HEX_SIZE) → BoardUIState
  → BoardContext holds BoardUIState; useBoardInteraction handles clicks
  → on build: SocketContext.buildSettlement(playerId, vertexId, roomId)
              SocketContext.buildRoad(playerId, edgeId, roomId)
  → backend mutates clean Board → emits gameUpdate → loop
```

### Step D — Wire up the root workspace
1. Add `"ui"` to `workspaces` in root `package.json`.
2. Add scripts:
   ```json
   "build:common": "npm run build -w common && npm run build -w common/v2",
   "dev:ui": "npm run build:common && npm run start -w ui",
   ```
   (Keep the existing `dev:backend`/`dev:frontend` scripts working. Note
   `build:common` must now ALSO build `common/v2` since the backend depends on
   it. `common/v2` has no `build` script yet — add `"scripts": { "build":
   "tsc -p tsconfig.json" }` to `common/v2/package.json`, or call tsc directly.)
3. `npm install` at root to link the new `ui` workspace.

### Step E — Final verification
```bash
# common/v2 core (must be fails 0)
cd /home/jia/Code/RiskOfCatan/common/v2 && rm -rf dist && ../../node_modules/.bin/tsc -p tsconfig.json && echo OK
# backend typecheck
cd /home/jia/Code/RiskOfCatan/backend && ../node_modules/.bin/tsc -b 2>&1 | head -40
# ui typecheck (must be ZERO errors)
cd /home/jia/Code/RiskOfCatan/ui && ../node_modules/.bin/tsc --noEmit 2>&1 | head -60
```
The success bar for this task: **`ui/` typechecks with zero errors** against
`common/v2`, the backend typechecks and boots, and `common/v2` core verifies
`fails 0`.

---

## 6. GOTCHAS / THINGS THAT BIT (do not repeat)

- **Do NOT build the legacy `common`** to fix anything — it's broken by design
  (half-migrated) and the app runs off the stale `dist`. Only build
  `common/v2`.
- **Vertex/edge ids MUST be exact-position-based** (`v_${Xb}_${Ya}`). Hex-set
  ids collide on boundary vertices (see §2.4). The `validateAdjacency` function
  catches this — always run it.
- **A road is ONE edge**, not two vertices. The old `buildRoad` took
  `startIntersectId`+`endIntersectId`; the new one takes a single `edgeId`.
  Update BOTH the backend handler AND the ui SocketContext to match.
- **`Set<number>` is not JSON-safe** — that's why the clean `Board` uses
  `string[]` / `Record`. Never put a `Set` in the wire `Board`.
- **CRA + workspace symlink:** `ui/` imports `common/v2` which resolves through
  the `node_modules/common` symlink to real source. This works because the
  resolved path is outside `node_modules`. If you ever see CRA refuse to
  compile `common/v2` files, check that the symlink is intact
  (`ls -la node_modules/common`).
- **TS version is 5.9.3** (root `node_modules/.bin/tsc`). `es5`/`node10`/
  `baseUrl` are deprecated → deprecation errors. Use `es2020`/`bundler`/no
  `baseUrl` in `ui/tsconfig.json`.
- **`common/v2/tsconfig.json` uses `module: node16` + `moduleResolution:
  node16`** and builds to `dist` as CommonJS — good for the backend (CommonJS
  runtime). The `ui/` (CRA/ESM) consumes it fine because CRA transpiles the
  resolved source. Don't "fix" v2's tsconfig to ESM.
- The old `frontend/src/containers/NewBoardView.tsx` and
  `common/v2/adapters/*` from a PREVIOUS attempt contained the same hex-set-id
  bugs and placeholder geometry — **ignore/replace** them; the current
  `common/v2/utils/adjacency.ts` + `types/Coordinates.ts` are the corrected,
  verified versions.

---

## 7. FILE MAP (what exists now)

```
common/v2/                      # CLEAN LAYER — complete, building, verified
  package.json                  # name common-v2, main/types -> dist  (NO build script yet — add in Step D)
  tsconfig.json                 # es2020 / node16 / declaration / outDir dist / strict
  index.ts                      # barrel
  Constant.ts                   # GAME_HEX_SIZE, LOBBY_HEX_SIZE, SOCKET_URL
  types/
    Coordinates.ts              # coords + EXACT corner id scheme (hexCornersExact, exactVertexId, ...)
    Board.ts                    # HexNode/VertexNode/EdgeNode/SettlementObj/RoadObj/Board
    Hex.ts                      # TOKENS/TERRAIN_COUNTS/assignStandardHexes/shuffle
    Pieces.ts                   # SoldierObj/DevCard/SettlementPlacement/RoadPlacement
    Player.ts                   # Player
    Logic.ts                    # TurnState/TradeState/BattleState/ResourceCount/Price/canAfford
    Room.ts                     # GameRoom (board: WireBoard|null  <-- change to Board|null in Step A)
    BoardUI.ts                  # BoardVertex/BoardEdge/BoardHex/BoardUIState/BuildMode
  utils/
    adjacency.ts                # computeAdjacency + validateAdjacency  (VERIFIED fails 0)
    boardGenerator.ts           # generateBoard/generateStandardBoard/generateCustomBoard
    placement.ts                # validSettlementVertices/validRoadEdges/playerSettlementVertexIds
  adapters/
    boardAdapter.ts             # domainToPresentation/updatePresentationState/extractBuildActions
    wireAdapter.ts              # wireBoardToDomain (legacy->clean; may be dropped after Step A/B)
  dist/                         # built + verified (std 19/54/72 fails 0; custom 5/19/23 fails 0)

ui/                             # NEW CRA CLIENT — partial
  package.json                  # react 19, react-scripts 5.0.1, socket.io-client
  tsconfig.json                 # HAS deprecation errors — fix in Step C.1
  public/index.html
  src/
    index.tsx                   # renders <App/> (App.tsx NOT created yet)
    index.css
    reportWebVitals.ts
    react-app-env.d.ts
    # MISSING: App.tsx, components/, containers/, contexts/, hooks/, pages/, services/

backend/src/index.ts            # LEGACY — adapt in Step B (createBoard, buildSettlement, buildRoad, import)
backend/src/utils/*             # legacy board utils (gameUtils/hexUtils/intersectUtils) — become unused
common/                         # LEGACY, BROKEN SOURCE — DO NOT TOUCH (app runs off common/dist)
frontend/                       # OLD CRA CLIENT — DO NOT TOUCH (runs off stale common/dist)
```

---

## 8. REFERENCE IMPLEMENTATIONS to mirror (in the OLD frontend, read-only)

- `frontend/src/contexts/BoardContext.tsx` — clean `useReducer` over `BoardUIState`.
- `frontend/src/hooks/useBoardInteraction.ts` — click/hover/build-mode logic.
- `frontend/src/components/BoardVertex.tsx` / `BoardEdge.tsx` — SVG vertex/edge.
- `frontend/src/contexts/SocketContext.tsx` — socket event wiring.
- `frontend/src/containers/NewBoardView.tsx` — board SVG layout (stub, use as
  a starting point for the real `ui/src/containers/BoardView.tsx`).
- `plans/board_ui_redesign.md` — the original design spec (component hierarchy,
  interaction states, visual design). Note its data-model section predates the
  id-scheme fix; use `common/v2` types as the source of truth.
