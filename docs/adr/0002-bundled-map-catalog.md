# ADR 0002: Bundled map-catalog format for marketplace maps

## Status

Accepted (2026-10-16)

## Context

The board editor gains a Maps tab: a browsable list of official prebuilt
boards (first: a lore-accurate Westeros), each loadable into the editor draft
and favorited per browser. Two open questions: where map data lives, and what
shape it takes so future community-made maps can join the same list.

## Decision

The map catalog is **data shipped in the app bundle**, not a server-served
endpoint. Each entry is a self-contained record:

- `id`, `name`, `author`, `tags` — the metadata contract community maps
  will fill in later, present from day one even while every entry is
  "Official".
- `layouts` — full `HexLayout[]` (coord + terrain + authored roll number),
  including authored Water hexes where the map calls for them.
- `docks` — authored `DockSpec[]` (coast indices), fixed at map-defined
  locations rather than randomized.
- `favoriteDefault` — flags maps (Westeros) seeded into every browser's
  favorites list on first load.

Loading a marketplace map is a pure client-side operation: it replaces the
editor draft (with a confirm when the draft was hand-edited), then flows
through the existing `editBoard`/Save Board path like any hand-built layout.

## Considered Options

- **Server-served catalog**: enables adding maps without redeploying the UI,
  but adds fetching/caching plumbing for a single launch map, and the
  board-safety rules (`validateLayouts`, `MAX_BOARD_HEXES`) already run on
  whatever layout reaches `editBoard` regardless of source. Deferred: the
  bundled format is exactly what a fetched catalog would deserialize into,
  so swapping the source later touches only the loading layer.
- **Layouts without metadata**: cheaper, but the catalog shape is the
  contract community submissions will be built against — retrofitting
  `author`/`tags` onto a live ecosystem is harder than shipping the fields
  unused.

## Consequences

- New maps ship with releases; there is no runtime map delivery until a
  community pipeline exists.
- Favorites stay browser-local (same storage as game presets); they are a
  personal lens over a fixed catalog, not shared state — no server schema
  needed.
- The catalog record is the API surface to keep stable; everything else
  (thumbnails, filters, load flow) is free to evolve.
