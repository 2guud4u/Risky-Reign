import React, { useState, useCallback } from 'react';
import {
  Terrain,
  CubeCoord,
  Board,
  assignStandardHexes,
  BOARD_RADIUS,
  validateLayouts,
  terrainColors,
} from 'common';
import { useSocket } from '../contexts/SocketContext';
import BoardEditorCanvas from '../components/BoardEditorCanvas';
import { EditorMap, coordKey, toHexLayouts } from '../types/BoardEditor';

/**
 * The board editor page. Reached from the waiting room (edit an existing
 * room's board) or the lobby (create a room with a custom board). Opens
 * with the current board (or a standard board if none), the player
 * edits/deletes/adds hexes on an infinite grid, then saves.
 */

const TERRAIN_OPTIONS: Terrain[] = ['Wood', 'Sheep', 'Wheat', 'Brick', 'Ore', 'Desert', 'Water'];
const NUMBER_OPTIONS = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];

/** Seed an EditorMap from a fresh standard board. */
function standardBoardMap(): EditorMap {
  const map: EditorMap = {};
  for (const h of assignStandardHexes(BOARD_RADIUS)) {
    map[coordKey(h.coord)] = { coord: h.coord, terrain: h.terrain, rollNumber: h.rollNumber };
  }
  return map;
}

/** Seed an EditorMap from an existing board. */
function boardToMap(board: Board): EditorMap {
  const map: EditorMap = {};
  for (const h of Object.values(board.hexes)) {
    map[coordKey(h.coord)] = { coord: h.coord, terrain: h.terrain as Terrain, rollNumber: h.rollNumber };
  }
  return map;
}

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm';

interface BoardEditorProps {
  /** When set, the editor edits this existing room's board (Save → editBoard). */
  roomId?: string;
  /** The board to seed the draft from (defaults to a standard board). */
  initialBoard?: Board;
  onBack: () => void;
}

