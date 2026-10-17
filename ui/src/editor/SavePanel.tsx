import React from 'react';
import { useSocket } from '../contexts/SocketContext';
import { SavePanelProps } from './types';
import { toHexLayouts } from './utils';

/**
 * Save Board panel (Customize Game → Board tab): applies the draft layout to
 * the room via editBoard. Enabled only when the layout validates and every
 * non-water hex carries a roll number. Loading a previous configuration is
 * handled by game presets in the page header.
 */
const SavePanel: React.FC<SavePanelProps> = ({ roomId, map, docks, validation, missingNumbers }) => {
  const { editBoard } = useSocket();
  const canSave = validation.allowed && missingNumbers === 0;

  return (
    <div className="p-3 border border-gray-300 rounded-lg bg-white">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Save Board</h3>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => canSave && editBoard(roomId, toHexLayouts(map), docks)}
          disabled={!canSave}
          className="w-full py-2 px-3 border-0 rounded-md text-[15px] font-semibold text-white bg-blue-500 cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          Save Board
        </button>
        {!canSave && (
          <p className="m-0 text-[12px] text-gray-500">
            {!validation.allowed
              ? validation.reason
              : `${missingNumbers} hex${missingNumbers > 1 ? 'es are' : ' is'} missing a number.`}
          </p>
        )}
      </div>
    </div>
  );
};

export default SavePanel;
