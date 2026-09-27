import React from 'react';
import { EditorTopBarProps } from './types';

/**
 * The editor's top bar: back/reset buttons and a live summary of the draft
 * (hex count, layout validity, missing numbers).
 */
const EditorTopBar: React.FC<EditorTopBarProps> = ({
  onBack,
  onResetStandard,
  onResetExpansion,
  hexCount,
  validation,
  missingNumbers,
}) => (
  <div className="w-full max-w-[1200px] flex items-center gap-3 flex-wrap">
    <h1 className="text-xl font-bold text-gray-800">Board Editor</h1>
    <button
      onClick={onBack}
      className="px-3 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-sm cursor-pointer"
    >
      ← Back to Lobby
    </button>
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
    <span className="text-sm text-gray-500">
      {hexCount} hexes · {validation.allowed ? 'valid' : `invalid: ${validation.reason}`}
      {missingNumbers > 0 ? ` · ${missingNumbers} missing number${missingNumbers > 1 ? 's' : ''}` : ''}
    </span>
  </div>
);

export default EditorTopBar;
