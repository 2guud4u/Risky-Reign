# Glossary

## UI surfaces

| Term | Meaning |
| Corner pill | The bottom-left control unit: floating last-roll dice over a white-circle settings (⚙️) button — the same round-button look as the left-edge map controls. |
| Notice rail | The top-center column: turn status bar (phase, undo, end turn), your-turn toast, trade pop-ups, and waiting/action notices, stacked so they can't overlap. |
| Turn timeline | The dropdown under the phase button: current + next 25 turns as colored nodes; ~5 visible, rest scroll horizontally. |
| Action bubbles | The contextual buttons docked as a vertical column on the right edge when a vertex/edge/robber is selected on the board. |
| Players panel | The scrollable column of player chips opened by the 👤 button on the map's left edge. |
| Player chip | One compact row per player: color dot, name, bonus glyphs (🛤️⚔️👑⛵), ⭐VP, 🃏cards. |
| Hand tray | The wood-grain bar along the bottom edge: resource cards fanned left, dev cards right with a Buy tile; collapses to a pull tab on phones. |
| Info modal | The tabbed dialog from the ⓘ button on the map's left edge: Pieces, Recipes, Achievements. Every tab shows only what the room's piece flags enable. |
| Pieces tab | The Info modal's first tab: one card per piece (Soldier, Robber, Cannon, Wall, Ship) with cost and ability bullets; a sidebar (chips on narrow screens) anchor-jumps between cards. |

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

## Game pieces

| Term | Meaning |
|------|---------|
| Cannon | A healthy soldier upgraded on your settlement (1 wood + 1 ore); injured soldiers must heal first. In melee it always pairs as its side's lowest roll (facing the enemy's weakest die); it cannot be injured — a lost roll kills it — and it wins its ties (no home-field advantage). |
| Stationed | A cannon emplaced to fire: it can attack (range: one intersection away, or splash) but cannot move until unstationed. Distinct from a freshly-spawned infantry soldier's garrisoned state. |
| Splash attack | A stationed cannon's area attack (costs 1 ore) at the vertex one intersection away or its own vertex: one roll resolves independently against every soldier there, including the firer's own troops — the cannon itself is immune. |
| Wall | A road upgraded (2 bricks, flipped 90°) that blocks enemy soldiers. Crossing requires the wall gate; a stationed cannon adjacent to it breaks it on a roll of 4+ (5+ while its owner holds The Great Wall) or outright with an Explosive shot. On capture a wall changes hands exactly like the road it sits on. |
| Explosive shot | A stationed cannon's paid wall attack (1 ore) offered beside the free breach roll: it breaks the wall back into a road outright — no die is rolled, The Great Wall's 5+ doesn't apply. Committed (action spent, undo cleared) the moment it fires. |
| Wall run | A chain of wall-edges owned by one player, linked end-to-end through vertices that are empty or hold that player's own buildings — an enemy settlement or city on the link vertex severs the run. Length is counted in walls. |
| The Great Wall | The held bonus for the longest wall run of at least 3 walls — one holder, kept through ties until a rival's run is strictly longer. Worth 1 victory point, and every wall the holder owns (run or not) needs a roll of 5+ to break instead of 4+. An eliminated player's walls are part of no run and don't count in the standings. |
| Capture spread | The roads (and walls) that change hands when a settlement is captured: every road whose chain, after the capture, runs only between the capturer's buildings and dead ends, whoever owned it. A road on a chain that reaches any other player's building keeps its owner. |
| Wall gate | The dice challenge for crossing an enemy wall: the crosser picks a number 1–6, the wall owner rolls; a match crosses. Either side that doesn't act within 30s has its number picked for it. A failed attempt still spends the soldier's action. The whole board waits while a gate (or a battle) is in progress. |
| Ship | A vessel (1 wood + 1 sheep) sitting on coast or sea vertices, possibly over a settlement. Carries any number of embarked troops, who board and land only on the ship's own coast vertex; troops aboard can be attacked anywhere but must land before they capture or start a fight. Each ship moves ceil(dice-roll total / 2) in its owner's Action phase. An empty ship is claimed by whoever sails or boards it; a crewed ship answers only to its owner and can't be boarded by others. Converts into a settlement on its own or an adjacent coast vertex for 1 wheat + 1 ore (no garrison soldier). |
| Fleet | The ships a player owns at a moment — every ship showing that player's color, empty or crewed, at sea or docked over a settlement. Building a ship grows it; sailing or boarding an empty ship moves it between fleets; settling a ship shrinks it. An eliminated player's ships are part of no fleet and don't count in the Admiral standings. |
| The Admiral | The held bonus for the largest fleet: the one player owning at least 3 ships and strictly more than every other eligible player — everyone else needs at least 4 to take it at 3, since the holder keeps it through ties. Worth 1 victory point, and each ship the holder owns gains one extra sailing step in every Action phase (steps already granted that phase are kept even if the title is lost mid-phase). No one holds it in a game without ships. |

## Engine architecture

| Term | Meaning |
|------|---------|
| Action | One gameplay command a client can send (buildSettlement, rollDice, …). Lives in `backend/src/actions/` as a socket-free `(room, player, payload) → { error?, effects?, broadcast? }` rule — the unit `dispatch` runs. |
| Dispatch | The seam between transport and rules (`backend/src/dispatch.ts`): every socket event maps to one action entry; the adapter owns the prelude (room lookup, finished/eliminated/seat gates), runs the action, applies bonuses, broadcasts. Tests can call actions headless. |
| Pending action | A deferred resolution a room holds between events (robber move, post-win robber move, steal, dev-card choice, 7-discards, battle). `common/rules/pending.ts` lists them and owns the single blocking table every action asks. |
| Game effect | An I/O an action produces without performing it (`common/rules/effects.ts`): e.g. `robberFightResult`, `pausedInfo`. Returned by rules, performed by the dispatch adapter — keeps rules socket-free. |
| Room registry | `backend/src/store.ts`: owns the private in-memory room map behind `getRoom`/`roomEntries`/`putRoom`/`removeRoom`; the only code that may create, evict, or hydrate rooms. |
| Board selectors | `ui/src/board/selectors.ts`: the UI's one read-model for "who can do what on the board" — actable/movable soldier sets, robber targets, knight spawn targets. Wraps `common`'s authoritative validators; never re-derives rules. |
| Board actions | `ui/src/board/actions/`: the catalog producing `BubbleAction` descriptors for the Action bubbles — a gate decides which bubbles appear, `check` delegates to `common`'s validators (a shown bubble can still be greyed with the server's reason), `run` emits through the room-bound socket. Choice bubbles expand into per-option chips where the first eligible option wins. The bubbles themselves are pure renderers. |
| Effect channel | `ui/src/effects.ts`: typed client-side bus (buildAnimation, openTrade, boardFit, tutorial hints) replacing ad-hoc `window.dispatchEvent` channels. |

## Map marketplace

| Term | Meaning |
|------|---------|
| Marketplace map | An official prebuilt board shipped with the game, browsable and loadable from the board editor's Maps tab. |
| Maps tab | The board-editor sidebar tab (next to Terrain/Numbers/Docks) listing marketplace maps as cards with a preview and a favorites filter. |
| Map favorite | A per-browser star on a marketplace map, grouping it at the top under the ★ favorites filter. Westeros ships pre-favorited for everyone. |
| Map catalog | The bundled collection of marketplace maps, each carrying name/author/tag metadata so community-made maps can join later. |
