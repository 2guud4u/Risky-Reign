import React from 'react';
import { PLAYER_COLORS } from 'common';

/** Native color input + quick-pick swatches from the shared palette. */
const ColorPicker: React.FC<{ value: string; onChange: (color: string) => void }> = ({
  value,
  onChange,
}) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-9 h-9 rounded cursor-pointer border border-gray-300 p-0.5"
      title="Pick your color"
    />
    <div className="flex flex-wrap gap-1.5">
      {PLAYER_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c}
          className={`w-5 h-5 rounded-full cursor-pointer border-2 ${
            value.toLowerCase() === c.toLowerCase() ? 'border-gray-800' : 'border-transparent'
          }`}
          style={{ background: c }}
        />
      ))}
    </div>
  </div>
);

export default ColorPicker;
