# Glossary

## UI surfaces

| Term | Meaning |
|------|---------|
| Corner pill | The bottom-left control unit: last roll + settings (⚙️) button in one bordered container. Replaced the hamburger menu + floating compact dice. |
| Notice rail | The top-center column: turn status bar (phase, undo, end turn), your-turn toast, trade pop-ups, and waiting/action notices, stacked so they can't overlap. |
| Turn timeline | The dropdown under the phase button showing current + next 5 turns as colored nodes with player and phase labels. |
| Action bubbles | The contextual buttons that pop at bottom-center when a vertex/edge/soldier/robber is selected on the board. |
| Players panel | The scrollable column of player chips opened by the 👤 button on the map's left edge. |
| Player chip | One compact row per player: color dot, name, bonus glyphs (🛤️⚔️👑), ⭐VP, 🃏cards. |
| Resource panel | The right-edge slide-out of your hand; collapsed to a lip, expanded by its ▼ chevron. |

## Design language

| Term | Meaning |
|------|---------|
| Warm & playful | The design direction (ADR 0001): soft palette, rounded shapes, playful type. |
| Tokens | Tailwind theme values (color, type scale, radius, spacing) all styling derives from — the single source of visual truth. |
| Primitives | Shared components built on tokens (Button, Modal, Chip) — screens compose these rather than raw classes. |
| Chrome icons | UI chrome (menu, close, players, settings) — rendered as real SVG icons, not emoji. |
| Game flavor | Emoji/art that *is* the game (resource cards, soldier/robber sprites, terrain art) — kept as-is. |
