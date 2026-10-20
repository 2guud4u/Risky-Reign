import React from 'react';
import { useSocket } from '../contexts/SocketContext';
import { SavePanelProps } from './types';
import { toHexLayouts } from './utils';
import Button from '../components/ui/Button';

/**
 * Save Board panel (Customize Game → Board tab): applies the draft layout to
 * the room via editBoard. Enabled only when the layout validates and every
 * non-water hex carries a roll number. Loading a previous configuration is
 * handled by game presets in the page header.
 */
const SavePanel: React.FC<SavePanelProps> = ({ map, docks, validation, missingNumbers }) => {
  const { editBoard } = useSocket();
  const canSave = validation.allowed && missingNumbers === 0;

  return (
    <div className="p-3 border border-ink-faint/50 rounded-lg bg-canvas-raised">
      <h3 className="text-sm font-semibold text-ink-soft mb-2">Save Board</h3>
      <div className="flex flex-col gap-2">
        <Button
          variant="unstyled"
          onClick={() => canSave && editBoard(toHexLayouts(map), docks)}
          disabled={!canSave}
          className="w-full py-2 px-3 border-0 rounded-md text-[15px] font-semibold text-white bg-sky disabled:bg-ink-faint/50"
        >
          Save Board
        </Button>
        {!canSave && (
          <p className="m-0 text-[12px] text-ink-faint">
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
