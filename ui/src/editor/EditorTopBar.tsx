import { EditorTopBarProps } from './types';

/**
 * The Board tab's top bar inside Customize Game: map resets, the random-map
 * regen, and a live summary of the draft (hex count, layout validity,
 * missing numbers).
 */
const EditorTopBar: React.FC<EditorTopBarProps> = ({
  onResetStandard,
  onResetExpansion,
  onRefreshMap,
  hexCount,
  validation,
  missingNumbers,
}) => (
  <div className="w-full max-w-[1200px] flex items-center gap-3 flex-wrap">
    <button
      onClick={onResetStandard}
      className="px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-sm cursor-pointer"
    >
      Reset to Standard
    </button>
    <button
      onClick={onResetExpansion}
      className="px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-sm cursor-pointer"
    >
      Reset to Expansion
    </button>
    <button
      onClick={onRefreshMap}
      className="px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-sm cursor-pointer"
      title="Replace the room's board with a fresh random map (loses the current draft)"
    >
      Refresh Map
    </button>
    <span className="text-sm text-gray-500">
      {hexCount} hexes · {validation.allowed ? 'valid' : `invalid: ${validation.reason}`}
      {missingNumbers > 0 ? ` · ${missingNumbers} missing number${missingNumbers > 1 ? 's' : ''}` : ''}
    </span>
  </div>
);

export default EditorTopBar;
