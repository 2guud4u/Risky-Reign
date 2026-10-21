import React, { useEffect, useRef } from 'react';
import { TROOP_ART, TROOP_R } from '../../constants';
import { BATTLE_ART, SOLDIER_ART, INJURED_SOLDIER_ART, CANNON_STATIONED_ART, CANNON_UNSTATIONED_ART, type TintArt } from '../../utils/tintedArt';
import { ROBBER_ART, SOLDIER_ICON_HEIGHT, SOLDIER_ICON_LIFT } from './constants';

/**
 * The fight-replay stage: an SVG overlay that replays the just-resolved round
 * with the pose art from `ui/public/art/battle/`, driven by the Web
 * Animations API (same choreography as battle-animation-demo.html).
 *
 * Geometry matches the demo: 480×240 stage, a standing soldier is 110px tall
 * (K = 110/66 game units), feet on GROUND, figures face the center clash
 * line. With more than one fight the rows shrink (the demo's 3-row layout).
 */

const W = 480;
const H = 240;
const CX = 240;
const GROUND = 205;
/** Stage px per game unit: a standing soldier is 66 units tall = 110px. */
const K = 110 / 66;

/** One sprite the stage can draw: size in game units and the feet anchor
 *  (ax, ay) — the point on the troop's ground spot, so pose swaps never make
 *  the figure jump. All art faces LEFT except `facesRight` poses, which are
 *  mirrored about the feet point so they still face the clash line. */
interface Pose {
  art: TintArt;
  w: number;
  h: number;
  ax: number;
  ay: number;
  facesRight?: boolean;
  /** Full-canvas art (the standing robber): the figure inside it. */
  canvas?: { cw: number; ch: number; x: number; y: number; fw: number; fh: number };
}

const POSES: Record<string, Pose> = {
  soldier: { art: SOLDIER_ART, w: TROOP_ART.soldier.w, h: TROOP_ART.soldier.h, ax: 13.37, ay: 66 },
  injured: { art: INJURED_SOLDIER_ART, w: TROOP_ART.injured.w, h: TROOP_ART.injured.h, ax: 16.61, ay: 66 },
  cannonStationed: {
    art: CANNON_STATIONED_ART, w: TROOP_ART.cannonStationed.w, h: TROOP_ART.cannonStationed.h, ax: 41.2, ay: 69.56,
  },
  cannonUnstationed: {
    art: CANNON_UNSTATIONED_ART, w: TROOP_ART.cannonUnstationed.w, h: TROOP_ART.cannonUnstationed.h, ax: 29.21, ay: 47.74,
  },
  thrust: { art: BATTLE_ART.thrust, w: 72.48, h: 48.29, ax: 54.68, ay: 48.19 },
  slash: { art: BATTLE_ART.slash, w: 78.97, h: 52.35, ax: 37.23, ay: 52.26 },
  stabbed: { art: BATTLE_ART.stabbed, w: 48.87, h: 53.71, ax: 30.69, ay: 53.61 },
  injuredStabbed: { art: BATTLE_ART.injuredStabbed, w: 53.86, h: 62, ax: 12.31, ay: 61.9 },
  stunned: { art: BATTLE_ART.stunned, w: 39.58, h: 58.26, ax: 27.89, ay: 58.16 },
  cannonFire: { art: BATTLE_ART.cannonFire, w: 88.76, h: 58.99, ax: 61.48, ay: 58.85 },
  cannonWreck: { art: BATTLE_ART.cannonWreck, w: 61.49, h: 42.29, ax: 34.57, ay: 42.15 },
  robber: { art: { href: '/art/robber.png' }, h: 66, facesRight: true,
    canvas: { cw: ROBBER_ART.canvasW, ch: ROBBER_ART.canvasH, x: ROBBER_ART.x, y: ROBBER_ART.y, fw: ROBBER_ART.w, fh: ROBBER_ART.h }, w: 0, ax: 0, ay: 0 },
  robberStrike: { art: BATTLE_ART.robberStrike, w: 57.32, h: 75.77, ax: 38.34, ay: 75.66 },
  robberStabbed: { art: BATTLE_ART.robberStabbed, w: 52.16, h: 62.16, ax: 31.46, ay: 62.05, facesRight: true },
};

