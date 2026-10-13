# ADR 0001: Token-first design system, applied before mobile UI

## Status

Accepted (2026-10-12)

## Context

The UI grew without a design system: stock Tailwind (`theme.extend` empty),
emoji for chrome icons, ad-hoc sizes/colors per component. Result: "everything
slightly off" — no single bug, but inconsistent spacing, shape, and tone
everywhere. A separate mobile UI (`plans/MOBILE_UI_PLAN.md`) is also coming,
which would double the styling surface.

## Decision

1. **Direction**: warm & playful — soft palette, rounded shapes, playful type.
2. **Foundation**: Tailwind design tokens (color, type scale, radius, spacing)
   + shared primitives (Button, Modal, Chip) built on them; screens are
   reskinned via the primitives, not hand-edited classes.
3. **Icons (hybrid)**: real SVG icons for chrome (menu, close, players);
   emoji/art stays for game flavor (resources, pieces).
4. **Motion**: CSS transitions plus a spring library for drags, chips, modals.
5. **Order**: design system first; the mobile UI is then built on the same
   tokens/primitives from day one.

## Consequences

- Every future screen inherits the feel; "slightly off" can't creep back
  per-component.
- One restyle pass pays for both desktop and mobile; mobile components are
  styled once instead of twice.
- Two new dependencies (icon set, spring library) and a primitives layer that
  existing screens must be migrated onto — the migration is the bulk of the
  work.
- Performance work is evidence-gated: a profiling ticket precedes fixes.
