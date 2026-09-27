import React from 'react';
import { terrainColors } from 'common';
import { TERRAIN_OPTIONS } from './constants';
import { TerrainPaletteProps } from './types';

/**
 * Terrain palette: click a terrain to apply it to the selected hex (or select
 * it for the next placement / paint), or drag it onto the board. The 🖌️
 * button toggles paint mode.
 */
const TerrainPalette: React.FC<TerrainPaletteProps> = ({
  paintMode,
  onTogglePaintMode,
  terrainCounts,
  activeTerrain,
  onTerrainClick,
  onTerrainDragStart,
  onDragEnd,
}) => (
  <div className="p-3 border border-gray-300 rounded-lg bg-white">
    <div className="flex items-center justify-between mb-2">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-gray-700">Terrain</h3>
        <p className="w-full max-w-[1200px] text-xs text-gray-500">
          Drag to place, right click to delete.</p>
      </div>
      <button
        onClick={onTogglePaintMode}
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
          onDragStart={(e) => onTerrainDragStart(e, t)}
          onDragEnd={onDragEnd}
          onClick={() => onTerrainClick(t)}
          title={`Apply ${t} to the selected hex (or set for the next placed / drag onto the board)`}
          className={`flex items-center gap-2 px-2 py-1.5 border rounded-md text-sm cursor-grab active:cursor-grabbing ${
            activeTerrain === t ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'
          }`}
        >
          <span className="w-4 h-4 rounded-full border border-gray-400" style={{ background: terrainColors[t] }} />
          {t}
          <span className="ml-auto text-xs text-gray-400">{terrainCounts[t]}</span>
        </button>
      ))}
    </div>
  </div>
);

export default TerrainPalette;
