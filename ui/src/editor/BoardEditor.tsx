import React, { useState, useCallback, useRef } from 'react';
import { Terrain, CubeCoord, validateLayouts, terrainColors, shuffle } from 'common';
import { useSocket } from '../contexts/SocketContext';
import BoardEditorCanvas from './BoardEditorCanvas';
import { EditorMap, Tactic, Target, BoardEditorProps } from './types';
import { TERRAIN_OPTIONS, NUMBER_OPTIONS, inputClass } from './constants';
import { balancedNumbers, standardBoardMap, boardToMap, expansionBoardMap, setCustomDragImage, toHexLayouts, coordKey } from './utils';

/**
 * The board editor page. Reached from the waiting room (edit an existing
 * room's board) or the lobby (create a room with a custom board). Opens
 * with the current board (or a standard board if none), the player
 * edits/deletes/adds hexes on an infinite grid, then saves.
 */

const BoardEditorPage: React.FC<BoardEditorProps> = ({ roomId, initialBoard, onBack }) => {
  const [map, setMap] = useState<EditorMap>(() => (initialBoard ? boardToMap(initialBoard) : standardBoardMap()));
  const [selectedTerrain, setSelectedTerrain] = useState<Terrain>('Wood');
  const [paintMode, setPaintMode] = useState(false);
  const [tactic, setTactic] = useState<Tactic>('random');
  const [target, setTarget] = useState<Target>('all');
  const [selectedCoord, setSelectedCoord] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [toolbarDrag, setToolbarDrag] = useState<{ kind: 'terrain' | 'number'; value: Terrain | number } | null>(null);
  const [history, setHistory] = useState<Array<{ id: number; label: string; time: string; map: EditorMap }>>([]);
  const historyIdRef = useRef(0);
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

  const clearNumber = useCallback((key: string) => {
    setMap((m) => {
      const hex = m[key];
      if (!hex) return m;
      return { ...m, [key]: { ...hex, rollNumber: null } };
    });
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

  const assignNumbers = () => {
    setMap((m) => {
      // Hexes that can carry a number (not Desert/Water).
      const eligible = Object.entries(m).filter(
        ([, hex]) => hex.terrain !== 'Desert' && hex.terrain !== 'Water'
      );
      // Narrow by target.
      let targets: [string, (typeof m)[string]][];
      if (target === 'only empty') targets = eligible.filter(([, hex]) => hex.rollNumber === null);
      else if (target === 'only filled') targets = eligible.filter(([, hex]) => hex.rollNumber !== null);
      else targets = eligible;

      // Build the number pool based on the tactic.
      let pool: number[];
      if (tactic === 'equal') {
        pool = balancedNumbers(targets.length);
      } else if (tactic === 'current') {
        pool = shuffle(
          Object.values(m)
            .filter((hex) => hex.rollNumber !== null)
            .map((hex) => hex.rollNumber as number)
        );
        // Pad with random if there are fewer current numbers than targets.
        while (pool.length < targets.length) {
          pool.push(NUMBER_OPTIONS[Math.floor(Math.random() * NUMBER_OPTIONS.length)]);
        }
        pool = pool.slice(0, targets.length);
      } else {
        // 'random'
        pool = targets.map(() => NUMBER_OPTIONS[Math.floor(Math.random() * NUMBER_OPTIONS.length)]);
      }

      const next = { ...m };
      targets.forEach(([key], i) => {
        next[key] = { ...next[key], rollNumber: pool[i] };
      });
      return next;
    });
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
      // Swap the numbers: the source takes the target's number (null if the
      // target has none, i.e. a plain move), the target takes the source's.
      next[fromKey] = { ...src, rollNumber: dst.rollNumber };
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

  const handlePaint = useCallback(
    (coord: CubeCoord) => {
      setMap((m) => {
        const key = coordKey(coord);
        const hex = m[key];
        if (!hex) return m;
        // Desert / Water cannot carry a number.
        const rollNumber = selectedTerrain === 'Desert' || selectedTerrain === 'Water' ? null : hex.rollNumber;
        return { ...m, [key]: { ...hex, terrain: selectedTerrain, rollNumber } };
      });
    },
    [selectedTerrain]
  );

  const resetToStandard = () => {
    setMap(standardBoardMap());
    setSelectedCoord(null);
  };

  const resetToExpansion = () => {
    setMap(expansionBoardMap());
    setSelectedCoord(null);
  };

  const generateRoomId = () => {
    setNewRoomId(Math.random().toString(36).substring(2, 8).toUpperCase());
  };

  const validation = validateLayouts(toHexLayouts(map));
  // Every hex that can carry a number (not Desert/Water) must have one before
  // the game can start.
  const missingNumbers = Object.values(map).filter(
    (h) => h.terrain !== 'Desert' && h.terrain !== 'Water' && h.rollNumber === null
  ).length;
  // Editing an existing room needs a valid layout + no missing numbers; creating
  // a new room also needs a name + room id.
  const canSave = validation.allowed && missingNumbers === 0 && (roomId ? true : playerName.trim() !== '' && newRoomId.trim() !== '');

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
    // Snapshot the current board into the history stack so the player can
    // click a previous save to go back to it.
    historyIdRef.current += 1;
    const snapshot = {
      id: historyIdRef.current,
      label: `Save #${historyIdRef.current}`,
      time: new Date().toLocaleTimeString(),
      map: JSON.parse(JSON.stringify(map)) as EditorMap,
    };
    setHistory((h) => [...h, snapshot]);
    const layouts = toHexLayouts(map);
    if (roomId) {
      editBoard(roomId, layouts);
    } else {
      joinRoom(playerName.trim(), newRoomId.trim(), undefined, layouts);
    }
  };

  // Restore a saved snapshot (go back to it).
  const restoreSnapshot = (snapshotMap: EditorMap) => {
    setMap(JSON.parse(JSON.stringify(snapshotMap)) as EditorMap);
    setSelectedCoord(null);
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
        <button
          onClick={resetToExpansion}
          className="px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-sm cursor-pointer"
        >
          Reset to Expansion
        </button>
        <span className="text-sm text-gray-500">
          {Object.keys(map).length} hexes · {validation.allowed ? 'valid' : `invalid: ${validation.reason}`}
          {missingNumbers > 0 ? ` · ${missingNumbers} missing number${missingNumbers > 1 ? 's' : ''}` : ''}
        </span>
      </div>
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
            onClearNumber={clearNumber}
            onMoveHex={handleMoveHex}
            onMoveNumber={handleMoveNumber}
            onPlaceNumber={handlePlaceNumber}
            onPaint={handlePaint}
            paintMode={paintMode}
            toolbarDrag={toolbarDrag}
          />
        </div>

        {/* Toolbar */}
        <div className="w-full lg:w-[300px] flex flex-col gap-4">
          {/* Terrain palette */}
          <div className="p-3 border border-gray-300 rounded-lg bg-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold text-gray-700">Terrain</h3>
                <p className="w-full max-w-[1200px] text-xs text-gray-500">
                  Drag to place, right click to delete.</p>
              </div>
              <button
                onClick={() => setPaintMode((p) => !p)}
                title={paintMode ? 'Paint mode ON: click a hex to paint it' : 'Paint mode OFF: click a hex to select it'}
                className={`p-1 rounded-md border text-sm cursor-pointer ${paintMode ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-gray-100'
                  }`}
              >
                🖌️
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TERRAIN_OPTIONS.map((t) => (
                <button
                  key={t}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', `terrain:${t}`);
                    e.dataTransfer.effectAllowed = 'move';
                    setCustomDragImage(e, 'terrain', t);
                    setToolbarDrag({ kind: 'terrain', value: t });
                  }}
                  onDragEnd={() => setToolbarDrag(null)}
                  onClick={() => (selectedCoord ? setTerrain(t) : setSelectedTerrain(t))}
                  title={`Apply ${t} to the selected hex (or set for the next placed / drag onto the board)`}
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
            <h3 className="text-sm font-semibold text-gray-700 ">
              Number
            </h3>
                <p className="w-full max-w-[1200px] text-xs text-gray-500 mb-2">
                  Drag to place or click hex and select a number.</p>
            <div className="flex flex-wrap gap-2">
              {NUMBER_OPTIONS.map((n) => (
                <button
                  key={n}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', `number:${n}`);
                    e.dataTransfer.effectAllowed = 'move';
                    setCustomDragImage(e, 'number', n);
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
            </div>
            <div className="flex gap-2 mt-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tactic</label>
                <select
                  value={tactic}
                  onChange={(e) => setTactic(e.target.value as Tactic)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white cursor-pointer"
                >
                  <option value="equal">Equal (standard ratio)</option>
                  <option value="random">Random</option>
                  <option value="current" disabled={target === 'all'}>
                    Current (shuffle existing)
                  </option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Target</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value as Target)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white cursor-pointer"
                >
                  <option value="all" disabled={tactic === 'current'}>
                    All
                  </option>
                  <option value="only empty">Only empty</option>
                  <option value="only filled">Only filled</option>
                </select>
              </div>
            </div>
            <button
              onClick={assignNumbers}
              className="w-full mt-2 px-2 py-1.5 border border-blue-300 bg-blue-50 text-blue-700 rounded-md text-sm cursor-pointer"
            >
              Assign numbers
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
              {validation.allowed && missingNumbers > 0 && (
                <p className="text-xs text-red-600">
                  {missingNumbers} hex{missingNumbers > 1 ? 'es' : ''} missing a number (Desert/Water are exempt)
                </p>
              )}
              {history.length > 0 && (
                <div className="mt-2">
                  <h4 className="text-xs font-semibold text-gray-600 mb-1">History (click to go back)</h4>
                  <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                    {[...history].reverse().map((snap) => (
                      <button
                        key={snap.id}
                        onClick={() => restoreSnapshot(snap.map)}
                        className="flex items-center justify-between px-2 py-1 border border-gray-200 rounded-md text-xs cursor-pointer hover:bg-blue-50"
                      >
                        <span className="font-semibold text-gray-700">{snap.label}</span>
                        <span className="text-gray-400">{snap.time}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardEditorPage;