/** Every pose a troop kind may swap into during a fight. */
const TROOP_POSES: Record<string, string[]> = {
  soldier: ['thrust', 'slash', 'stabbed', 'stunned', 'injured'],
  injured: ['injuredStabbed', 'stunned'],
  cannonStationed: ['cannonFire', 'cannonWreck'],
  cannonUnstationed: ['cannonWreck'],
  robber: ['robberStrike', 'robberStabbed'],
};

// ---------------------------------------------------------------- types

export type FightOutcome =
  | 'killAttacker' | 'injureAttacker'
  | 'killDefender' | 'injureDefender'
  | 'miss'        // ranged shot only: the ball lands short
  | 'flee'        // unstationed cannon wins: it rolls out of the fight
  | 'escape'      // injured fight only: the injured defender rolled higher and scuttles off
  | 'draw';       // nobody can hurt anybody (unstationed cannons only)

export interface FightTroop {
  /** Pose kind: soldier | injured | cannonStationed | cannonUnstationed | robber. */
  kind: string;
  color: string;
  roll: number | null;
  /** Committed soldier id — lets the armies view hide this troop while it duels. */
  id?: string;
}

export interface Fight {
  attacker: FightTroop;
  defender: FightTroop;
  outcome: FightOutcome;
  /** Ranged shot: the cannon fires instead of a melee; misses don't react. */
  ranged?: boolean;
  /** Robber fight win: the sack flies to the victor. */
  sack?: boolean;
  /** The pair's clash-line row in world coords (map layout only). */
  rowY?: number;
}

export interface FightStageProps {
  fights: Fight[];
  /** Fired once the choreography has played out. */
  onDone?: () => void;
}

// ------------------------------------------------------------- pose layer

let uid = 0;

/**
 * One pose stacked at a troop's feet spot, tinted through its mask the same
 * way the game's bake does it (mask image filled with the owner color, art
 * drawn over). Hidden by style so the choreographer can toggle it.
 */
const PoseLayer: React.FC<{ name: string; color: string; x: number; ground: number; k: number; show: boolean }> = ({
  name,
  color,
  x,
  ground,
  k,
  show,
}) => {
  const p = POSES[name];
  const maskId = useRef(`fp${uid++}`).current;
  const flip = p.facesRight
    ? `translate(${x} ${ground}) scale(-1 1) translate(${-x} ${-ground})`
    : undefined;
  if (p.canvas) {
    // The standing robber is a full canvas: place it so its figure stands at x.
    const s = (p.h * k) / p.canvas.fh;
    const fw = p.canvas.fw * s;
    return (
      <g data-pose={name} style={{ opacity: show ? 1 : 0 }}>
        <g transform={flip}>
          <image
            href={p.art.href}
            x={x - fw / 2 - p.canvas.x * s}
            y={ground - p.h * k - p.canvas.y * s}
            width={p.canvas.cw * s}
            height={p.canvas.ch * s}
          />
        </g>
      </g>
    );
  }
  const w = p.w * k;
  const h = p.h * k;
  const x0 = x - p.ax * k;
  const y0 = ground - p.ay * k;
  return (
    <g data-pose={name} style={{ opacity: show ? 1 : 0 }}>
      <g transform={flip}>
        {p.art.maskHref && (
          <>
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse" x={x0} y={y0} width={w} height={h}>
                <image href={p.art.maskHref} x={x0} y={y0} width={w} height={h} preserveAspectRatio="none" />
              </mask>
            </defs>
            <rect x={x0} y={y0} width={w} height={h} fill={color} mask={`url(#${maskId})`} />
          </>
        )}
        <image href={p.art.href} x={x0} y={y0} width={w} height={h} preserveAspectRatio="none" />
      </g>
    </g>
  );
};

/** A die badge above a troop (attack side rolls left, defence right). */
const DieBadge: React.FC<{ x: number; n: number | null; cy?: number; size?: number; font?: number }> = ({
  x,
  n,
  cy = 24,
  size = 26,
  font = 14,
}) =>
  n === null ? null : (
    <g>
      <rect x={x - size / 2} y={cy - size / 2} width={size} height={size} rx={6} fill="#1f2937" stroke="#fff" strokeWidth={1.5} />
      <text x={x} y={cy + 1} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={font} fontWeight={700}>
        {n}
      </text>
    </g>
  );

// ------------------------------------------------------- imperative engine

/** Runtime view of one troop: the outer group moves (lunge/recoil); the
 *  inner mirror keeps every figure facing the clash line. */
