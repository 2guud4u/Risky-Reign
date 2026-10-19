# How to Run RiskyReign Project

## Problem Summary
The project had multiple issues:
1. Package.json configuration problems
2. Workspace dependency issues
3. Missing build configurations

## Solution Steps

### Step 1: Clean Installation
```bash
# Remove existing node_modules and lock files
rm -rf node_modules/ package-lock.json
rm -rf backend/node_modules/ backend/package-lock.json
rm -rf frontend/node_modules/ frontend/package-lock.json
rm -rf common/node_modules/ common/package-lock.json
```

### Step 2: Install Dependencies
```bash
# Install with yarn (recommended)
yarn install
```

### Step 3: Build Common Package First
```bash
# Build the common package
cd common
yarn build
cd ..
```

### Step 4: Run Backend and Frontend Separately (Alternative to dev command)
```bash
# Terminal 1: Run backend
cd backend
yarn dev

# Terminal 2: Run frontend  
cd frontend
yarn start
```

## Alternative: If you want to use the dev command
If you want to use the original dev command, make sure the common package builds properly first:

1. Build common package: `cd common && yarn build`
2. Then run: `yarn dev` from root

## Key Issues Fixed
1. **Path references**: Changed from `./.dist/` to `./dist/` in common/package.json
2. **Workspace names**: Added proper names to workspace packages
3. **Missing dependencies**: Added `concurrently` as dev dependency
4. **TypeScript configurations**: Fixed module resolution issues

## Troubleshooting
If you still have issues:
1. Make sure you're using Node.js version 18+
2. Verify all workspace packages have proper names
3. Check that `common` package builds successfully before other packages

The project should now be able to run properly with these changes.

## In-game controls

- Scroll over the board or double-click to zoom in, up to 6× the fitted view. Scroll down to zoom out to 0.5×. Drag empty board space to pan; **Reset view** or Shift+double-click restores the fitted view.
- Click a vertex or edge to focus it at 4× zoom (or keep your current zoom if already closer). Tune `SELECT_FOCUS_ZOOM` in `ui/src/constants.ts`; `MAX_ZOOM` controls the manual zoom limit.
- Individual soldier SVGs render only at 4× zoom or higher; below that the board shows soldier count badges. Tune `DETAIL_ZOOM_IN` in `ui/src/constants.ts`.
- The resource panel's bottom arrow opens development cards; the top arrow returns to resources.
- In the development-card view, click **Buy Dev Card** to expand its action bubble and show the cost, then click again to purchase. Unavailable purchases stay visible and expand to explain why they are blocked.

## Editing piece tint masks

Player-colored pieces are drawn from an art PNG plus a mask PNG (white = takes the player color). To repaint the settlement roof mask with a pen tablet:

```bash
npm run mask-painter   # http://localhost:5199
```

- **Roof mask** layer (`1`): paint where the player color goes. **Silhouette** layer (`2`): keep/remove pixels of the paper background (pre-filled automatically).
- Pen pressure sets brush size; the pen's eraser end (or `E`) erases. `[`/`]` size, Hardness slider softens the edge, `Tab` previews the tinted result in the swatch color, Space+drag pans, wheel zooms, `⌘Z`/`⇧⌘Z` undo/redo.
- `⌘S` saves the re-editable layers to `art-src/settlement.{mask,silhouette}.png` and rebuilds `ui/public/art/settlement.png` + `settlement_mask.png` from the untouched source `art-src/settlement.jpg` (cropped, long side 512).
- Add another piece by giving it a source in `art-src/` and an entry in `tools/mask-painter/pieces.ts`.
