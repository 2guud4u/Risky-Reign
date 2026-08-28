import React, { useRef, useState } from 'react';
import { BattleState, SoldierBattleState, activeSoldiersOf, MAX_PER_ROUND } from 'common';
import { useGameRoom } from '../contexts/GameContext';
import { useSocket } from '../contexts/SocketContext';
import MiniView from './SideBar/MiniView';
import { playerColorMap } from '../utils/soldierPlacement';
import { DROP_TARGET_RING_R, DROP_THRESHOLD_FRACTION, PROJ_SIZE } from '../constants';

/**
 * The battle window: a separate full-screen view that opens for ALL players as
 * soon as a battle is in progress. A mini-map of the battle vertex sits in the
 * middle; the two armies are drawn on it on OPPOSITE sides, and as each
 * soldier rolls its die it advances to the center "clash line" and lines up
 * with its die shown. The attacker drives the battle: continue to roll another
 * round while the defender still has troops, or end it once they are wiped out.
 */

// Arena geometry (world units, relative to the battle vertex center).
const SIDE_OFFSET = 62; // distance of each side's formation from the vertex center
const CENTER_GAP = 15; // rolled troops stop this far inside the center clash line
const ROW_H = 34; // vertical spacing between troops in a line
const TROOP_R = 13; // troop circle radius
/** Small soldier dot radius — matches how garrisoned soldiers are drawn in MiniView. */
const SOLDIER_DOT_R = 6;

interface Slot {
  x: number;
  y: number;
  s: SoldierBattleState;
}

/** Horizontal spacing between columns of the waiting line. */
const COL_W = 34;
/** Maximum troops in a single column of the waiting line. */
const SIDE_COL_MAX = 6;

/**
 * Lay out one side's troops. Troops in the fight (rolled, not injured) line up
 * on the center clash line, ordered by roll (highest on top). Troops that have
 * not rolled yet, plus injured troops (out of the fight, Rule 28), sit in a
 * waiting line of vertical columns of up to SIDE_COL_MAX troops (a second
 * column sits just behind the first if there are more); unrolled troops go in
 * the front column so the ones that still need to roll are easy to see and
 * click. The battle window's minimap is enlarged to fit these lines.
 */
function layoutSide(
  center: { x: number; y: number },
  side: SoldierBattleState[],
  isAttacker: boolean,
  phase: string
): Slot[] {
  const sign = isAttacker ? -1 : 1;
  // In the fight: rolled and not (effectively) dead/injured. During
  // 'betweenRounds' this round's casualties are still pending, so every troop
  // that just rolled stays on the clash line showing its die until continue.
  const inFight = side.filter(
    (s) => s.rollNum !== null && !effInjured(s, phase) && !effDead(s, phase)
  );
  const rolled = [...inFight].sort((a, b) => (b.rollNum ?? 0) - (a.rollNum ?? 0));
  // Out of the fight: not yet rolled, plus committed casualties. Unrolled
  // troops sort first so the ones that still need to roll are easy to see.
  const outOfFight = side
    .filter((s) => s.rollNum === null || effInjured(s, phase) || effDead(s, phase))
    .sort(
      (a, b) =>
        Number(effInjured(a, phase)) - Number(effInjured(b, phase)) ||
        Number(effDead(a, phase)) - Number(effDead(b, phase))
    ); // unrolled first

  const slots: Slot[] = [];
  const nCols = Math.max(1, Math.ceil(outOfFight.length / SIDE_COL_MAX));
  outOfFight.forEach((s, i) => {
    const col = Math.floor(i / SIDE_COL_MAX); // front col = 0 (nearest center)
    const row = i % SIDE_COL_MAX;
    // Front column sits closest to the center; deeper columns sit further out.
    const depthOffset = (col - (nCols - 1) / 2) * COL_W;
    slots.push({
      x: center.x + sign * (SIDE_OFFSET + sign * depthOffset),
      y: center.y + (row - (SIDE_COL_MAX - 1) / 2) * ROW_H,
      s,
    });
  });
  rolled.forEach((s, i) => {
    slots.push({
      x: center.x + sign * CENTER_GAP,
      y: center.y + (i - (rolled.length - 1) / 2) * ROW_H,
      s,
    });
  });
  return slots;
}