interface TroopHandle {
  outer: SVGGElement;
  layers: Map<string, SVGGElement>;
  x: number;
  kind: string;
  /** +1 when the troop stands left of the clash line (faces right). */
  dir: 1 | -1;
  current: string;
}

/** Where a scene sits: the clash-line x in the scene's own row coords, plus
 *  per-row verdict label placement. */
export interface SceneLayout {
  cx: number;
  /** Sequential: each pair starts after the previous fight's beats end. */
  sequential?: boolean;
  /** Row-space x for per-row verdict labels (defaults to cx + 175). */
  labelX?: number;
  /** Label text-anchor (defaults to 'start'). */
  labelAnchor?: 'start' | 'middle' | 'end';
  /** Suppress per-row verdict labels entirely (map mode: badges carry rolls). */
  labels?: false;
}

type Pt = [number, number, number?];

const NS = 'http://www.w3.org/2000/svg';
const el = (tag: string, attrs: Record<string, string | number>, parent: Element) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent.appendChild(e);
  return e as SVGElement;
};

/** Wall-clock stretch on every scheduled beat: 1.5 = fights run 50% longer.
 *  Applied inside anim(), so all timings below stay in design ms. */
const SPEED = 1.5;

/**
 * Play one scene: collect every scheduled animation, then fire `onDone`
 * after the last one. Returns the cancel cleanup.
 */
