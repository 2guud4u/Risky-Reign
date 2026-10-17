import React from 'react';
import { PortType } from 'common';
import { DockPaletteProps } from './types';
import { PORT_GENERIC_FILL, PORT_SPECIAL_FILL } from '../constants';

const PORT_OPTIONS: { port: PortType; label: string }[] = [
  { port: 'generic', label: '3:1 any' },
  { port: 'Wood', label: '2:1 Wood' },
  { port: 'Brick', label: '2:1 Brick' },
  { port: 'Sheep', label: '2:1 Sheep' },
  { port: 'Wheat', label: '2:1 Wheat' },
  { port: 'Ore', label: '2:1 Ore' },
];

/**
 * Docks palette: the Docks tab of the board editor sidebar. Port chips set
 * the type for new docks — or, with a dock selected on the canvas, reassign
 * its port. Drag a chip onto a coast vertex to place a dock there directly.
 * Randomize re-rolls the whole layout; Delete removes the selected dock
 * (dragging it to the trash can works too).
 */
const DockPalette: React.FC<DockPaletteProps> = ({
  docks,
  selectedDockIndex,
  pendingPort,
  onPortClick,
  onPortDragStart,
  onDragEnd,
  onRandomize,
  onRemoveDock,
}) => {
  const selected = selectedDockIndex !== null ? docks[selectedDockIndex] : null;
  return (
    <div className="p-3 border border-gray-300 rounded-lg bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-700">Docks</h3>
          <p className="w-full max-w-[1200px] text-xs text-gray-500">
            {selected
              ? 'Click a port to reassign the selected dock, or drag it to move / trash it.'
              : 'Drag a port onto a coast vertex (or click a + handle) to add a dock.'}
          </p>
        </div>
        <button
          onClick={onRandomize}
          title="Re-roll the port layout over the current coast"
          className="px-2 py-1 border border-gray-300 rounded-md bg-gray-100 text-xs cursor-pointer whitespace-nowrap"
        >
          Randomize ({docks.length})
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PORT_OPTIONS.map(({ port, label }) => {
          const active = selected ? selected.port === port : pendingPort === port;
          return (
            <button
              key={port}
              draggable
              onDragStart={(e) => onPortDragStart(e, port)}
              onDragEnd={onDragEnd}
              onClick={() => onPortClick(port)}
              title={
                selected
                  ? `Make the selected dock ${label}`
                  : `New docks are ${label} (drag onto the coast to place)`
              }
              className={`flex items-center gap-2 px-2 py-1.5 border rounded-md text-sm cursor-grab active:cursor-grabbing ${
                active ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'
              }`}
            >
              <span
                className="w-4 h-4 rounded-full border border-gray-400"
                style={{ background: port === 'generic' ? PORT_GENERIC_FILL : PORT_SPECIAL_FILL }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          onClick={() => onRemoveDock(selectedDockIndex!)}
          className="mt-2 w-full py-1.5 px-3 border-0 rounded-md text-sm font-semibold text-white bg-red-500 cursor-pointer"
        >
          Delete selected dock
        </button>
      )}
    </div>
  );
};

export default DockPalette;