const BoardEditorPage: React.FC<BoardEditorProps> = ({ roomId, initialBoard, onBack }) => {
  const [map, setMap] = useState<EditorMap>(() => (initialBoard ? boardToMap(initialBoard) : standardBoardMap()));
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain>('Wood');
  const [selectedCoord, setSelectedCoord] = useState<string | null>(null);
  const [stashedNumber, setStashedNumber] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [toolbarDrag, setToolbarDrag] = useState<{ kind: 'terrain' | 'number'; value: Terrain | number } | null>(null);
  const { joinRoom, editBoard } = useSocket();
  const selectedHex = selectedCoord ? map[selectedCoord] : null;

  const handleAdd = useCallback((coord: CubeCoord, terrain: Terrain) => {
    setMap((m) => {
      const key = coordKey(coord);
      if (m[key]) return m; // already placed
      return { ...m, [key]: { coord, terrain, rollNumber: null } };
    });
  }, []);

  const handleRemove = useCallback((key: string) => {
    setMap((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });
    setSelectedCoord((c) => (c === key ? null : c));
  }, []);

  const setTerrain = (terrain: Terrain) => {
    if (!selectedCoord) return;
    setMap((m) => {
      const hex = m[selectedCoord];
      if (!hex) return m;
      // Desert / Water cannot carry a number.
      const rollNumber = terrain === 'Desert' || terrain === 'Water' ? null : hex.rollNumber;
      return { ...m, [selectedCoord]: { ...hex, terrain, rollNumber } };
    });
  };

  const setNumber = (n: number | null) => {
    if (!selectedCoord) return;
    setMap((m) => {
      const hex = m[selectedCoord];
      if (!hex) return m;
      if (hex.terrain === 'Desert' || hex.terrain === 'Water') return m; // no numbers on these
      return { ...m, [selectedCoord]: { ...hex, rollNumber: n } };
    });
  };

  const takeNumber = () => {
    if (!selectedHex || selectedHex.rollNumber === null) return;
    setStashedNumber(selectedHex.rollNumber);
    setNumber(null);
  };

  const placeNumber = () => {
    if (stashedNumber === null) return;
    setNumber(stashedNumber);
    setStashedNumber(null);
  };

  const handleMoveHex = useCallback((from: CubeCoord, to: CubeCoord) => {
    setMap((m) => {
      const fromKey = coordKey(from);
      const toKey = coordKey(to);
      const hex = m[fromKey];
      if (!hex || m[toKey]) return m;
      const next = { ...m };
      delete next[fromKey];
      next[toKey] = { ...hex, coord: to };
      return next;
    });
  }, []);

  const handleMoveNumber = useCallback((from: CubeCoord, to: CubeCoord) => {
    setMap((m) => {
      const fromKey = coordKey(from);
      const toKey = coordKey(to);
      const src = m[fromKey];
      const dst = m[toKey];
      if (!src || src.rollNumber === null || !dst) return m;
      if (dst.terrain === 'Desert' || dst.terrain === 'Water') return m;
      const next = { ...m };
      next[fromKey] = { ...src, rollNumber: null };
      next[toKey] = { ...dst, rollNumber: src.rollNumber };
      return next;
    });
  }, []);

  const handlePlaceNumber = useCallback((coord: CubeCoord, number: number) => {
    setMap((m) => {
      const key = coordKey(coord);
      const hex = m[key];
      if (!hex) return m;
      if (hex.terrain === 'Desert' || hex.terrain === 'Water') return m;
      return { ...m, [key]: { ...hex, rollNumber: number } };
    });
  }, []);

  const resetToStandard = () => {
    setMap(standardBoardMap());
    setSelectedCoord(null);
    setStashedNumber(null);
  };

  const generateRoomId = () => {
    setNewRoomId(Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  const validation = validateLayouts(toHexLayouts(map));
  // Editing an existing room only needs a valid layout; creating a new room
  // also needs a name + room id.
  const canSave = validation.allowed && (roomId ? true : playerName.trim() !== '' && newRoomId.trim() !== '');

  // Counts of each terrain and each roll number, for the summary panel.
  const terrainCounts = TERRAIN_OPTIONS.reduce(
    (acc, t) => ({ ...acc, [t]: Object.values(map).filter((h) => h.terrain === t).length }),
    {} as Record<Terrain, number>
  );
  const numberCounts = NUMBER_OPTIONS.reduce(
    (acc, n) => ({ ...acc, [n]: Object.values(map).filter((h) => h.rollNumber === n).length }),
    {} as Record<number, number>
  );

  const handleSave = () => {
    if (!canSave) return;
    const layouts = toHexLayouts(map);
    if (roomId) {
      editBoard(roomId, layouts);
    } else {
      joinRoom(playerName.trim(), newRoomId.trim(), undefined, layouts);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center p-4 gap-4">
      {/* Top bar */}
      <div className="w-full max-w-[1200px] flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">Board Editor</h1>
        <button
          onClick={onBack}
          className="px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-sm cursor-pointer"
        >
          ← Back to Lobby
        </button>
        <button
          onClick={resetToStandard}
          className="px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-sm cursor-pointer"
        >
          Reset to Standard
        </button>
        <span className="text-sm text-gray-500">
          {Object.keys(map).length} hexes · {validation.allowed ? 'valid' : `invalid: ${validation.reason}`}
        </span>
      </div>
      <p className="w-full max-w-[1200px] text-xs text-gray-500">
        Click empty cell to add · drag a hex to move it · drag a number token to move it · drag a terrain/number from the toolbar to place it · right-click (or double-click) a hex to delete
      </p>
      <div className="w-full max-w-[1200px] flex gap-4 flex-col lg:flex-row">
        {/* Canvas */}
        <div className="flex-1 h-[650px] border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
          <BoardEditorCanvas
            map={map}
            selectedTerrain={selectedTerrain}
            selectedCoord={selectedCoord}
            onSelect={setSelectedCoord}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onMoveHex={handleMoveHex}
            onMoveNumber={handleMoveNumber}
            onPlaceNumber={handlePlaceNumber}
            toolbarDrag={toolbarDrag}
          />
        </div>

        {/* Toolbar */}
        <div className="w-full lg:w-[300px] flex flex-col gap-4">
          {/* Terrain palette */}
          <div className="p-3 border border-gray-300 rounded-lg bg-white">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Terrain 
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {TERRAIN_OPTIONS.map((t) => (
                <button
                  key={t}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', `terrain:${t}`);
                    e.dataTransfer.effectAllowed = 'move';
                    setToolbarDrag({ kind: 'terrain', value: t });
                  }}
                  onDragEnd={() => setToolbarDrag(null)}
                  onClick={() => (selectedCoord ? setTerrain(t) : setSelectedTerrain(t))}
                  title={`Drag onto the board to place a ${t} hex`}
                  className={`flex items-center gap-2 px-2 py-1.5 border rounded-md text-sm cursor-grab active:cursor-grabbing ${
                    (selectedCoord ? selectedHex?.terrain === t : selectedTerrain === t)
                      ? 'border-blue-500 ring-1 ring-blue-500'
                      : 'border-gray-300'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full border border-gray-400" style={{ background: terrainColors[t] }} />
                  {t}
                  <span className="ml-auto text-xs text-gray-400">{terrainCounts[t]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Number palette */}
          <div className="p-3 border border-gray-300 rounded-lg bg-white">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Number 
            </h3>
            <div className="flex flex-wrap gap-2">
              {NUMBER_OPTIONS.map((n) => (
                <button
                  key={n}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', `number:${n}`);
                    e.dataTransfer.effectAllowed = 'move';
                    setToolbarDrag({ kind: 'number', value: n });
                  }}
                  onDragEnd={() => setToolbarDrag(null)}
                  onClick={() => setNumber(n)}
                  title={`Drag onto a hex to set ${n}`}
                  className={`w-9 h-9 rounded-full border text-sm font-semibold cursor-grab active:cursor-grabbing ${
                    selectedHex?.rollNumber === n ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'
                  }`}
                >
                  <span className="flex flex-col items-center leading-none">
                    {n}
                    <span className="text-[9px] text-gray-400">{numberCounts[n]}</span>
                  </span>
                </button>
              ))}
              <button
                onClick={() => setNumber(null)}
                disabled={!selectedCoord}
                className="px-3 h-9 border border-gray-300 rounded-md text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear
              </button>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={takeNumber}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Take number
              </button>
              <button
                onClick={placeNumber}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Place {stashedNumber !== null ? `(${stashedNumber})` : ''}
              </button>
            </div>
            <button
              onClick={() => selectedCoord && handleRemove(selectedCoord)}
              disabled={!selectedCoord}
              className="w-full mt-3 px-2 py-1.5 border border-red-300 bg-red-50 text-red-700 rounded-md text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Remove selected hex
            </button>
          </div>

          {/* Save & Start */}
          <div className="p-3 border border-gray-300 rounded-lg bg-white">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{roomId ? 'Save Board' : 'Save & Start'}</h3>
            <div className="flex flex-col gap-2">
              {!roomId && (
                <>
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Your name"
                    className={inputClass}
                  />
                  <div className="flex gap-2">
                    <input
                      value={newRoomId}
                      onChange={(e) => setNewRoomId(e.target.value)}
                      placeholder="Room ID"
                      className={`${inputClass} flex-1`}
                    />
                    <button
                      onClick={generateRoomId}
                      title="Generate random room ID"
                      className="px-3 border border-gray-300 rounded-md bg-gray-100 cursor-pointer"
                    >
                      🎲
                    </button>
                  </div>
                </>
              )}
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={`py-2 px-4 border-0 rounded-md text-sm font-semibold text-white cursor-pointer ${
                  canSave ? 'bg-blue-600' : 'bg-gray-400 cursor-not-allowed'
                }`}
              >
                {roomId ? 'Save Board' : 'Save & Start Game'}
              </button>
              {!validation.allowed && (
                <p className="text-xs text-red-600">{validation.reason}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardEditorPage;
