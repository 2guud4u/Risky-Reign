import React, { useEffect, useRef, useState } from 'react';
import { PLAYER_COLORS, normalizeColor, playerColorError } from 'common';
import { darkenColor } from '../utils/color';

interface OtherPlayer {
  name: string;
  color: string;
}

interface ColorPickerProps {
  value: string;
  /** Other players in the room — their colors can't be reused. */
  others: OtherPlayer[];
  onChange: (color: string) => void;
}

/** How long a custom color must stay put before it is sent to the server. */
const CUSTOM_COMMIT_DELAY_MS = 250;

const same = (a: string, b: string) => normalizeColor(a) === normalizeColor(b);

/**
 * Preview frame sizes (px). The piece art is cropped to its visible shape, so
 * each frame matches its art's aspect ratio and a plain flex row centers them.
 */
const PREVIEW_PIECES = [
  { href: '/art/settlement.svg#settlement-shape', w: 39, h: 40 },
  { href: '/art/city.svg#city-shape', w: 53, h: 56 },
  { href: '/art/soldier.svg#soldier-shape', w: 27, h: 62 },
] as const;

/** Your pieces tinted with `color` — the same art and tinting as the board. */
const PiecePreview: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <div
    className="flex items-center justify-center gap-5 h-24 rounded-lg bg-gradient-to-b from-sky-50 to-emerald-100 border border-emerald-200"
    style={{ color, ['--settlement-dark' as string]: darkenColor(color) }}
  >
    {PREVIEW_PIECES.map((p) => (
      <svg key={p.href} width={p.w} height={p.h} aria-hidden="true">
        <use href={p.href} width={p.w} height={p.h} />
      </svg>
    ))}
    <span className="sr-only">{label}</span>
  </div>
);

/**
 * Lobby color picker: a live preview of your pieces, preset swatches (those
 * held by — or too close to — another player are crossed out with the owner's
 * name on hover), and a custom-color swatch backed by the native picker. The
 * same `playerColorError` rule runs on the server.
 */
const ColorPicker: React.FC<ColorPickerProps> = ({ value, others, onChange }) => {
  const current = normalizeColor(value);
  const otherColors = others.map((o) => o.color);
  const isPreset = PLAYER_COLORS.some((c) => same(c, current));

  // The native picker fires on every drag step; show the color immediately
  // but only commit once the user pauses, so the server isn't flooded. The
  // latest `onChange` lives in a ref so parent re-renders (room updates)
  // don't restart the delay.
  const [draft, setDraft] = useState<string | null>(null);
  const draftError = draft ? playerColorError(draft, otherColors) : null;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (!draft || draftError || same(draft, current)) return;
    const t = window.setTimeout(() => onChangeRef.current(draft), CUSTOM_COMMIT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [draft, draftError, current]);
  // Drop the draft once the server confirms it (or another color is chosen).
  useEffect(() => {
    if (draft && same(draft, current)) setDraft(null);
  }, [draft, current]);

  const shown = draft ?? current;
  // A rejected draft is never sent, so your committed color stays selected.
  const pending = draft !== null && draftError === null;
  const customActive = pending || (!isPreset && draft === null);
  /** Name of the player whose color blocks `c`, if any. */
  const blockerOf = (c: string) =>
    others.find((o) => playerColorError(c, [o.color]) !== null)?.name ?? null;

  return (
    <div className="flex flex-col gap-2.5">
      <PiecePreview color={draftError ? current : shown} label={`Your pieces in ${shown}`} />

      <div className="flex flex-wrap gap-2">
        {PLAYER_COLORS.map((c) => {
          const selected = !pending && same(c, current);
          const blocker = selected ? null : blockerOf(c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setDraft(null);
                onChange(c);
              }}
              disabled={blocker !== null || selected}
              title={blocker ? `Taken by ${blocker}` : selected ? 'Your color' : 'Pick this color'}
              aria-label={blocker ? `${c} (taken by ${blocker})` : c}
              aria-pressed={selected}
              className={`relative w-9 h-9 rounded-md transition-transform ${
                selected
                  ? 'ring-2 ring-offset-2 ring-gray-900 scale-105'
                  : blocker
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer hover:scale-110 hover:shadow-md'
              }`}
              style={{ background: c }}
            >
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center text-white text-lg font-bold drop-shadow">
                  ✓
                </span>
              )}
              {blocker && (
                <span className="absolute inset-0 flex items-center justify-center rounded-md bg-white/70 text-gray-700 text-lg font-bold">
                  ✕
                </span>
              )}
            </button>
          );
        })}

        {/* Custom color: opens the native picker. */}
        <label
          title="Pick any color"
          className={`relative w-9 h-9 rounded-md cursor-pointer overflow-hidden transition-transform hover:scale-110 hover:shadow-md ${
            draftError
              ? 'ring-2 ring-offset-2 ring-red-600'
              : customActive
                ? 'ring-2 ring-offset-2 ring-gray-900 scale-105'
                : ''
          }`}
          style={{
            background:
              customActive || draftError
                ? shown
                : 'conic-gradient(#e6194b, #f58231, #bfef45, #3cb44b, #42d4f4, #4363d8, #911eb4, #f032e6, #e6194b)',
          }}
        >
          <input
            type="color"
            aria-label="Custom color"
            value={shown}
            onChange={(e) => setDraft(normalizeColor(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <span className="absolute inset-0 flex items-center justify-center text-white text-lg font-bold drop-shadow pointer-events-none">
            {draftError ? '!' : customActive ? '✓' : '+'}
          </span>
        </label>
      </div>

      <div className="text-[12px] min-h-[18px]">
        {draftError ? (
          <span className="text-red-600 font-medium">{draftError} — pick another.</span>
        ) : (
          <span className="text-gray-500">
            {customActive ? 'Custom color' : 'Preset color'} ·{' '}
            <span className="font-mono uppercase">{shown}</span>
          </span>
        )}
      </div>
    </div>
  );
};

export default ColorPicker;
