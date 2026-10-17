import React from 'react';
import { terrainColors } from 'common';
import { TERRAIN_OPTIONS } from './constants';
import { Tactic, TerrainPaletteProps, TerrainTarget } from './types';
import GameIcon from '../components/ui/GameIcon';

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
  terrainTactic,
  terrainTarget,
  excludeWater,
  onTerrainTacticChange,
  onTerrainTargetChange,
  onExcludeWaterChange,
  onAssignTerrain,
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
        <GameIcon name="palette" size={14} />
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

    <div className="flex gap-2 mt-3">
      <div className="flex-1">
        <label className="block text-xs font-semibold text-gray-600 mb-1">Tactic</label>
        <select
          value={terrainTactic}
          onChange={(e) => onTerrainTacticChange(e.target.value as Tactic)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white cursor-pointer"
        >
          <option value="equal">Equal (standard ratio)</option>
          <option value="random">Random</option>
          <option value="current" disabled={terrainTarget === 'all'}>
            Current (shuffle existing)
          </option>
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-xs font-semibold text-gray-600 mb-1">Target</label>
        <select
          value={terrainTarget}
          onChange={(e) => onTerrainTargetChange(e.target.value as TerrainTarget)}
          className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm bg-white cursor-pointer"
        >
          <option value="all" disabled={terrainTactic === 'current'}>
            All placed
          </option>
          <option value="land only">Land only</option>
        </select>
      </div>
    </div>
    <label className="flex items-center gap-2 mt-2 text-xs text-gray-600 cursor-pointer">
      <input
        type="checkbox"
        checked={excludeWater}
        onChange={(e) => onExcludeWaterChange(e.target.checked)}
        className="cursor-pointer"
      />
      Exclude water — sea hexes never change or move
    </label>
    <button
      onClick={onAssignTerrain}
      className="w-full mt-2 px-2 py-1.5 border border-blue-300 bg-blue-50 text-blue-700 rounded-md text-sm cursor-pointer"
    >
      Assign terrain
    </button>
  </div>
);

export default TerrainPalette;