/**
 * Whether a troop's casualties are still "pending" in the UI: during
 * 'betweenRounds', this round's results (dead/injured flags) are not shown
 * until the attacker clicks "continue battle". Only troops that actually
 * rolled this round (rollNum set) are affected; prior-round casualties and
 * reserves keep their committed state.
 */
const isPending = (s: SoldierBattleState, phase: string): boolean =>
  phase === 'betweenRounds' && s.rollNum !== null;

/** Effective dead/injured flags for display, hiding pending casualties. */
const effDead = (s: SoldierBattleState, phase: string): boolean => !isPending(s, phase) && s.dead;
const effInjured = (s: SoldierBattleState, phase: string): boolean =>
  !isPending(s, phase) && s.injured;

const troopFill = (s: SoldierBattleState, colors: Record<string, string>, phase: string): string => {
  if (effDead(s, phase)) return '#b91c1c';
  if (effInjured(s, phase)) return '#d97706';
  return colors[s.soldier.owner] ?? '#888';
};

const BattleModal: React.FC = () => {
  const { gameRoom, currentPlayer, setSelectedObject } = useGameRoom();
  const { rollBattleDie, continueBattle, endBattle, exitBattle, repositionSoldier } = useSocket();

  // Hooks must run unconditionally, before the early return below.
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{
    soldierId: string;
    ownerName: string;
    fromVertexId: string;
    validTargets: string[];
  } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const battle = gameRoom?.battleState ?? null;
  const board = gameRoom?.board ?? null;
  if (!gameRoom || !battle || !board) return null;

  const vertex = board.vertices[battle.vertexId];
  const center = vertex ? vertex.position : { x: 0, y: 0 };
  const colors = playerColorMap(gameRoom);

  const attackerSide = battle.states[battle.attacker] ?? { soldiers: [] };
  const defenderSide =
    battle.defender && battle.states[battle.defender] ? battle.states[battle.defender] : { soldiers: [] };

  const phase = battle.phase;

  const handleRoll = (soldierId: string) => {
    if (!currentPlayer || phase !== 'rolling') return;
    const committed = Object.values(battle.states).some((side) =>
      side.soldiers.some((s) => s.soldier.id === soldierId)
    );
    if (!committed) return;
    rollBattleDie(currentPlayer.id, soldierId, gameRoom.id);
  };

  // A soldier can roll only if it is in the active front line (first
  // MAX_PER_ROUND standing troops on its side), owned by the current player,
  // alive, uninjured, and not yet rolled this round.
  const isActive = (s: SoldierBattleState): boolean => {
    const sideName = Object.keys(battle.states).find(
      (name) => battle.states[name].soldiers.includes(s)
    );
    if (!sideName) return false;
    return activeSoldiersOf(battle.states, sideName).includes(s);
  };

  const canRoll = (s: SoldierBattleState): boolean =>
    phase === 'rolling' &&
    currentPlayer?.name === s.soldier.owner &&
    !s.dead &&
    !s.injured &&
    s.rollNum === null &&
    isActive(s);

  const canContinue =
    currentPlayer !== null &&
    battle.attacker === currentPlayer.name &&
    phase === 'betweenRounds';

  const handleContinue = () => {
    if (!currentPlayer) return;
    continueBattle(currentPlayer.id, gameRoom.id);
  };

  // The attacker may end the battle at their choosing after a resolved round.
  const handleEnd = () => {
    if (!currentPlayer) return;
    endBattle(currentPlayer.id, gameRoom.id);
  };

  const handleExit = () => {
    exitBattle(gameRoom.id);
  };

  // ── Repositioning (post-battle): drag injured soldiers to adjacent vertices ──

  // Neighboring vertices reachable from `vertexId` via an existing road.
  const adjacentViaRoad = (vertexId: string): string[] => {
    const v = board.vertices[vertexId];
    if (!v) return [];
    const targets: string[] = [];
    for (const edgeId of v.roadIds) {
      const edge = board.edges[edgeId];
      if (!edge || edge.roadId === null) continue;
      const other = edge.vertexAId === vertexId ? edge.vertexBId : edge.vertexAId;
      if (other !== vertexId) targets.push(other);
    }
    return targets;
  };

  // Injured survivors of this battle, keyed by their current resting vertex
  // (from the repositioning map), so each can be dragged one road-step at a time.
  const injuredTroops = (() => {
    const settled = battle.injuredSettled ?? {};
    const list: { soldierId: string; ownerName: string; vertexId: string }[] = [];
    for (const [soldierId, vertexId] of Object.entries(settled)) {
      const s = board.soldiers[soldierId];
      if (s && s.injured) list.push({ soldierId, ownerName: s.owner, vertexId });
    }
    return list;
  })();

  const startRepositionDrag = (
    e: React.MouseEvent,
    soldierId: string,
    ownerName: string,
    vertexId: string
  ) => {
    // Only the owner may reposition their own injured troops.
    if (currentPlayer?.name !== ownerName) return;
    e.stopPropagation();
    setDrag({ soldierId, ownerName, fromVertexId: vertexId, validTargets: adjacentViaRoad(vertexId) });
  };

  // Map a mouse event to the mini-map SVG's world coordinates.
  const toMiniSvgCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const handleMiniMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drag) return;
    setMousePos(toMiniSvgCoords(e));
  };

  const handleMiniMouseUp = () => {
    if (!drag || !mousePos || !currentPlayer) {
      setDrag(null);
      setMousePos(null);
      return;
    }
    // Drop on the nearest valid target vertex within reach.
    let best: string | null = null;
    let bestDist = Infinity;
    for (const tid of drag.validTargets) {
      const v = board.vertices[tid];
      if (!v) continue;
      const d = Math.hypot(v.position.x - mousePos.x, v.position.y - mousePos.y);
      if (d < bestDist) {
        bestDist = d;
        best = tid;
      }
    }
    const threshold = PROJ_SIZE * DROP_THRESHOLD_FRACTION;
    if (best && bestDist <= threshold) {
      repositionSoldier(currentPlayer.id, drag.soldierId, best, gameRoom.id);
    }
    setDrag(null);
    setMousePos(null);
  };

  const handleMiniMouseLeave = () => {
    setDrag(null);
    setMousePos(null);
  };

  // A side is "still in the fight" only while it has a living, uninjured troop
  // (injured troops are out of the fight, Rule 28).
  const defenderAlive = defenderSide.soldiers.some((s) => !s.dead && !s.injured);
  const attackerAlive = attackerSide.soldiers.some((s) => !s.dead && !s.injured);

  /** Battle outcome summary for the finished / repositioning phases. */
  const outcome = (() => {
    if (phase !== 'finished' && phase !== 'repositioning') return null;
    const atkAlive = attackerSide.soldiers.filter((s) => !s.dead && !s.injured).length;
    const defAlive = defenderSide.soldiers.filter((s) => !s.dead && !s.injured).length;
    const atkDead = attackerSide.soldiers.filter((s) => s.dead).length;
    const defDead = defenderSide.soldiers.filter((s) => s.dead).length;
    const atkInj = attackerSide.soldiers.filter((s) => s.injured && !s.dead).length;
    const defInj = defenderSide.soldiers.filter((s) => s.injured && !s.dead).length;
    const winner =
      atkAlive > 0 ? battle.attacker : defAlive > 0 ? (battle.defender || 'defender') : null;
    return { atkAlive, defAlive, atkDead, defDead, atkInj, defInj, winner };
  })();

  /** Draw one troop (circle + die value), clickable if it is mine to roll. */
  const renderTroop = (slot: Slot, key: string) => {
    const { x, y, s } = slot;
    const mine = canRoll(s);
    // During 'betweenRounds', this round's casualties are not shown yet — the
    // troop keeps its healthy look and die until "continue battle" is clicked.
    const dead = effDead(s, phase);
    const injured = effInjured(s, phase);
    const active = !dead && !injured && (isPending(s, phase) || isActive(s));
    const opacity = dead ? 0.4 : injured ? 0.7 : active ? 1 : 0.45;
    // Injured troops are out of the fight (Rule 28): they show "hurt", not a
    // roll. Reserves (beyond the front line) are dimmed and show "res".
    let label: React.ReactNode = '·';
    let labelSize = 10;
    if (dead) {
      label = '×';
    } else if (injured) {
      label = 'hurt';
      labelSize = 8;
    } else if (!active) {
      label = 'res';
      labelSize = 8;
    } else if (s.rollNum !== null) {
      label = s.rollNum;
      labelSize = 13;
    } else if (mine) {
      label = '🎲';
    }
    return (
      <g
        key={key}
        opacity={opacity}
        style={{ cursor: mine ? 'pointer' : undefined }}
        onClick={mine ? () => handleRoll(s.soldier.id) : undefined}
      >
        <circle
          cx={x}
          cy={y}
          r={TROOP_R}
          fill={troopFill(s, colors, phase)}
          stroke={mine ? '#facc15' : '#fff'}
          strokeWidth={mine ? 3 : 1.5}
        />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={labelSize}
          fontWeight="bold"
          pointerEvents="none"
        >
          {label}
        </text>
      </g>
    );
  };

  // During 'betweenRounds' this round's casualties are hidden (pending), so
  // every troop that rolled is still on the clash line.
  const attackerSlots = layoutSide(center, attackerSide.soldiers, true, phase);
  const defenderSlots = layoutSide(center, defenderSide.soldiers, false, phase);
  // The clash line spans only the troops in the fight (at most MAX_PER_ROUND
  // per side), not the waiting side line.
  const atkInFight = attackerSide.soldiers.filter(
    (s) => s.rollNum !== null && !effInjured(s, phase) && !effDead(s, phase)
  ).length;
  const defInFight = defenderSide.soldiers.filter(
    (s) => s.rollNum !== null && !effInjured(s, phase) && !effDead(s, phase)
  ).length;
  const troopSpread = Math.max(atkInFight, defInFight, 2) * ROW_H;

  // Who still needs to roll this round (by real owner). Only counts troops in
  // the active front line — reserves beyond MAX_PER_ROUND don't roll yet.
  const waitingLines: string[] = [];
  if (phase === 'rolling') {
    const owners = new Set<string>();
    for (const side of Object.values(battle.states)) {
      for (const s of side.soldiers) owners.add(s.soldier.owner);
    }
    for (const name of owners) {
      let n = 0;
      for (const sideName of Object.keys(battle.states)) {
        for (const s of activeSoldiersOf(battle.states, sideName)) {
          if (s.soldier.owner === name && s.rollNum === null) n++;
        }
      }
      if (n > 0) waitingLines.push(`${name} to roll ${n} die${n > 1 ? 's' : ''}`);
    }
  }

  // Matched-up dice for the just-resolved round (highest vs highest, ...).
  const matchup: { a: number; d: number; text: string; cls: string }[] = [];
  if (phase === 'betweenRounds' || phase === 'finished') {
    // Only troops that actually rolled this round and are still in the fight
    // appear in the comparison. In 'betweenRounds' the casualties of this
    // round are still pending, so every troop with a die is compared; once
    // committed (after continue) injured/dead troops drop out of the list.
    const aList = attackerSide.soldiers
      .filter((s) => s.rollNum !== null && !effInjured(s, phase))
      .sort((x, y) => (y.rollNum ?? 0) - (x.rollNum ?? 0));
    const dList = defenderSide.soldiers
      .filter((s) => s.rollNum !== null && !effInjured(s, phase))
      .sort((x, y) => (y.rollNum ?? 0) - (x.rollNum ?? 0));
    for (let i = 0; i < Math.min(aList.length, dList.length); i++) {
      const ar = aList[i].rollNum ?? 0;
      const dr = dList[i].rollNum ?? 0;
      let text: string;
      let cls: string;
      if (ar > dr) {
        [text, cls] = ar - dr >= 2 ? [`${dr} killed`, 'text-red-600'] : [`${dr} injured`, 'text-amber-600'];
      } else if (dr > ar) {
        [text, cls] = dr - ar >= 2 ? [`${ar} killed`, 'text-red-600'] : [`${ar} injured`, 'text-amber-600'];
      } else {
        [text, cls] = ['tie', 'text-gray-500'];
      }
      matchup.push({ a: ar, d: dr, text, cls });
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-5 flex flex-col gap-3 max-h-[94vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="m-0 text-xl font-bold">⚔ Battle</h2>
          <span className="text-[13px] text-gray-500">Round {battle.round}</span>
        </div>

        {/* The battle arena: the vertex mini-map with both armies on it. In the
            repositioning phase it instead shows each player's injured troops so
            they can be dragged along a road to a neighboring vertex. */}
        {vertex && (
          <MiniView
            board={board}
            type="vertex"
            id={battle.vertexId}
            playerColors={colors}
            showGarrisonedSoldiers={false}
            svgRef={svgRef}
            onMouseMove={handleMiniMouseMove}
            onMouseUp={handleMiniMouseUp}
            onMouseLeave={handleMiniMouseLeave}
            pixelSize={400}
            minViewSize={300}
          >
            {phase === 'repositioning' ? (
              /* ── Repositioning overlay: draggable injured troops ── */
              <>
                {/* Drop-target highlights for the active drag. */}
                {drag &&
                  drag.validTargets.map((tid) => {
                    const v = board.vertices[tid];
                    if (!v) return null;
                    return (
                      <circle
                        key={`t-${tid}`}
                        cx={v.position.x}
                        cy={v.position.y}
                        r={DROP_TARGET_RING_R}
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth={3}
                        strokeDasharray="4,3"
                      />
                    );
                  })}

                {/* Injured troops at their current resting vertex. Troops sharing
                    a vertex are fanned out on a small ring so each is visible
                    and individually draggable. */}
                {(() => {
                  const byVertex = new Map<string, typeof injuredTroops>();
                  for (const t of injuredTroops) {
                    const arr = byVertex.get(t.vertexId) ?? [];
                    arr.push(t);
                    byVertex.set(t.vertexId, arr);
                  }
                  const RING_R = SOLDIER_DOT_R * 1.9;
                  const out: React.ReactNode[] = [];
                  byVertex.forEach((troops, vertexId) => {
                    const v = board.vertices[vertexId];
                    if (!v) return;
                    const n = troops.length;
                    troops.forEach((t, k) => {
                      const angle = n === 1 ? 0 : (k / n) * Math.PI * 2 - Math.PI / 2;
                      const cx = v.position.x + (n === 1 ? 0 : Math.cos(angle) * RING_R);
                      const cy = v.position.y + (n === 1 ? 0 : Math.sin(angle) * RING_R);
                      const mine = currentPlayer?.name === t.ownerName;
                      out.push(
                        <circle
                          key={`i-${t.soldierId}`}
                          cx={cx}
                          cy={cy}
                          r={SOLDIER_DOT_R}
                          fill={colors[t.ownerName] ?? '#888'}
                          stroke={mine ? '#facc15' : '#dc2626'}
                          strokeWidth={mine ? 2.5 : 1.5}
                          style={{ cursor: mine ? 'grab' : 'default' }}
                          onMouseDown={
                            mine
                              ? (e) => startRepositionDrag(e, t.soldierId, t.ownerName, t.vertexId)
                              : undefined
                          }
                        />
                      );
                    });
                  });
                  return out;
                })()}

                {/* Drag ghost following the cursor. */}
                {drag && mousePos && (
                  <circle
                    cx={mousePos.x}
                    cy={mousePos.y}
                    r={SOLDIER_DOT_R}
                    fill={colors[drag.ownerName] ?? '#888'}
                    opacity={0.6}
                    stroke="#222"
                    strokeWidth={1.5}
                    pointerEvents="none"
                  />
                )}
              </>
            ) : (
              <>
                {/* Center clash line. */}
                <line
                  x1={center.x}
                  y1={center.y - troopSpread / 2}
                  x2={center.x}
                  y2={center.y + troopSpread / 2}
                  stroke="#dc2626"
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  opacity={0.6}
                />
                {/* Attacker's army (left) and defender's army (right). */}
                {attackerSlots.map((slot, i) => renderTroop(slot, `a-${i}`))}
                {defenderSlots.map((slot, i) => renderTroop(slot, `d-${i}`))}
              </>
            )}
          </MiniView>
        )}

        <button
          type="button"
          className="text-left text-[13px] hover:underline cursor-pointer"
          onClick={() => setSelectedObject({ type: 'vertex', id: battle.vertexId })}
          title="Show the battle location on the board"
        >
          ⚔ <strong>{battle.attacker}</strong> vs <strong>{battle.defender || 'defender'}</strong> at{' '}
          vertex {battle.vertexId} — click to view on the board
        </button>

        {/* Rolling phase: players roll their own dice, one per troop. */}
        {phase === 'rolling' && (
          <div className="text-[13px] text-gray-600 bg-amber-50 border border-amber-200 rounded-md p-2">
            Click your troops to roll — one die each. Rolled troops advance to
            the center line. Highest rolls fight highest rolls.
            {waitingLines.length > 0 && (
              <div className="text-gray-500 mt-1">Waiting: {waitingLines.join(' · ')}</div>
            )}
          </div>
        )}

        {/* Between rounds / finished: show how the dice compared. */}
        {(phase === 'betweenRounds' || phase === 'finished') && (
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="text-[13px] font-semibold mb-1.5">
              Round {battle.round} — dice compared (highest vs highest)
            </div>
            {matchup.length === 0 ? (
              <div className="text-gray-400 text-xs">No dice were compared</div>
            ) : (
              <div className="flex flex-col gap-1">
                {matchup.map((m, i) => (
                  <div key={i} className="text-xs flex items-center gap-2">
                    <span className="font-mono">{m.a}</span>
                    <span className="text-gray-500">vs</span>
                    <span className="font-mono">{m.d}</span>
                    <span className={`ml-1 ${m.cls}`}>→ {m.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Battle over: show the outcome and let players exit. In the
            repositioning phase the window stays open so owners can drag their
            injured troops to a neighboring vertex (or leave them in place). */}
        {(phase === 'repositioning' || phase === 'finished') && outcome && (
          <div className="border border-gray-300 rounded-lg p-3 flex flex-col gap-2">
            <div className="text-[14px] font-semibold">
              {outcome.winner
                ? `🏆 ${outcome.winner} wins the battle!`
                : 'The battle is a draw.'}
            </div>
            <div className="text-[12px] text-gray-600">
              {battle.attacker}: {outcome.atkAlive} standing, {outcome.atkDead} killed,{' '}
              {outcome.atkInj} injured
            </div>
            <div className="text-[12px] text-gray-600">
              {battle.defender || 'Defender'}: {outcome.defAlive} standing, {outcome.defDead} killed,{' '}
              {outcome.defInj} injured
            </div>

            {phase === 'repositioning' && (
              <div className="text-[12px] text-gray-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                {injuredTroops.length > 0 ? (
                  <>
                    <strong>Drag your injured troops</strong> (the yellow-ringed
                    circles) to a neighboring vertex connected by a road to settle
                    them. Any you leave stay put. When you're done, exit the battle.
                  </>
                ) : (
                  <span>
                    No injured troops to reposition. You can exit the battle now.
                  </span>
                )}
              </div>
            )}

            {phase === 'finished' && (
              <div className="text-[11px] text-gray-400">
                Healthy troops stay where the fight ended.
              </div>
            )}

            <button
              type="button"
              onClick={handleExit}
              className="w-full bg-gray-800 text-white rounded-md py-2 text-sm font-semibold hover:bg-gray-900"
            >
              {phase === 'repositioning' ? 'Done — Exit Battle' : 'Exit Battle'}
            </button>
          </div>
        )}

        {/* Between rounds only: let the attacker continue or end at their choosing. */}
        {phase === 'betweenRounds' &&
          (canContinue ? (
            <div className="flex flex-col gap-2">
              {attackerAlive && defenderAlive ? (
                <>
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="w-full bg-red-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-red-700"
                  >
                    Continue Battle (round {battle.round + 1})
                  </button>
                  <button
                    type="button"
                    onClick={handleEnd}
                    className="w-full bg-gray-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-gray-700"
                  >
                    End Battle Now
                  </button>
                  <div className="text-[12px] text-gray-500 text-center">
                    You can keep attacking while you have troops left, or end the battle now.
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleEnd}
                  className="w-full bg-red-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-red-700"
                >
                  End Battle — a side is defeated
                </button>
              )}
            </div>
          ) : (
            <div className="text-[13px] text-gray-500">
              {currentPlayer && battle.attacker !== currentPlayer.name
                ? `Waiting for ${battle.attacker} to continue or end the battle...`
                : 'Battle in progress...'}
            </div>
          ))}
      </div>
    </div>
  );
};

export default BattleModal;
