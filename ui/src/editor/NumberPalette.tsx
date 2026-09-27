import React from 'react';
import { NUMBER_OPTIONS } from './constants';
import { NumberPaletteProps, Tactic, Target } from './types';

/**
 * Number palette: click a token to set it on the selected hex, or drag it onto
 * a hex. Below it, the "Assign numbers" tactic/target controls.
 */
const NumberPalette: React.FC<NumberPaletteProps> = ({
  selectedNumber,
  numberCounts,
  tactic,
  target,
  onTacticChange,
  onTargetChange,
  onNumberClick,
  onNumberDragStart,
  onDragEnd,
  onAssign,
}) => (
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
          onDragStart={(e) => onNumberDragStart(e, n)}
          onDragEnd={onDragEnd}
          onClick={() => onNumberClick(n)}
          title={`Drag onto a hex to set ${n}`}
          className={`w-9 h-9 rounded-full border text-sm font-semibold cursor-grab active:cursor-grabbing ${
            selectedNumber === n ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'
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
          onChange={(e) => onTacticChange(e.target.value as Tactic)}
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
          onChange={(e) => onTargetChange(e.target.value as Target)}
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
      onClick={onAssign}
      className="w-full mt-2 px-2 py-1.5 border border-blue-300 bg-blue-50 text-blue-700 rounded-md text-sm cursor-pointer"
    >
      Assign numbers
    </button>
  </div>
);

export default NumberPalette;
