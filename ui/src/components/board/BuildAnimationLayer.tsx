import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { BoardUIState } from 'common';
import {
  BOARD_VERTEX_SIZE,
  BUILD_CITY_POP_MS,
  BUILD_CITY_REVEAL_MS,
  BUILD_PUFF_MS,
  BUILD_ROAD_MS,
  BUILD_SETTLE_MS,
} from '../../constants';
import { houseFrame } from '../../utils/boardPresentation';
import { diffBuilds } from '../../utils/buildDiff';
import { hidePiece, showPiece, clearHiddenPieces } from './buildFx';
import { TintedSprite } from '../TintedSprite';
import { CITY_ART, SETTLEMENT_ART } from '../../utils/tintedArt';
import { BoardEdgeRender, BoardVertexRender } from '../../types/board';

/**
 * Cosmetic layer for builds: diffs consecutive presentation board states and
 * plays a piece animation at the changed location — settlement pop, road
 * grow, city smoke-then-pop. All clients play the same animation from the
 * same room broadcast; gameplay never waits on it (non-blocking).
 *
 * Design notes:
 * - Animations run on framer-motion (its own rAF interpolation), not WAAPI:
 *   element.animate() doesn't interpolate SVG properties like
 *   stroke-dashoffset, and transform support on SVG elements is spotty
 *   across engines — both failure modes silently drop the animation while
 *   the piece stays hidden.
 * - The claim on the real piece lives HERE, on a plain timer created with
 *   the anim — not inside PieceAnim. A child effect's cleanup would fire on
 *   StrictMode's mount probe and release the claim instantly (no visible
 *   animation); timers in the parent survive it.
 * - Reduced-motion OS setting skips animations entirely; the layer's own
 *   unmount clears all timers and claims.
 */

let nextAnimKey = 0;

interface ActiveAnim {
  key: number;
  kind: 'settlement' | 'city' | 'road';
  id: string;
  token: symbol;
  vertex?: BoardVertexRender;
  edge?: BoardEdgeRender;
}

/* Smoke puff choreography for the city upgrade: deterministic scatter around
 * the settlement's roofline, blooming upward. Offsets are SVG user units. */
const PUFFS: { x: number; y: number; r: number; dx: number; delay: number }[] = [
  { x: 0, y: -24, r: 13, dx: -14, delay: 60 },
  { x: -10, y: -30, r: 10, dx: -24, delay: 140 },
  { x: 10, y: -30, r: 11, dx: 20, delay: 220 },
  { x: 0, y: -38, r: 9, dx: 6, delay: 300 },
  { x: -18, y: -20, r: 8, dx: -30, delay: 180 },
];

const PUFF_FILL = '#d8d2c8';

const POP_EASE = [0.34, 1.56, 0.64, 1] as const;
const POP_TIMES = [0, 0.55, 0.78, 1];

/** Total claim duration per kind (small buffer over the visual length so the
 *  real piece doesn't flicker back in mid-tween). */
const DURATION_MS: Record<ActiveAnim['kind'], number> = {
  settlement: BUILD_SETTLE_MS + 50,
  road: BUILD_ROAD_MS + 50,
  city: BUILD_CITY_REVEAL_MS + BUILD_CITY_POP_MS + 50,
};

/** Pure renderer: draws the stand-in piece for one anim. No effects, no
 *  timers — its lifecycle is owned by the layer (StrictMode-safe). */
