import React, { useState } from 'react';
import { Terrain, PortType, MAP_CATALOG, validateLayouts } from 'common';
import BoardEditorCanvas from './BoardEditorCanvas';
import EditorTopBar from './EditorTopBar';
import TerrainPalette from './TerrainPalette';
import NumberPalette from './NumberPalette';
import DockPalette from './DockPalette';
import MapsPalette from './MapsPalette';
import SavePanel from './SavePanel';
import { useMapFavorites } from '../hooks/useMapFavorites';
import { BoardEditorProps, Tactic, Target, TerrainTarget, ToolbarDrag } from './types';
import { countMissingNumbers, countRollNumbers, countTerrain, setCustomDragImage, toHexLayouts } from './utils';
import { useEditorMap } from './useEditorMap';

type SidebarTab = 'terrain' | 'numbers' | 'docks' | 'maps';

/**
 * The board editor — the Board tab of Customize Game. Opens with the room's
 * current board; the player edits/deletes/adds hexes on an infinite grid,
 * then Save Board pushes the layout to the room (editBoard). Refresh Map in
 * the top bar asks the server for a fresh random map; the parent remounts
 * this component when the room board changes.
 */
const BoardEditorPage: React.FC<BoardEditorProps> = ({ initialBoard, onRefreshMap }) => {
  const {
    map,
    docks,
    coast,
    selectedCoord,
    setSelectedCoord,
    selectedHex,
    addHex,
    removeHex,
    clearNumber,
    setTerrain,
    setNumber,
    assign,
    moveHex,
    moveNumber,
    moveDock,
    stretchDock,
    randomizeDocks,
    addDock,
    removeDock,
    setDockPort,
    placeNumber,
    paintHex,
    resetToStandard,
    resetToExpansion,
    loadDraft,
    assignTerrainDraft,
    draftDirty,
  } = useEditorMap(initialBoard);
  const { favorites, toggle: toggleFavorite } = useMapFavorites();
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain>('Wood');
  const [paintMode, setPaintMode] = useState(false);
  const [tactic, setTactic] = useState<Tactic>('random');
  const [target, setTarget] = useState<Target>('all');
  const [terrainTactic, setTerrainTactic] = useState<Tactic>('random');
  const [terrainTarget, setTerrainTarget] = useState<TerrainTarget>('land only');
  const [excludeWater, setExcludeWater] = useState(true);
  const [toolbarDrag, setToolbarDrag] = useState<ToolbarDrag | null>(null);
  // Sidebar tabs share the toolbar column; the active one also flips the
  // canvas into docks mode (grips, add-handles, dock selection).
  const [tab, setTab] = useState<SidebarTab>('terrain');
  const [selectedDock, setSelectedDock] = useState<number | null>(null);
  const [pendingPort, setPendingPort] = useState<PortType>('generic');
  const docksMode = tab === 'docks';

  const validation = validateLayouts(toHexLayouts(map));
  // Every hex that can carry a number (not Desert/Water) must have one before
  // the game can start.
  const missingNumbers = countMissingNumbers(map);

  // Counts of each terrain and each roll number, for the summary panel.
  const terrainCounts = countTerrain(map);
  const numberCounts = countRollNumbers(map);

  const endToolbarDrag = () => setToolbarDrag(null);

  /** Palette click: with a dock selected it reassigns that dock's port;
      otherwise it just arms the type for the next added dock. */
  const portClick = (p: PortType) => {
    if (selectedDock !== null) setDockPort(selectedDock, p);
    setPendingPort(p);
  };

  const dockRemove = (i: number) => {
    removeDock(i);
    setSelectedDock((s) => (s === i ? null : s !== null && s > i ? s - 1 : s));
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <EditorTopBar
        onRefreshMap={onRefreshMap}
        hexCount={Object.keys(map).length}
        validation={validation}
        missingNumbers={missingNumbers}
      />
      <div className="w-full max-w-[1200px] flex gap-4 flex-col lg:flex-row">
        {/* Canvas */}
        <div className="flex-1 h-[650px] border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
          <BoardEditorCanvas
            map={map}
            selectedTerrain={selectedTerrain}
            selectedCoord={selectedCoord}
            onSelect={setSelectedCoord}
            onAdd={addHex}
            onRemove={removeHex}
            onClearNumber={clearNumber}
            onMoveHex={moveHex}
            onMoveNumber={moveNumber}
            onPlaceNumber={placeNumber}
            onPaint={(coord) => paintHex(coord, selectedTerrain)}
            paintMode={paintMode}
            toolbarDrag={toolbarDrag}
            coast={coast}
            docks={docks}
            onMoveDock={moveDock}
            onStretchDock={stretchDock}
            docksMode={docksMode}
            selectedDock={selectedDock}
            onSelectDock={setSelectedDock}
            onAddDock={(to) => addDock(to, pendingPort)}
            onRemoveDock={dockRemove}
          />
        </div>

        {/* Toolbar: tabbed palettes share the column; Save Board sits below. */}
        <div className="w-full lg:w-[300px] flex flex-col gap-4">
          <div className="flex gap-1 border-b border-gray-300">
            {(
              [
                ['terrain', 'Terrain'],
                ['numbers', 'Numbers'],
                ['docks', 'Docks'],
                ['maps', 'Maps'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-selected={tab === key}
                className={`px-3 py-1.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                  tab === key
                    ? 'border-blue-500 text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === 'terrain' && (
            <TerrainPalette
              paintMode={paintMode}
              onTogglePaintMode={() => setPaintMode((p) => !p)}
              terrainCounts={terrainCounts}
              activeTerrain={selectedCoord ? selectedHex?.terrain ?? null : selectedTerrain}
              onTerrainClick={(t) => (selectedCoord ? setTerrain(t) : setSelectedTerrain(t))}
              onTerrainDragStart={(e, t) => {
                e.dataTransfer.setData('text/plain', `terrain:${t}`);
                e.dataTransfer.effectAllowed = 'move';
                setCustomDragImage(e, 'terrain', t);
                setToolbarDrag({ kind: 'terrain', value: t });
              }}
              onDragEnd={endToolbarDrag}
              terrainTactic={terrainTactic}
              terrainTarget={terrainTarget}
              excludeWater={excludeWater}
              onTerrainTacticChange={setTerrainTactic}
              onTerrainTargetChange={setTerrainTarget}
              onExcludeWaterChange={setExcludeWater}
              onAssignTerrain={() => assignTerrainDraft(terrainTactic, terrainTarget, excludeWater)}
            />
          )}
          {tab === 'numbers' && (
            <NumberPalette
              selectedNumber={selectedHex?.rollNumber ?? null}
              numberCounts={numberCounts}
              tactic={tactic}
              target={target}
              onTacticChange={setTactic}
              onTargetChange={setTarget}
              onNumberClick={setNumber}
              onNumberDragStart={(e, n) => {
                e.dataTransfer.setData('text/plain', `number:${n}`);
                e.dataTransfer.effectAllowed = 'move';
                setCustomDragImage(e, 'number', n);
                setToolbarDrag({ kind: 'number', value: n });
              }}
              onDragEnd={endToolbarDrag}
              onAssign={() => assign(tactic, target)}
            />
          )}
          {tab === 'docks' && (
            <DockPalette
              docks={docks}
              selectedDockIndex={selectedDock}
              pendingPort={pendingPort}
              onPortClick={portClick}
              onPortDragStart={(e, p) => {
                e.dataTransfer.setData('text/plain', `port:${p}`);
                e.dataTransfer.effectAllowed = 'move';
                setCustomDragImage(e, 'port', p);
                setToolbarDrag({ kind: 'port', value: p });
              }}
              onDragEnd={endToolbarDrag}
              onRandomize={() => {
                randomizeDocks();
                setSelectedDock(null); // indices churn; nothing to point at
              }}
              onRemoveDock={dockRemove}
            />
          )}
          {tab === 'maps' && (
            <MapsPalette
              maps={MAP_CATALOG}
              favorites={favorites}
              draftDirty={draftDirty}
              onToggleFavorite={toggleFavorite}
              onLoad={(entry) => loadDraft(entry.layouts, entry.docks)}
              onGenerate={(kind) => (kind === 'standard' ? resetToStandard() : resetToExpansion())}
            />
          )}
          <SavePanel
            map={map}
            docks={docks}
            validation={validation}
            missingNumbers={missingNumbers}
          />
        </div>
      </div>
    </div>
  );
};

export default BoardEditorPage;
