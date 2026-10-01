# Mobile-Friendly Plan — Risky Reign

Goal: a phone or tablet player can join a room from a shared link and play a
full game (setup → dice → build/trade → soldiers/battles → win) with touch
only, without pinch-zooming the page or hitting controls by accident.

Scope: the `ui/` client only. The server, socket protocol, and game rules do
not change. Desktop keeps working throughout.

---

## 0. Current state (surveyed 2026-09-29)

The game screen is a fixed two-column layout: board on the left, a 420 px
sidebar on the right (`containers/Game.tsx`, `SIDEBAR_W` in `ui/src/constants.ts`).
Nothing adapts to screen size — there are **2** responsive Tailwind prefixes
in the whole app, both in the board editor.

| Area | Today | Why it breaks on a phone |
|---|---|---|
| **Layout** | Sidebar is a fixed 420 px column (`SideBar/Index.tsx`, `SideBar/styles.ts:4` `w-[420px]`) | A 375–430 px phone has no room for the board at all |
| **Overlays placed off the sidebar** | `TurnOverlay.tsx:43` and `DiceDisplay.tsx:61` use `right: SIDEBAR_W + 12` | Pinned relative to a sidebar that won't exist in the same place |
| **Board input** | Pan = `onMouseDown` + window `mousemove` (`useBoardViewport.ts:77–118`); zoom = mouse wheel + double-click | No touch pan, no pinch zoom; a touch drag scrolls/zooms the page instead |
| **Piece drags** | Soldier drag `SoldierBadges.tsx:57` and robber drag `Hexagon.tsx:67` start on `onMouseDown`; move/drop on the board svg's `onMouseMove`/`onMouseUp` (`BoardView.tsx:211–212`) | Mouse-only; there is no drag at all on touch |
| **Hover-only UI** | Vertex/edge highlight (`BoardVertex.tsx:61`, `PieceLayers.tsx`), robber-bag popup opens on hover only (`Hexagon.tsx:68`, `BoardView.tsx:48,234`) | Touch has no hover: the robber bag contents are unreachable |
| **Tap targets** | Vertex dot `r=8` board units, edge line 4 units wide (8 with a road), trade steppers `w-5 h-5` (20 px) | At phone width the board scales to ~0.37×: vertex ≈ 6 px, edge ≈ 1.6 px — far below the ~44 px touch minimum |
| **Fixed-width screens** | Lobby waiting room `grid-cols-[1fr_auto_1fr]` + `max-w-[520px]` + `max-w-[320px]` (`pages/Game.tsx:162–221`); battle modal `max-w-7xl` + 300-unit mini-map (`BattleModal.tsx:120`); prompts `max-w-[480–520px]` | Waiting room's 3-column grid doesn't collapse; battle modal is desktop-sized |
| **Viewport height** | `min-h-screen` (100vh) on Lobby/Game/App wrappers; game uses `fixed inset-0` | Mobile Safari's toolbar makes 100vh taller than the visible area; no `safe-area-inset` handling for notches/home bar |
| **Board editor** | Mouse drag + wheel (`editor/useEditorCanvas.ts`, `BoardEditorCanvas.tsx`), 650 px canvas, 300 px side panel | Desktop tool; low value on a phone |
| **Session** | Seat token lives in `sessionStorage` (`utils/session.ts`) | Mobile browsers evict backgrounded tabs; `sessionStorage` is lost → player can't rejoin their seat |
| **Reconnect** | `ConnectionBanner` shows on socket `disconnect`; socket.io auto-reconnects | Backgrounded mobile tabs are suspended; on return the socket must reconnect *and* re-attach the seat |

**Already mobile-safe:** viewport meta is correct (`width=device-width,
initial-scale=1`); the board SVG already sizes itself to its container with a
`ResizeObserver` (`BoardView.tsx:53–65`); the join link (`/join?id=CODE`) works
on any device; the board-editor canvas already sets `touchAction: 'none'`.

---

## 1. Work every option needs (the foundation)

These are independent of which layout option you pick. Do them first.

### 1.1 Unify input on Pointer Events
Replace mouse handlers with pointer handlers so one code path serves mouse,
touch, and pen.
- `useBoardViewport.ts`: `onPointerDown` + `setPointerCapture`; track active
  pointers in a `Map<pointerId, point>`. One pointer → pan; two pointers →
  **pinch zoom** around the midpoint. Keep wheel zoom for desktop.
- Board `<svg>`: `style={{ touchAction: 'none' }}` so the browser doesn't
  scroll/zoom the page while the board is being manipulated.
- `useBoardDrag.ts`, `SoldierBadges.tsx`, `Hexagon.tsx`: switch drag start/move/
  end to pointer events.