export function playFights(svg: SVGElement, fights: Fight[], onDone?: () => void, scene: SceneLayout = { cx: CX }): () => void {
  let maxEnd = 0;
  const anims: Animation[] = [];
  // Every node the engine appends (sparks, poofs, dead marks, cannonballs,
  // labels) — removed on cleanup so a StrictMode double-mount or remount
  // doesn't leave ghosts behind (animations revert, nodes don't).
  const spawned: Element[] = [];
  const spawn = (tag: string, attrs: Record<string, string | number>, parent: Element): SVGElement => {
    const e = el(tag, attrs, parent);
    spawned.push(e);
    return e;
  };
  const anim = (node: Element | SVGGElement, frames: Keyframe[], delay: number, dur: number, extra: KeyframeAnimationOptions = {}) => {
    const a = node.animate(frames, { delay: delay * SPEED, duration: dur * SPEED, fill: 'both', easing: 'ease-in-out', ...extra });
    anims.push(a);
    maxEnd = Math.max(maxEnd, (delay + dur) * SPEED);
    return a;
  };

  // Opacity toggles (pose swaps, labels, × marks) are collected per node and
  // built into ONE keyframe track by flushToggles(): separate show/hide
  // animations on the same node fight over which one wins.
  const TOG = new Map<SVGGElement | SVGElement, { init: number; ev: [number, number, number][] }>();
  const toggle = (n: SVGGElement | SVGElement, at: number, d: number, v: number) => {
    if (!TOG.has(n)) {
      const o = (n as SVGElement).style?.opacity;
      TOG.set(n, { init: o === '' || o === undefined ? 1 : +o, ev: [] });
    }
    TOG.get(n)!.ev.push([at, Math.max(d, 1), v]);
  };
  const show = (n: SVGGElement | SVGElement, at: number, d = 1) => toggle(n, at, d, 1);
  const hide = (n: SVGGElement | SVGElement, at: number, d = 1) => toggle(n, at, d, 0);
  const flushToggles = () => {
    for (const [n, { init, ev }] of TOG) {
      ev.sort((a, b) => a[0] - b[0]);
      const end = Math.max(...ev.map(([at, d]) => at + d)) + 1;
      const frames: Keyframe[] = [{ offset: 0, opacity: init }];
      let cur = init;
      for (const [at, d, v] of ev) {
        frames.push({ offset: at / end, opacity: cur }, { offset: (at + d) / end, opacity: v });
        cur = v;
      }
      frames.push({ offset: 1, opacity: cur });
      anim(n, frames, 0, end, { easing: 'linear' });
    }
    TOG.clear();
  };

  /** Swap the visible pose at time `at` (hard cut, like a sprite frame). */
  const setPose = (t: TroopHandle, name: string, at: number) => {
    const next = t.layers.get(name);
    const cur = t.layers.get(t.current);
    if (!next || next === cur) return;
    if (cur) hide(cur, at);
    show(next, at);
    t.current = name;
  };
  /** One movement track per troop: [timeMs, dx, dy] points, interpolated
   *  piecewise; the whole scene shares one dx frame so sequential beats
   *  (lunge, walk back) chain without jumps. */
  const track = (t: TroopHandle, pts: Pt[], easing = 'ease-in-out') => {
    const t0 = pts[0][0];
    const t1 = pts[pts.length - 1][0];
    const span = Math.max(t1 - t0, 1);
    anim(
      t.outer,
      pts.map(([ms, dx, dy = 0]) => ({ transform: `translate(${dx}px,${dy}px)`, offset: (ms - t0) / span, easing })),
      t0,
      span,
      { easing: 'linear' }
    );
  };
  /** Walking bob: small hops between `from` and `to` dx over [a, b] ms. */
  const walk = (a: number, b: number, from: number, to: number, steps = 3): Pt[] => {
    const pts: Pt[] = [];
    for (let i = 0; i <= steps * 2; i++) {
      const f = i / (steps * 2);
      pts.push([a + (b - a) * f, from + (to - from) * f, i % 2 ? -4 : 0]);
    }
    return pts;
  };

  // ---- effects ----
  const starPts = (cx: number, cy: number, R: number, r: number, n: number) => {
    const pts: string[] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n - Math.PI / 2;
      const rr = i % 2 ? r : R;
      pts.push(`${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`);
    }
    return pts.join(' ');
  };
  const hitSpark = (parent: Element, x: number, y: number, at: number) => {
    const s = spawn('polygon', { points: starPts(x, y, 15, 6, 8), fill: '#fff2a8', stroke: '#e11d48', 'stroke-width': 2 }, parent);
    (s as SVGElement).style.opacity = '0';
    anim(s, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], at, 240);
  };
  const poof = (parent: Element, x: number, at: number, size = 1) => {
    const w = 72 * size;
    const h = 58 * size;
    const g = spawn('g', {}, parent) as SVGGElement;
    el('image', { href: BATTLE_ART.poof.href, x: x - w / 2, y: GROUND - 40 * size - h / 2, width: w, height: h }, g);
    g.style.opacity = '0';
    g.style.transformBox = 'fill-box';
    g.style.transformOrigin = 'center';
    anim(
      g,
      [
        { opacity: 0, transform: 'scale(.3)' },
        { opacity: 1, transform: 'scale(1.05)', offset: 0.3 },
        { opacity: 1, transform: 'scale(1.15)', offset: 0.6 },
        { opacity: 0, transform: 'scale(1.35) translateY(-8px)' },
      ],
      at,
      450,
      { easing: 'ease-out' }
    );
  };
  /** After death: the standing sprite, faded, with ×, as the armies view shows dead troops. */
  const deadMark = (parent: Element, t: TroopHandle, at: number) => {
    hide(t.layers.get(t.current)!, at);
    const g = spawn('g', {}, parent) as SVGGElement;
    const ghost = el('g', { transform: t.dir > 0 ? `translate(${2 * t.x},0) scale(-1,1)` : '', opacity: 0.4 }, g);
    // Re-draw the base pose in the ghost — cheap: reuse the same layer node
    // would move it, so clone its inner content.
    const src = t.layers.get(t.kind === 'robber' ? 'robber' : t.kind)!;
    ghost.appendChild(src.cloneNode(true));
    (ghost.firstElementChild as SVGElement).style.opacity = '1';
    const x = el('text', { x: t.x, y: GROUND - 40, 'text-anchor': 'middle', class: 'result', fill: '#fff', 'font-size': 30 }, g) as SVGTextElement;
    x.textContent = '×';
    x.setAttribute('paint-order', 'stroke');
    x.setAttribute('stroke', '#111');
    x.setAttribute('stroke-width', '4');
    g.style.opacity = '0';
    show(g, at, 150);
  };
  const resultLabel = (parent: Element, at: number, str: string, color: string) => {
    const t = spawn('text', { x: scene.cx, y: H - 10, 'text-anchor': 'middle', fill: color, 'font-size': 15, 'font-weight': 700 }, parent) as SVGTextElement;
    t.textContent = str;
    t.setAttribute('paint-order', 'stroke');
    t.setAttribute('stroke', '#111');
    t.setAttribute('stroke-width', '4');
    t.style.opacity = '0';
    show(t, at, 120);
  };

  // ---- the fight beats ----
  const react = (parent: Element, def: TroopHandle, at: number, outcome: 'kill' | 'injure') => {
    if (outcome === 'kill') {
      const pose = def.kind.startsWith('cannon') ? 'cannonWreck'
        : def.kind === 'robber' ? 'robberStabbed'
        : def.kind === 'injured' ? 'injuredStabbed'
        : 'stabbed';
      setPose(def, pose, at);
      track(def, [[at, 0], [at + 300, -def.dir * 10]], 'ease-out');
      poof(parent, def.x - def.dir * 10, at + 400, def.kind.startsWith('cannon') ? 1.4 : 1);
      if (def.kind === 'robber') hide(def.layers.get(def.current)!, at + 520);
      else deadMark(parent, def, at + 550);
    } else {
      setPose(def, 'stunned', at);
      anim(
        def.outer,
        [0, -4, 4, -3, 2, 0].map((d) => ({ transform: `translateX(${d}px)` })),
        at,
        380,
        { composite: 'add' }
      );
      setPose(def, 'injured', at + 400);
    }
  };

  /**
   * Melee strike. Returns the impact time.
   *  - thrust: drop into the stab stance and coil back (0–420), then lunge
   *    fast (420–560, impact at 560); hold, stand at 900, walk back to 1250.
   *  - slash / robber staff: walk up in the standing pose (0–420), strike
   *    (impact at 500), stand at 760, walk back to 1150.
   */
  const melee = (parent: Element, atk: TroopHandle, def: TroopHandle, t0: number, outcome: 'kill' | 'injure', strike: string) => {
    // Stop where the weapon tip just reaches the defender's front.
    const lead = POSES[strike].ax * K;
    const reach = def.x - atk.x - atk.dir * (lead + 6);
    let impact: number;
    if (strike === 'thrust') {
      impact = t0 + 560;
      setPose(atk, 'thrust', t0 + 120);
      track(atk, [
        [t0, 0], [t0 + 120, 0], [t0 + 420, -atk.dir * 10],
        [impact, reach], [t0 + 900, reach],
        ...walk(t0 + 900, t0 + 1250, reach, 0).slice(1),
      ]);
      setPose(atk, atk.kind, t0 + 900);
    } else {
      impact = t0 + 500;
      track(atk, [...walk(t0, t0 + 420, 0, reach), [t0 + 760, reach], ...walk(t0 + 760, t0 + 1150, reach, 0).slice(1)]);
      setPose(atk, strike, t0 + 420);
      setPose(atk, atk.kind, t0 + 760);
    }
    hitSpark(parent, def.x - def.dir * 6, GROUND - 60, impact);
    react(parent, def, impact, outcome);
    return impact;
  };

  /** Stationed cannon fires: firing pose 250–750 with recoil; ball lands ~500. */
  const fire = (parent: Element, can: TroopHandle, def: TroopHandle, t0: number, outcome: 'kill' | 'injure' | 'miss') => {
    setPose(can, 'cannonFire', t0 + 200);
    anim(
      can.outer,
      [{ transform: 'translateX(0)' }, { transform: `translateX(${-can.dir * 8}px)`, offset: 0.25 }, { transform: 'translateX(0)' }],
      t0 + 220,
      400,
      { composite: 'add' }
    );
    setPose(can, can.kind, t0 + 800);
    const mx = can.x + can.dir * 78;
    const my = GROUND - 56;
    const miss = outcome === 'miss';
    // A miss lands short: on the cannon's side of the target.
    const ex = miss ? def.x + def.dir * 70 : def.x;
    const ey = miss ? GROUND - 4 : GROUND - 55;
    const ball = spawn('circle', { r: 6, fill: '#222', stroke: '#000' }, parent) as SVGCircleElement;
    ball.style.opacity = '0';
    anim(
      ball,
      [
        { transform: `translate(${mx}px,${my}px)`, opacity: 0 },
        { transform: `translate(${mx}px,${my}px)`, opacity: 1, offset: 0.02 },
        { transform: `translate(${(mx + ex) / 2}px,${Math.min(my, ey) - 26}px)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${ex}px,${ey}px)`, opacity: 1, offset: 0.97 },
        { transform: `translate(${ex}px,${ey}px)`, opacity: 0 },
      ],
      t0 + 240,
      220,
      { easing: 'linear' }
    );
    if (miss) poof(parent, ex, t0 + 460, 0.45);
    else {
      hitSpark(parent, ex, ey, t0 + 460);
      react(parent, def, t0 + 460, outcome);
    }
  };

  /** Unstationed cannon wins: rolls back out of the arena; nobody is hurt. */
  const flee = (can: TroopHandle, t0: number) => {
    anim(
      can.outer,
      [
        { transform: 'translateX(0)', opacity: 1 },
        { transform: `translateX(${-can.dir * 6}px) translateY(-3px)`, offset: 0.12 },
        { transform: `translateX(${-can.dir * 150}px)`, opacity: 0 },
      ],
      t0 + 200,
      900,
      { easing: 'ease-in' }
    );
  };

  // ---- build each fight ----
  const multi = fights.length > 1;
  const single = fights.length === 1;

  // Troop handles are bound from the refs the React layer reported.
  const troops = troopsIn(svg, scene.cx);

  fights.forEach((f, i) => {
    const row = multi ? svg.querySelector<SVGGElement>(`[data-row="${i}"]`)! : svg;
    const a = troops.get(`${i}-a`)!;
    const d = troops.get(`${i}-d`)!;
    // Sequential (map): each pair walks in from its side, fights, then the
    // next pair steps forward. Overlay: the demo's 250ms stagger.
    const t0 = scene.sequential ? i * 1750 : i * 250;
    const severity = (side: 'a' | 'd') =>
      (side === 'a' ? f.outcome === 'killAttacker' : f.outcome === 'killDefender')
        ? ('kill' as const)
        : ('injure' as const);

    const tF = t0;

    if (f.outcome === 'draw') {
      const b = spawn('g', {}, row);
      el('rect', { x: scene.cx - 110, y: 60, width: 220, height: 44, rx: 10, fill: '#111827', stroke: '#9ca3af' }, b);
      const t = el('text', { x: scene.cx, y: 88, 'text-anchor': 'middle', fill: '#e5e7eb', 'font-size': 15, 'font-weight': 700 }, b) as SVGTextElement;
      t.textContent = 'Battle ends: draw';
      t.setAttribute('paint-order', 'stroke');
      t.setAttribute('stroke', '#111');
      t.setAttribute('stroke-width', '4');
      b.style.opacity = '0';
      anim(b, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], t0 + 300, 300);
      return;
    }
    if (f.outcome === 'flee') {
      const can = a.kind === 'cannonUnstationed' ? a : d;
      flee(can, tF);
      if (single) resultLabel(row, tF + 1200, 'Cannon fled', '#7dd3fc');
      return;
    }
    if (f.outcome === 'escape') {
      // Attacker thrusts at air; the injured defender scuttles away.
      const reach = d.x - a.x - (POSES.thrust.ax * K + 6);
      setPose(a, 'thrust', tF + 120);
      track(a, [
        [tF, 0], [tF + 120, 0], [tF + 420, -a.dir * 10],
        [tF + 560, reach], [tF + 900, reach],
        ...walk(tF + 900, tF + 1250, reach, 0).slice(1),
      ]);
      setPose(a, a.kind, tF + 900);
      anim(
        d.outer,
        [
          { transform: 'translateX(0)' },
          { transform: 'translateX(10px) translateY(-6px)', offset: 0.25 },
          { transform: 'translateX(80px)' },
        ],
        tF + 380,
        450,
        { easing: 'ease-out' }
      );
      if (single) resultLabel(row, tF + 1200, 'Defender escapes', '#7dd3fc');
      return;
    }

    // Who wins: 'miss' is the duel no-hit (the cannon still plays the attacker).
    const atkWins = f.outcome === 'killDefender' || f.outcome === 'injureDefender' || f.outcome === 'miss';
    const atk = atkWins ? a : d;
    const def = atkWins ? d : a;
    const out = f.outcome === 'miss' ? 'miss' : severity(atkWins ? 'd' : 'a');

    let label: string;
    let color = '#f87171';
    if (f.ranged || atk.kind === 'cannonStationed') {
      // Stationed cannon wins: it fires rather than closing to melee.
      fire(row, atk, def, tF, out);
      label = out === 'miss' ? 'Miss' : out === 'kill' ? 'Target killed' : 'Target injured';
      if (out === 'miss') color = '#cbd5e1';
      else if (out === 'injure') color = '#fbbf24';
    } else {
      // Melee: the robber swings its staff; kills read as thrusts, wounds as slashes.
      const strike = atk.kind === 'robber' ? 'robberStrike' : out === 'kill' ? 'thrust' : 'slash';
      const hit = melee(row, atk, def, tF, out === 'miss' ? 'kill' : out, strike);
      label = f.sack ? 'Robber defeated'
        : out === 'kill' ? `${atkWins ? 'Defender' : 'Attacker'} killed`
        : `${atkWins ? 'Defender' : 'Attacker'} injured`;
      if (f.sack) color = '#86efac';
      else if (out === 'injure') color = '#fbbf24';
      if (f.sack) {
        // The sack appears where the robber fell and flies to the victor.
        const sack = spawn('image', { href: BATTLE_ART.sack.href, x: -16, y: -40, width: 32, height: 40 }, row) as SVGImageElement;
        sack.style.opacity = '0';
        anim(
          sack,
          [
            { transform: `translate(${d.x - 10}px,${GROUND}px) scale(.4)`, opacity: 0 },
            { transform: `translate(${d.x - 10}px,${GROUND}px) scale(1)`, opacity: 1, offset: 0.2 },
            { transform: `translate(${d.x - 10}px,${GROUND}px) scale(1)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${(d.x + a.x) / 2}px,${GROUND - 90}px) scale(1)`, opacity: 1, offset: 0.75 },
            { transform: `translate(${a.x}px,${GROUND - 30}px) scale(.6)`, opacity: 0 },
          ],
          hit + 450,
          1100
        );
      }
    }
    if (scene.labels === false) { /* map mode: badges show rolls, × marks show outcomes */ }
    else if (single) resultLabel(row, tF + 1200, label, color);
    else {
      const lbl = spawn('text', { x: scene.labelX ?? scene.cx + 175, y: GROUND - 40, 'text-anchor': scene.labelAnchor ?? 'start', fill: color, 'font-size': 26, 'font-weight': 700 }, row) as SVGTextElement;
      lbl.textContent = `${f.attacker.roll} vs ${f.defender.roll} · ${label}`;
      lbl.setAttribute('paint-order', 'stroke');
      lbl.setAttribute('stroke', '#111');
      lbl.setAttribute('stroke-width', '4');
      lbl.style.opacity = '0';
      show(lbl, tF + 1200, 120);
    }
  });

  flushToggles();
  const timer = window.setTimeout(() => onDone?.(), Math.max(maxEnd + 250, 400));
  return () => {
    window.clearTimeout(timer);
    for (const a of anims) a.cancel();
    for (const n of spawned) n.remove();
  };
}

