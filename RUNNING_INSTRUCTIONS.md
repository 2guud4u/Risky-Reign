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