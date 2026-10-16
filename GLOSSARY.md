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