/** Collect the troop layer refs the render pass placed under data-* hooks. */
function troopsIn(svg: Element, cx: number): Map<string, TroopHandle> {
  const map = new Map<string, TroopHandle>();
  for (const outer of svg.querySelectorAll<SVGGElement>('[data-troop]')) {
    const key = outer.dataset.troop!;
    const x = +outer.dataset.x!;
    const kind = outer.dataset.kind!;
    const layers = new Map<string, SVGGElement>();
    for (const l of outer.querySelectorAll<SVGGElement>('[data-pose]')) layers.set(l.dataset.pose!, l);
    map.set(key, { outer, layers, x, kind, dir: x < cx ? 1 : -1, current: kind });
  }
  return map;
}

// ---------------------------------------------------------------- component

/**
 * One fight row: the clash-line marker plus the pair's pose stacks. Used by
 * both the modal overlay stage (own <svg>) and the in-map layer (fragment
 * inside MiniView). `x0`/`x1` are the pair's fight spots in row coords.
 */
const FightRow: React.FC<{
  f: Fight;
  i: number;
  x0: number;
  x1: number;
  cx: number;
  showLine: boolean;
  showDice: boolean;
  k: number;
  ground: number;
}> = ({ f, i, x0, x1, cx, showLine, showDice, k, ground }) => (
  <>
    {showLine && <line x1={cx} y1={46} x2={cx} y2={ground} stroke="#dc2626" strokeWidth={2} strokeDasharray="6 5" opacity={0.6} />}
    {showDice && <DieBadge x={x0} n={f.attacker.roll} />}
    {showDice && <DieBadge x={x1} n={f.defender.roll} />}
    {(['a', 'd'] as const).map((side) => {
      const t = side === 'a' ? f.attacker : f.defender;
      const x = side === 'a' ? x0 : x1;
      const facingRight = x < cx;
      return (
        <g key={side} data-troop={`${i}-${side}`} data-x={x} data-kind={t.kind}>
          <g transform={facingRight ? `translate(${2 * x},0) scale(-1,1)` : undefined}>
            {[t.kind, ...(TROOP_POSES[t.kind] ?? [])].map((name, j) => (
              <PoseLayer key={name} name={name} color={t.color} x={x} ground={ground} k={k} show={j === 0} />
            ))}
          </g>
        </g>
      );
    })}
  </>
);

