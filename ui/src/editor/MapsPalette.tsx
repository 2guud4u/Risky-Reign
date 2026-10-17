import React, { useState } from 'react';
import { MapCatalogEntry } from 'common';
import { MapsPaletteProps } from './types';
import MapThumbnail from './MapThumbnail';
import { inputClass } from './constants';

type Generator = 'standard' | 'expansion';

const GENERATORS: { kind: Generator; label: string }[] = [
  { kind: 'standard', label: 'Standard 19-hex' },
  { kind: 'expansion', label: 'Expansion 30-hex' },
];

/**
 * Maps palette: the Maps tab of the board editor sidebar — the marketplace.
 * Lists catalog maps as cards (thumbnail, name, author/tags, ★ favorite).
 * "Load into editor" fills the draft; when the draft was hand-edited it asks
 * to confirm the replacement first.
 */
const MapsPalette: React.FC<MapsPaletteProps> = ({
  maps,
  favorites,
  draftDirty,
  onToggleFavorite,
  onLoad,
  onGenerate,
}) => {
  const [favsOnly, setFavsOnly] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingGen, setPendingGen] = useState<Generator | null>(null);

  const shown = favsOnly ? maps.filter((m) => favorites.includes(m.id)) : maps;
  const sorted = [...shown].sort(
    (a, b) =>
      Number(favorites.includes(b.id)) - Number(favorites.includes(a.id)) ||
      a.name.localeCompare(b.name)
  );

  const load = (entry: MapCatalogEntry) => {
    if (draftDirty && pendingId !== entry.id) {
      setPendingId(entry.id);
      setPendingGen(null);
      return;
    }
    setPendingId(null);
    onLoad(entry);
  };

  const generate = (kind: Generator) => {
    if (draftDirty && pendingGen !== kind) {
      setPendingGen(kind);
      setPendingId(null);
      return;
    }
    setPendingGen(null);
    onGenerate(kind);
  };

  return (
    <div className="p-3 border border-gray-300 rounded-lg bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-700">Maps</h3>
          <p className="text-xs text-gray-500">Prebuilt boards — load one, tweak it, Save Board.</p>
        </div>
        <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={favsOnly}
            onChange={(e) => setFavsOnly(e.target.checked)}
            className={inputClass.replace('w-full', '') + ' accent-amber-500'}
          />
          ★ favorites
        </label>
      </div>

      <div className="flex gap-2 mb-2">
        {GENERATORS.map(({ kind, label }) =>
          pendingGen === kind ? (
            <div key={kind} className="flex-1 flex items-center gap-1.5">
              <span className="text-xs text-gray-600">Replace draft?</span>
              <button
                onClick={() => generate(kind)}
                className="px-2 py-1 rounded text-xs font-semibold text-white bg-blue-500 cursor-pointer"
              >
                Replace
              </button>
              <button
                onClick={() => setPendingGen(null)}
                className="px-2 py-1 rounded text-xs border border-gray-300 text-gray-600 cursor-pointer"
              >
                Keep
              </button>
            </div>
          ) : (
            <button
              key={kind}
              onClick={() => generate(kind)}
              className="flex-1 px-2 py-1.5 border border-gray-300 rounded-md bg-gray-100 text-sm cursor-pointer hover:bg-gray-200"
            >
              {label}
            </button>
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((m) => {
          const fav = favorites.includes(m.id);
          const confirming = pendingId === m.id;
          const land = m.layouts.filter((l) => l.terrain !== 'Water').length;
          return (
            <div key={m.id} className="border border-gray-300 rounded-md overflow-hidden">
              <div className="bg-sky-50 p-1">
                <MapThumbnail layouts={m.layouts} />
              </div>
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-gray-800">{m.name}</span>
                  <button
                    onClick={() => onToggleFavorite(m.id)}
                    title={fav ? 'Remove from favorites' : 'Add to favorites'}
                    className={`ml-auto text-base leading-none cursor-pointer ${fav ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
                  >
                    ★
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  {m.author} · {land} hexes
                  {m.tags.length > 0 ? ` · ${m.tags.join(', ')}` : ''}
                </div>
                {confirming ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-xs text-gray-600">Replace your draft?</span>
                    <button
                      onClick={() => load(m)}
                      className="px-2 py-1 rounded text-xs font-semibold text-white bg-blue-500 cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      onClick={() => setPendingId(null)}
                      className="px-2 py-1 rounded text-xs border border-gray-300 text-gray-600 cursor-pointer"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => load(m)}
                    className="mt-1.5 w-full py-1.5 rounded text-sm font-semibold text-white bg-blue-500 cursor-pointer hover:bg-blue-600"
                  >
                    Load into editor
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-3">No favorited maps yet.</p>
        )}
      </div>
    </div>
  );
};

export default MapsPalette;
