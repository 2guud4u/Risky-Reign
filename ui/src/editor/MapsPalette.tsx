import React, { useState } from 'react';
import { MapCatalogEntry } from 'common';
import { MapsPaletteProps } from './types';
import MapThumbnail from './MapThumbnail';
import Button from '../components/ui/Button';
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
    <div className="p-3 border border-ink-faint/50 rounded-lg bg-canvas-raised">
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-ink-soft">Maps</h3>
          <p className="text-xs text-ink-faint">Prebuilt boards — load one, tweak it, Save Board.</p>
        </div>
        <label className="flex items-center gap-1 text-xs text-ink-soft cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={favsOnly}
            onChange={(e) => setFavsOnly(e.target.checked)}
            className={inputClass.replace('w-full', '') + ' accent-gold'}
          />
          ★ favorites
        </label>
      </div>

      <div className="flex gap-2 mb-2">
        {GENERATORS.map(({ kind, label }) =>
          pendingGen === kind ? (
            <div key={kind} className="flex-1 flex items-center gap-1.5">
              <span className="text-xs text-ink-soft">Replace draft?</span>
              <Button
                size="sm"
                onClick={() => generate(kind)}
                className="!bg-sky !text-white"
              >
                Replace
              </Button>
              <Button
                size="sm"
                variant="unstyled"
                onClick={() => setPendingGen(null)}
                className="px-2 py-1 rounded text-xs border border-ink-faint/50 text-ink-soft"
              >
                Keep
              </Button>
            </div>
          ) : (
            <Button
              key={kind}
              size="sm"
              onClick={() => generate(kind)}
              className="flex-1"
            >
              {label}
            </Button>
          )
        )}
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((m) => {
          const fav = favorites.includes(m.id);
          const confirming = pendingId === m.id;
          const land = m.layouts.filter((l) => l.terrain !== 'Water').length;
          return (
            <div key={m.id} className="border border-ink-faint/50 rounded-md overflow-hidden">
              <div className="bg-sky-pale p-1">
                <MapThumbnail layouts={m.layouts} />
              </div>
              <div className="px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold text-ink">{m.name}</span>
                  <Button
                    variant="unstyled"
                    onClick={() => onToggleFavorite(m.id)}
                    title={fav ? 'Remove from favorites' : 'Add to favorites'}
                    className={`ml-auto text-base leading-none ${fav ? 'text-gold' : 'text-ink-faint hover:text-gold'}`}
                  >
                    ★
                  </Button>
                </div>
                <div className="text-xs text-ink-faint">
                  {m.author} · {land} hexes
                  {m.tags.length > 0 ? ` · ${m.tags.join(', ')}` : ''}
                </div>
                {confirming ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-xs text-ink-soft">Replace your draft?</span>
                    <Button
                      size="sm"
                      onClick={() => load(m)}
                      className="!bg-sky !text-white"
                    >
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant="unstyled"
                      onClick={() => setPendingId(null)}
                      className="px-2 py-1 rounded text-xs border border-ink-faint/50 text-ink-soft"
                    >
                      Keep
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => load(m)}
                    className="mt-1.5 w-full !bg-sky !text-white hover:!bg-sky-soft"
                  >
                    Load into editor
                  </Button>
                )}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-xs text-ink-faint text-center py-3">No favorited maps yet.</p>
        )}
      </div>
    </div>
  );
};

export default MapsPalette;
