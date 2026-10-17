# Glossary

## UI surfaces

| Term | Meaning |
| Corner pill | The bottom-left control unit: floating last-roll dice over a white-circle settings (⚙️) button — the same round-button look as the left-edge map controls. |
| Notice rail | The top-center column: turn status bar (phase, undo, end turn), your-turn toast, trade pop-ups, and waiting/action notices, stacked so they can't overlap. |
| Turn timeline | The dropdown under the phase button: current + next 25 turns as colored nodes; ~5 visible, rest scroll horizontally. |
| Action bubbles | The contextual buttons docked as a vertical column on the right edge when a vertex/edge/robber is selected on the board. |
| Players panel | The scrollable column of player chips opened by the 👤 button on the map's left edge. |
| Player chip | One compact row per player: color dot, name, bonus glyphs (🛤️⚔️👑), ⭐VP, 🃏cards. |
| Hand tray | The wood-grain bar along the bottom edge: resource cards fanned left, dev cards right with a Buy tile; collapses to a pull tab on phones. |

## Design language

| Term | Meaning |
|------|---------|
| Warm & playful | The design direction (ADR 0001): soft palette, rounded shapes, playful type. |
| Tokens | Tailwind theme values (color, type scale, radius, spacing) all styling derives from — the single source of visual truth. |
| Primitives | Shared components built on tokens (Button, Modal, Chip) — screens compose these rather than raw classes. |
| Chrome icons | UI chrome (menu, close, players, settings) — rendered as real SVG icons, not emoji. |
| Game flavor | Emoji/art that *is* the game (resource cards, soldier/robber sprites, terrain art) — kept as-is. |

## Rooms & lobby

| Term | Meaning |
|------|---------|
| Quick Play | Server-side matchmaking: joins the fullest open lobby (waiting, default settings, no password), else creates a fresh room. |
| Open room | A room with no password set — joinable by code alone and visible to Quick Play. |
| Private room | A room whose host set a lobby password — joinable by code + password only; Quick Play skips it. |
| Customize Game | The pre-game configuration page entered from the waiting room. Two tabs: General Rules (points to win, turn structure, setup cities, turn timer) and Board (the map editor). The only place game rules can be changed. |
| Game preset | A named, browser-local saved bundle of game rules plus a board layout, loadable in one click from Customize Game. |
| Customization lock | A room-wide host toggle gating who may change rules and board: unlocked (default) = anyone in the room may edit; locked = host only. Independent of the lobby password, which the host alone always controls. |
| Coast vertex | A board vertex touching exactly one land hex, its other neighbors water or empty — the only place a trade port (dock) may sit. |
| Dock | One trade port on the board's coastline: a generic (3:1) or resource (2:1) harbor occupying a span of one or two adjacent coast vertices. |

## Engine architecture

| Term | Meaning |
|------|---------|
| Action | One gameplay command a client can send (buildSettlement, rollDice, …). Lives in `backend/src/actions/` as a socket-free `(room, player, payload) → { error?, effects?, broadcast? }` rule — the unit `dispatch` runs. |
| Dispatch | The seam between transport and rules (`backend/src/dispatch.ts`): every socket event maps to one action entry; the adapter owns the prelude (room lookup, finished/eliminated/seat gates), runs the action, applies bonuses, broadcasts. Tests can call actions headless. |
| Pending action | A deferred resolution a room holds between events (robber move, post-win robber move, steal, dev-card choice, 7-discards, battle). `common/rules/pending.ts` lists them and owns the single blocking table every action asks. |
| Game effect | An I/O an action produces without performing it (`common/rules/effects.ts`): e.g. `robberFightResult`, `pausedInfo`. Returned by rules, performed by the dispatch adapter — keeps rules socket-free. |
| Room registry | `backend/src/store.ts`: owns the private in-memory room map behind `getRoom`/`roomEntries`/`putRoom`/`removeRoom`; the only code that may create, evict, or hydrate rooms. |
| Board selectors | `ui/src/board/selectors.ts`: the UI's one read-model for "who can do what on the board" — actable/movable soldier sets, robber targets, knight spawn targets. Wraps `common`'s authoritative validators; never re-derives rules. |
| Board actions | `ui/src/board/actions.ts`: the catalog producing `BubbleAction` descriptors for the Action bubbles — gate + check + run per action, one place; the bubbles are pure renderers. |
| Effect channel | `ui/src/effects.ts`: typed client-side bus (buildAnimation, openTrade, boardFit, tutorial hints) replacing ad-hoc `window.dispatchEvent` channels. |

## Map marketplace

| Term | Meaning |
|------|---------|
| Marketplace map | An official prebuilt board shipped with the game, browsable and loadable from the board editor's Maps tab. |
| Maps tab | The board-editor sidebar tab (next to Terrain/Numbers/Docks) listing marketplace maps as cards with a preview and a favorites filter. |
| Map favorite | A per-browser star on a marketplace map, grouping it at the top under the ★ favorites filter. Westeros ships pre-favorited for everyone. |
| Map catalog | The bundled collection of marketplace maps, each carrying name/author/tag metadata so community-made maps can join later. |