/**
 * The stage itself: rows of troop pairs on a shared ground, playing the
 * choreography from `fights`. Pairs are positioned like the demo: attacker
 * left, defender right of the center line.
 */
export const FightStage: React.FC<FightStageProps> = ({ fights, onDone }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const multi = fights.length > 1;
  const sc = multi ? 0.46 : 1;
  // Demo spacing: attacker left, defender right of the center line.
  const AX = 120;
  const DX = 360;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    return playFights(svg, fights, onDone);
    // The fight list is fixed for the stage's mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <rect x={0} y={GROUND - 4} width={W} height={H - GROUND + 4} fill="#35502f" />
      {fights.map((f, i) => {
        const rowY = multi ? 80 + i * 66 : GROUND;
        const inner = (
          <FightRow
            f={f}
            i={i}
            x0={AX}
            x1={DX}
            cx={CX}
            showLine
            showDice={!multi}
            k={K}
            ground={GROUND}
          />
        );
        return multi ? (
          <g key={i} data-row={i} transform={`translate(${W * (1 - sc) / 2},${rowY - GROUND * sc}) scale(${sc})`}>
            {inner}
          </g>
        ) : (
          <g key={i} data-row={i}>
            {inner}
          </g>
        );
      })}
    </svg>
  );
};

/**
 * In-map replay: the same choreography, drawn as world-coords <g> rows inside
 * MiniView. Each row is anchored on the clash line at (`x`, `f.rowY`) — the
 * row the pair actually stood on — and scaled so the soldier figure matches
 * the armies' troop sprites (TROOP_R·SOLDIER_ICON_HEIGHT world px ≙ 125 row
 * units). The caller (BattleModal) hides the paired troops in the armies
 * view for the duration — unpaired troops stay put as the waiting columns.
 *
 * The pair fights in place: ±MAP_GAP row units from the line (a bit wider
 * than the ±CENTER_GAP roll spot so lunges have room). Each troop carries
 * its roll badge overhead; pairs resolve one after another.
 */
