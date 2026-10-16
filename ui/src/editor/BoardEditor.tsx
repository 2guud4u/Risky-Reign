import React, { useState } from 'react';
import { Terrain, validateLayouts } from 'common';
import BoardEditorCanvas from './BoardEditorCanvas';
import EditorTopBar from './EditorTopBar';
import TerrainPalette from './TerrainPalette';
import NumberPalette from './NumberPalette';
import SavePanel from './SavePanel';
import { BoardEditorProps, Tactic, Target, ToolbarDrag } from './types';
import { countMissingNumbers, countRollNumbers, countTerrain, setCustomDragImage, toHexLayouts } from './utils';
import { useEditorMap } from './useEditorMap';

/**
 * The board editor — the Board tab of Customize Game. Opens with the room's
 * current board; the player edits/deletes/adds hexes on an infinite grid,
 * then Save Board pushes the layout to the room (editBoard). Refresh Map in
 * the top bar asks the server for a fresh random map; the parent remounts
 * this component when the room board changes.
 */
const BoardEditorPage: React.FC<BoardEditorProps> = ({ roomId, initialBoard, onRefreshMap }) => {
  const {
    map,
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
    placeNumber,
    paintHex,
    resetToStandard,
    resetToExpansion,
  } = useEditorMap(initialBoard);
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain>('Wood');
  const [paintMode, setPaintMode] = useState(false);
  const [tactic, setTactic] = useState<Tactic>('random');
  const [target, setTarget] = useState<Target>('all');
  const [toolbarDrag, setToolbarDrag] = useState<ToolbarDrag | null>(null);

  const validation = validateLayouts(toHexLayouts(map));
  // Every hex that can carry a number (not Desert/Water) must have one before
  // the game can start.
  const missingNumbers = countMissingNumbers(map);

  // Counts of each terrain and each roll number, for the summary panel.
  const terrainCounts = countTerrain(map);
  const numberCounts = countRollNumbers(map);

  const endToolbarDrag = () => setToolbarDrag(null);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <EditorTopBar
        onResetStandard={resetToStandard}
        onResetExpansion={resetToExpansion}
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
          />
        </div>

        {/* Toolbar */}
        <div className="w-full lg:w-[300px] flex flex-col gap-4">
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
          />
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
          <SavePanel
            roomId={roomId}
            map={map}
            validation={validation}
            missingNumbers={missingNumbers}
          />
        </div>
      </div>
    </div>
  );
};

export default BoardEditorPage;