- Replace double-click zoom with a double-*tap* (two `pointerup`s within ~300 ms).

### 1.2 Tap-to-select instead of drag-and-drop
Drag-and-drop on a small touch board is error-prone. Keep drag for desktop,
and add the **tap flow** that already exists for battle repositioning
(`useBattleReposition.ts`: select → valid targets light up → tap target):
- **Move soldier:** tap your soldier badge → valid vertices highlight → tap one.
  (The sidebar group panel already has "Move to a/b/c" buttons — this is the
  on-board equivalent.)
- **Move robber:** when a robber move is pending, valid hexes highlight → tap one.
- **Robber bag:** tap the robber to toggle the popup (hover still works on desktop).

### 1.3 Bigger hit areas without bigger art
Add invisible hit shapes so the visuals stay the same:
- Vertices: a transparent `<circle>` with radius ≈ 22 px **in screen space**
  (compute from the current board scale, or just use a generous board-unit
  radius and rely on zoom).
- Edges: a transparent `<line>` with `strokeWidth` ≈ 20 px screen space under
  the visible road.
- Controls: minimum 40–44 px buttons on touch (`@media (pointer: coarse)` or
  Tailwind's `pointer-coarse:` variant once enabled); fix the 20 px trade steppers
  and the 36 px color swatches.

### 1.4 Viewport & device chrome
- Use `dvh` (`h-dvh`) instead of `100vh` for full-height screens; keep a `vh`
  fallback.
- Add `viewport-fit=cover` to the viewport meta and pad fixed bars with
  `env(safe-area-inset-*)` (turn pill, ☰ menu, bottom sheet).
- Disable accidental text selection / callouts on the board
  (`-webkit-touch-callout: none`, already `select-none` on the svg).

### 1.5 Survive tab eviction
- Store the seat token in `localStorage` (keyed by room id) instead of
  `sessionStorage`, so a reloaded/evicted mobile tab re-attaches to its seat.
  Keep the existing "only for this exact room" rule in `SocketContext.joinRoom`.
- On `visibilitychange` → visible, if the socket is disconnected, force a
  reconnect + `joinRoom` with the saved token (the server already supports
  token re-attach — see `handlers/room.ts`).

### 1.6 Decouple overlays from `SIDEBAR_W`
`TurnOverlay` and `DiceDisplay` compute their position from the sidebar width.
Position them relative to the board container instead (render them inside it,
or read its size), so any layout option can move the sidebar freely.

---

## 2. Layout options

### Option A — Responsive single app with a bottom sheet

One codebase; the layout switches at a breakpoint.

- **≥ 1024 px (desktop/landscape tablet):** today's layout, unchanged.
- **< 1024 px (phone/portrait tablet):** board fills the screen; the sidebar
  becomes a **bottom sheet** with three snap heights — *peek* (tab bar + one-line
  status), *half* (vertex/edge actions), *full* (trade, players). Selecting a
  vertex/edge auto-opens it to *half*. The resource display collapses into a
  compact strip in the peek bar.
- Modals (battle, discard, steal, dev card, victory) become **full-screen
  sheets** on small screens.
- Lobby waiting room: the 3-column grid stacks into one column (settings below
  the room card).

| Pros | Cons |
|---|---|
| One code path for game logic and components; no drift | The biggest refactor of `SideBar/Index.tsx` and `Game.tsx` |
| Players on desktop and phone share the same UI concepts | Bottom-sheet gestures need care (don't fight board pan) |
| Every screen improves, including the lobby | Needs testing at several widths |

**Effort:** foundation (§1) + ~1–2 weeks of layout work.

### Option B — Separate mobile layout component (chosen — see `MOBILE_UI_PLAN.md`)

Same state and sockets, but a dedicated `MobileGame.tsx` (and mobile variants
of the sidebar panels) chosen at load by screen size/pointer type.

- Mobile UI is designed from scratch around thumbs: bottom tab bar
  (Board / Trade / Players / Menu), a floating action button for the current
  phase's primary action ("Roll", "End turn"), full-screen panels.
- Desktop code is untouched.

| Pros | Cons |
|---|---|
| Freedom to design the phone UX properly without desktop compromises | Two layouts to maintain; features must be added twice |
| Zero risk to the desktop experience | Easy for mobile to fall behind (e.g. trade or battle changes) |
| Can ship incrementally (mobile behind a flag) | Shared panels still need the §1 input/tap-target work |

**Effort:** foundation (§1) + ~2–3 weeks; ongoing duplicate maintenance.

### Option C — Minimal "works on a tablet" pass

Don't redesign; make the current layout usable on large touch screens
(iPad landscape, ~1024 px+) and tolerable on phones in landscape.

- Do only §1 (pointer events, pinch zoom, tap-to-select, hit areas, dvh).
- Make the sidebar narrower (e.g. 320 px) below 1280 px and let it collapse to
  a slide-over drawer behind a button on anything narrower.
- Phones in portrait get a "rotate your device" hint.

| Pros | Cons |
|---|---|
| Smallest change; lowest risk | Phones in portrait still aren't really supported |
| Tablets become fully playable | Drawer hides the sidebar you need most of the time |
| Foundation work is reused by A or B later | Likely redone when a real phone layout is wanted |

**Effort:** ~1 week.

### Option D — Installable PWA (add-on to A, B, or C)

Not a layout on its own — layered on top of whichever option you pick.

- Web app manifest (name, icons, `display: standalone`, portrait/landscape),
  so players can "Add to Home Screen" and play without browser chrome
  (fixes most of the 100vh/toolbar problems for free).
- A small service worker that caches the app shell (JS/CSS/art) for fast
  loads; **not** offline play — the game needs the server.
- Optional later: Web Push "It's your turn" notifications (needs a server
  endpoint + VAPID keys; iOS supports it only for installed PWAs).

| Pros | Cons |
|---|---|
| Full-screen, app-like feel; faster repeat loads | Service-worker caching can serve stale builds — needs versioning |
| Turn notifications are the biggest mobile quality-of-life win | Push requires backend work and permission prompts |

**Effort:** ~2–3 days for manifest + shell cache; push is a separate project.

### Option E — Native wrapper (Capacitor) — not recommended now

Wrap the web app in Capacitor for App Store / Play Store builds.

- Only worth it for native push, store presence, or haptics.
- Store accounts, review cycles, and signing add ongoing overhead.
- Every problem in §0 still has to be fixed in the web UI first.

**Effort:** ~1 week to wrap + store overhead; revisit after A/B + D.

---

## 3. Comparison

| | A: Responsive sheet | B: Separate mobile UI | C: Tablet pass | D: PWA add-on | E: Native wrapper |
|---|---|---|---|---|---|
| Phone portrait playable | ✅ | ✅ (best UX) | ❌ | depends on base | depends on base |
| Tablet playable | ✅ | ✅ | ✅ | — | — |
| Desktop risk | medium | none | low | none | none |
| Ongoing maintenance | low | high | low | low | high |
| Effort (on top of §1) | 1–2 wk | 2–3 wk | ~0 | 2–3 days | ~1 wk + stores |

**Decision (2026-09-29): Option B — separate mobile UI.** The detailed plan is
in [`MOBILE_UI_PLAN.md`](./MOBILE_UI_PLAN.md). Its Phase 0 extracts shared
view-model hooks first, which addresses B's main risk (the two UIs drifting).
Option D (PWA) is kept as an optional final phase.

The rest of this document is the original options analysis; §4 below
describes the path for Option A and is superseded by `MOBILE_UI_PLAN.md`.

---

## 4. Suggested phases (for Option A — superseded, see `MOBILE_UI_PLAN.md`)

1. **Input foundation** — §1.1 pointer events + pinch zoom + `touch-action`;
   §1.2 tap-to-select for soldiers and robber; tap for robber bag.
   *Done when:* a full game is playable on an iPad with touch only.
2. **Hit areas & chrome** — §1.3 invisible hit shapes + 44 px controls;
   §1.4 `dvh` + safe-area; §1.6 overlays positioned from the board container.
3. **Session resilience** — §1.5 `localStorage` seat token + reconnect on
   `visibilitychange`. *Done when:* backgrounding Safari for 5 minutes and
   returning puts you back in your seat.
4. **Phone layout (Option A)** — bottom sheet for the sidebar; full-screen
   modals; stacked lobby. *Done when:* a full game is playable on a 375 px-wide
   phone in portrait.
5. **PWA (Option D)** — manifest, icons, app-shell cache with versioned
   invalidation.
6. **Turn notifications (optional)** — Web Push for "your turn" / "you were
   attacked".

## 5. How to test

- **Chrome DevTools device mode** for layout at 375×812 (iPhone), 390×844,
  430×932, 768×1024 (iPad portrait), 1024×1366 (iPad Pro landscape).
- **Real devices** for touch: iOS Safari (strictest — 100vh, suspended tabs,
  push only when installed) and Android Chrome.
- Every phase ends with a full two-player game where one player is on a phone
  and one on desktop, covering: setup placement, a 7 (discard + robber move),
  a trade, recruiting and moving a soldier, a battle with repositioning.