export const MapFightLayer: React.FC<{
  fights: Fight[];
  /** Clash-line x in world coords (the vertex). */
  x: number;
  onDone?: () => void;
}> = ({ fights, x, onDone }) => {
  const gRef = useRef<SVGGElement>(null);
  // Figure heights: map troops stand TROOP_R·SOLDIER_ICON_HEIGHT tall; the
  // stage's standing soldier is 110 row units (66 game units × K). Scaling
  // by 110 makes replay soldiers the same size as the armies' troops.
  const k = (TROOP_R * SOLDIER_ICON_HEIGHT) / 110;
  // ~30 world px from the line — twice the roll gap, enough for the lunge.
  const gap = Math.round(30 / k);
  const feetBelowLabel = TROOP_R * (SOLDIER_ICON_HEIGHT - SOLDIER_ICON_LIFT);
  // Roll badge sits over each troop's fight spot, just above the figure's
  // head in row units.
  const badgeCy = GROUND - 150;

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    return playFights(g, fights, onDone, { cx: CX, sequential: true, labels: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <g ref={gRef}>
      {fights.map((f, i) => {
        const feetY = (f.rowY ?? 0) + feetBelowLabel; // label center → feet (see BattleTroop)
        return (
          <g key={i} data-row={i} transform={`translate(${x - CX * k},${feetY - GROUND * k}) scale(${k})`}>
            <FightRow f={f} i={i} x0={CX - gap} x1={CX + gap} cx={CX} showLine={false} showDice={false} k={K} ground={GROUND} />
            <g transform={`translate(${CX - gap},0)`}>
              <DieBadge x={0} n={f.attacker.roll} cy={badgeCy} size={30} font={18} />
            </g>
            <g transform={`translate(${CX + gap},0)`}>
              <DieBadge x={0} n={f.defender.roll} cy={badgeCy} size={30} font={18} />
            </g>
          </g>
        );
      })}
    </g>
  );
};