const PieceAnim: React.FC<{ anim: ActiveAnim }> = ({ anim }) => {
  if (anim.kind === 'road' && anim.edge) {
    const { start, end } = anim.edge;
    const len = Math.hypot(end.x - start.x, end.y - start.y);
    return (
      <g pointerEvents="none">
        <motion.line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={anim.edge.ownerColor ?? '#8B4513'}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={len}
          initial={{ strokeDashoffset: len }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: BUILD_ROAD_MS / 1000, ease: 'easeOut' }}
        />
      </g>
    );
  }

  if (!anim.vertex) return null;
  const v = anim.vertex;
  const color = v.ownerColor ?? '#999';
  const cityFrame = houseFrame(true, v.position, BOARD_VERTEX_SIZE);
  const settleFrame = houseFrame(false, v.position, BOARD_VERTEX_SIZE);

  return (
    <g pointerEvents="none">
      {anim.kind === 'settlement' && (
        <motion.g
          style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
          initial={{ scaleX: 0, scaleY: 0 }}
          animate={{ scaleX: [0, 1.18, 0.94, 1], scaleY: [0, 0.82, 1.06, 1] }}
          transition={{ duration: BUILD_SETTLE_MS / 1000, times: POP_TIMES, ease: POP_EASE }}
        >
          <TintedSprite
            art={SETTLEMENT_ART}
            color={color}
            x={settleFrame.x}
            y={settleFrame.y}
            width={settleFrame.w}
            height={settleFrame.h}
          />
        </motion.g>
      )}
      {anim.kind === 'city' && (
        <>
          {/* The outgoing settlement crumples as the smoke builds (the diff
              only emits 'city' for settlement→city, so it always existed). */}
          <motion.g
            style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
            initial={{ scaleX: 1, scaleY: 1, opacity: 1 }}
            animate={{ scaleX: 0.85, scaleY: 0.4, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeIn' }}
          >
            <TintedSprite
              art={SETTLEMENT_ART}
              color={color}
              x={settleFrame.x}
              y={settleFrame.y}
              width={settleFrame.w}
              height={settleFrame.h}
            />
          </motion.g>
          {PUFFS.map((p, i) => (
            <motion.circle
              key={i}
              cx={v.position.x + p.x}
              cy={v.position.y + p.y}
              r={p.r}
              fill={PUFF_FILL}
              initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
              animate={{
                x: [0, p.dx * 0.4, p.dx],
                y: [0, -18, -46],
                scale: [0.3, 0.9, 1.35],
                opacity: [0, 0.85, 0],
              }}
              transition={{ duration: BUILD_PUFF_MS / 1000, delay: p.delay / 1000, ease: 'easeOut' }}
            />
          ))}
          <motion.g
            style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
            initial={{ scaleX: 0, scaleY: 0 }}
            animate={{ scaleX: [0, 1.18, 0.94, 1], scaleY: [0, 0.82, 1.06, 1] }}
            transition={{
              duration: BUILD_CITY_POP_MS / 1000,
              delay: BUILD_CITY_REVEAL_MS / 1000,
              times: POP_TIMES,
              ease: POP_EASE,
            }}
          >
            <TintedSprite
              art={CITY_ART}
              color={color}
              x={cityFrame.x}
              y={cityFrame.y}
              width={cityFrame.w}
              height={cityFrame.h}
            />
          </motion.g>
        </>
      )}
    </g>
  );
};

/**
 * Mount inside the board SVG (after VertexLayer). Diffs `base` snapshots and
 * replays each build's animation; never blocks input.
 */
const BuildAnimationLayer: React.FC<{
  base: BoardUIState;
  colorOf: (ownerId: string | null) => string | undefined;
}> = ({ base, colorOf }) => {
  const reduce = useReducedMotion();
  const [anims, setAnims] = useState<ActiveAnim[]>([]);
  const prevRef = useRef<BoardUIState | null>(null);
  // One release timer per live anim, owned here so child remounts (StrictMode,
  // re-renders) can't release a claim early — and an unmount clears them all.
  const timersRef = useRef<Map<number, number>>(new Map());

  const removeAnim = useCallback((a: ActiveAnim) => {
    const t = timersRef.current.get(a.key);
    if (t !== undefined) {
      clearTimeout(t);
      timersRef.current.delete(a.key);
    }
    showPiece(a.id, a.token);
    setAnims((list) => list.filter((x) => x !== a));
  }, []);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = base;
    // No baseline (first snapshot / rejoin) or reduced motion: adopt the
    // board as-is, animate nothing.
    if (!prev || reduce) return;
    const changes = diffBuilds(prev, base);
    if (changes.length === 0) return;
    // Claim the pieces BEFORE queueing state: hidePiece inside the updater
    // would run per updater invocation (React may replay updaters), letting
    // the committed token and the map's token diverge — the exact 'piece
    // never shows again' failure.
    const fresh: ActiveAnim[] = changes.map((c) => {
      const token = hidePiece(c.id);
      const a: ActiveAnim = { key: nextAnimKey++, kind: c.kind, id: c.id, token };
      if (c.kind === 'road') {
        const edge = base.edges[c.id];
        if (edge) a.edge = { ...edge, ownerColor: colorOf(edge.roadOwnerId) };
      } else {
        const vertex = base.vertices[c.id];
        if (vertex) a.vertex = { ...vertex, ownerColor: colorOf(vertex.settlementOwnerId) };
      }
      return a;
    });
    // One self-releasing timer per anim: deterministic lifetime regardless
    // of what the child component does.
    fresh.forEach((a) =>
      timersRef.current.set(a.key, window.setTimeout(() => removeAnim(a), DURATION_MS[a.kind]))
    );
    setAnims((list) => [...list, ...fresh]);
  }, [base, reduce, colorOf, removeAnim]);

  // Layer unmount: release every claim and timer so nothing stays hidden.
  useEffect(
    () => () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
      clearHiddenPieces();
    },
    []
  );

  return (
    <g data-build-anims={anims.length}>
      {anims.map((a) => (
        <PieceAnim key={a.key} anim={a} />
      ))}
    </g>
  );
};

export default BuildAnimationLayer;
