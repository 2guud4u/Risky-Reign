import React from 'react';
import { terrainColors } from 'common';
import { TERRAIN_OPTIONS } from './constants';
import { Tactic, TerrainPaletteProps, TerrainTarget } from './types';
import GameIcon from '../components/ui/GameIcon';
import Button from '../components/ui/Button';

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
  <div className="p-3 border border-ink-faint/50 rounded-lg bg-canvas-raised">
    <div className="flex items-center justify-between mb-2">
      <div className="flex flex-col">
        <h3 className="text-sm font-semibold text-ink-soft">Terrain</h3>
        <p className="w-full max-w-[1200px] text-xs text-ink-faint">
          Drag to place, right click to delete.</p>
      </div>
      <Button
        variant="unstyled"
        onClick={onTogglePaintMode}
        title={paintMode ? 'Paint mode ON: click a hex to paint it' : 'Paint mode OFF: click a hex to select it'}
        className={`p-1 rounded-md border text-sm ${paintMode ? 'bg-sky border-sky text-white' : 'border-ink-faint/50 bg-canvas-sunken'
          }`}
      >
        <GameIcon name="palette" size={14} />
      </Button>
    </div>

    <div className="grid grid-cols-2 gap-2">
      {TERRAIN_OPTIONS.map((t) => (
        <Button
          key={t}
          variant="unstyled"
          draggable
          onDragStart={(e) => onTerrainDragStart(e, t)}
          onDragEnd={onDragEnd}
          onClick={() => onTerrainClick(t)}
          title={`Apply ${t} to the selected hex (or set for the next placed / drag onto the board)`}
          className={`flex items-center gap-2 px-2 py-1.5 border rounded-md text-sm cursor-grab active:cursor-grabbing ${
            activeTerrain === t ? 'border-sky ring-1 ring-sky' : 'border-ink-faint/50'
          }`}
        >
          <span className="w-4 h-4 rounded-full border border-ink-soft" style={{ background: terrainColors[t] }} />
          {t}
          <span className="ml-auto text-xs text-ink-faint">{terrainCounts[t]}</span>
        </Button>
      ))}
    </div>

    <div className="flex gap-2 mt-3">
      <div className="flex-1">
        <label className="block text-xs font-semibold text-ink-soft mb-1">Tactic</label>
        <select
          value={terrainTactic}
          onChange={(e) => onTerrainTacticChange(e.target.value as Tactic)}
          className="w-full px-2 py-1.5 border border-ink-faint/50 rounded-md text-sm bg-canvas-raised cursor-pointer"
        >
          <option value="equal">Equal (standard ratio)</option>
          <option value="random">Random</option>
          <option value="current" disabled={terrainTarget === 'all'}>
            Current (shuffle existing)
          </option>
        </select>
      </div>
      <div className="flex-1">
        <label className="block text-xs font-semibold text-ink-soft mb-1">Target</label>
        <select
          value={terrainTarget}
          onChange={(e) => onTerrainTargetChange(e.target.value as TerrainTarget)}
          className="w-full px-2 py-1.5 border border-ink-faint/50 rounded-md text-sm bg-canvas-raised cursor-pointer"
        >
          <option value="all" disabled={terrainTactic === 'current'}>
            All placed
          </option>
          <option value="land only">Land only</option>
        </select>
      </div>
    </div>
    <label className="flex items-center gap-2 mt-2 text-xs text-ink-soft cursor-pointer">
      <input
        type="checkbox"
        checked={excludeWater}
        onChange={(e) => onExcludeWaterChange(e.target.checked)}
        className="cursor-pointer"
      />
      Exclude water — sea hexes never change or move
    </label>
    <Button
      variant="outline"
      onClick={onAssignTerrain}
      className="w-full mt-2"
    >
      Assign terrain
    </Button>
  </div>
);

export default TerrainPalette;
