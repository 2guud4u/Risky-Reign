# ADR 0002: Dispatch seam — socket-free game actions behind one table

## Status

Accepted (2026-10-16)

## Context

The 2026-10-16 architecture review found the same structural problem on
both ends of the wire:

- Backend: 57 `socket.on` callbacks each hand-rolled the same prelude
  (room lookup, finished/knocked-out gate, seat resolution) and held the
  *apply* half of every rule inline while `common/` held only the `can*`
  checks. Rules were testable only through real socket e2e, and the
  split invited bypasses (a handler faked `{ Wood: 99, … }` resources to
  slip a free road past its own check).
- UI: one board action was smeared across ~6 modules (gate hook →
  eligibility hook → field-mapper → renderer → spectate gate), and board
  eligibility was re-derived 4–5 times with copies that had already
  diverged (healed soldiers stayed draggable; the robber's adjacency
  rule was duplicated beside an authoritative check nobody called).
- `gameRooms` was an exported `Map` mutated by 20 files; `resetGame`
  bypassed `transition()`, the one status invariant that existed.
- `GameContext` exposed 13 members through one context — every
  subscriber re-rendered on every broadcast — plus three untyped
  `window.dispatchEvent` channels.

## Decision

1. **Dispatch seam.** Every gameplay event maps to one entry in a
   backend `ACTIONS` table: socket-free `(room, player, payload, socketId)
   → { error?, effects?, broadcast? }`. `dispatchAction` owns the uniform
   prelude, runs the action, performs returned `GameEffect`s, then
   applies bonuses and broadcasts. Room-lifecycle events (join,
   spectate, pause/resume, disconnect) stay socket handlers — they
   create/delete rooms and bind sockets, which is transport work.
2. **Rules in `common/rules/`.** Check + apply pairs for the families
   that had no shared rule (dev cards, battle commit) plus the
   `pending` protocol: one `pendingActions`/`pendingBlock` table
   replaces five hand-wired mini-protocols across handlers. Rules
   mutate the room and return `GameEffect`s instead of taking `io`.
3. **Room registry.** `store.ts`'s map is private behind
   `getRoom`/`roomEntries`/`putRoom`/`removeRoom`/`roomCount`/`rooms`/
   `hasRoom`. Status edges go only through `transition()`, which gained
   the `→ waiting` edge so `resetGame` stops bypassing it.
4. **UI read-model.** `ui/src/board/selectors.ts` owns every "who can
   do what on the board" derivation, wrapping `common`'s validators —
   actable vs movable soldier sets are deliberately distinct (healing
   blocks moves, not actions).
5. **UI action catalog.** `ui/src/board/actions.ts` produces
   `BubbleAction` descriptors (gate + check + run) for all Action
   bubbles; the per-family hooks and field-mapper components were
   deleted and `ActionBubbles` is a pure renderer.
6. **Context split + effect channel.** `GameContext` became three
   contexts (room state, selection, chrome) plus a stable actions
   context; `ui/src/effects.ts` is the typed bus replacing
   `window.dispatchEvent` (buildAnimation, openTrade, boardFit,
   tutorial hints). Socket actions bind `roomId` internally — callers
   stop threading it.

## Consequences

- Every gameplay action is headless-testable: call the action with a
  room + player, assert the error or mutation — no socket required.
  The two adapters (socket.io, unit test) make the seam real.
- Rules stay in-place mutation + effects-out; an immutable-room
  rewrite remains a separate, larger decision (YAGNI today).
- Pending-action checks centralize in one table — adding a new
  deferred resolution means one `PendingActionKind`, not guards in
  five handlers.
- Action entries return silent no-ops via `{ broadcast: false }`
  (e.g. declineTrade's unmatched paths); dispatch must stay the only
  place `applyBonuses`+`broadcastRoom` run.
- `dispatch`'s prelude emits 'Player not found'/'Room not found' where
  some handlers emitted bespoke messages ('You are not in this room',
  'Player not found in room') — client-visible text changed there.
- A pre-existing bug was kept verbatim for fidelity and flagged:
  `undoBuild`'s buildRoad branch filters `v.roadIds` by `edgeId`
  instead of `roadId`.
