/**
 * Regression tests for the piece rules (cannons, walls, ships, capture
 * spread, board freeze). Each test drives the real action tables headless on
 * a fresh room with the default board and only the pieces it needs placed by
 * hand, so a case isolates one rule.
 * Run with: node --test test/pieces.unit.test.mjs (after `npm run build`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "catan-pieces-"));

const store = await import("../dist/store.js");
const common = await import("common");
const { SOLDIER_ACTIONS } = await import("../dist/actions/soldier.js");
const { PIECE_ACTIONS } = await import("../dist/actions/pieces.js");
const { TURN_ACTIONS } = await import("../dist/actions/turn.js");
const { BUILD_ACTIONS } = await import("../dist/actions/build.js");
const { BATTLE_ACTIONS } = await import("../dist/actions/battle.js");
const { DEVCARD_ACTIONS } = await import("../dist/actions/devCards.js");
const { advanceTurn } = await import("../dist/turn.js");
const { migrate } = await import("../dist/persistence/gameSnapshot.js");

const ACTIONS = {
  ...SOLDIER_ACTIONS,
  ...PIECE_ACTIONS,
  ...TURN_ACTIONS,
  ...BUILD_ACTIONS,
  ...BATTLE_ACTIONS,
  ...DEVCARD_ACTIONS,
};

// ── fixtures ────────────────────────────────────────────────────────────
let roomSeq = 0;
function freshRoom() {
  const room = store.createGameRoom(`P${++roomSeq}`, "A");
  for (const name of ["A", "B", "C"]) {
    room.players.push({
      id: `sock-${name}`,
      name,
      color: "#e11",
      token: `t-${name}`,
      resources: { Wood: 9, Brick: 9, Sheep: 9, Wheat: 9, Ore: 9 },
      victoryPoints: 0,
      eliminated: false,
      connected: true,
      developmentCards: [],
      freeRoadsLeft: 0,
      devCardsBoughtThisTurn: 0,
    });
  }
  room.turnState.playerOrder = ["A", "B", "C"];
  room.gameStatus = "playing";
  room.roll = { die1: 3, die2: 4 };
  phase(room, "Action", "A");
  return room;
}
function phase(room, p, who = "A") {
  room.turnState.phase = p;
  room.turnState.player = who;
}
const P = (room, name) => room.players.find((p) => p.name === name);
function run(room, action, who, payload = {}) {
  return (
    ACTIONS[action].run(
      room,
      P(room, who),
      { roomId: room.id, ...payload },
      `sock-${who}`,
    ) ?? {}
  );
}
let idSeq = 0;
const nid = (p) => `${p}_${++idSeq}`;
function soldier(room, owner, vertexId, extra = {}) {
  const id = nid("s");
  room.board.soldiers[id] = {
    id,
    owner,
    injured: false,
    vertexId,
    type: "infantry",
    stationed: false,
    aboardShipId: null,
    ...extra,
  };
  return room.board.soldiers[id];
}
function settlement(room, owner, vertexId) {
  const id = nid("st");
  room.board.settlements[id] = {
    id,
    vertexId,
    ownerId: owner,
    level: "settlement",
    builtAt: 0,
  };
  room.board.vertices[vertexId].settlementId = id;
  return room.board.settlements[id];
}
function road(room, owner, a, b, isWall = false) {
  const edge = edgeBetween(room, a, b);
  const id = nid("r");
  room.board.roads[id] = {
    id,
    edgeId: edge.id,
    ownerId: owner,
    builtAt: 0,
    isWall,
  };
  edge.roadId = id;
  return room.board.roads[id];
}
function ship(room, owner, vertexId) {
  const id = nid("ship");
  room.board.ships[id] = { id, vertexId, ownerId: owner };
  return room.board.ships[id];
}
const edgeBetween = (room, a, b) =>
  Object.values(room.board.edges).find(
    (e) =>
      (e.vertexAId === a && e.vertexBId === b) ||
      (e.vertexAId === b && e.vertexBId === a),
  );
const neighbors = (room, v) => common.adjacentVertexIds(room.board, v);
/** Force every rollDie() to `v` while fn runs. */
function withRoll(v, fn) {
  const orig = Math.random;
  Math.random = () => (v - 1) / 6 + 0.01;
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}
const vertices = (room, pred) =>
  Object.keys(room.board.vertices).filter((v) => pred(v));
/** An inland vertex whose neighbors are all inland and empty — room for a scenario. */
function inlandPath(room, length) {
  const land = (v) => common.landHexCount(room.board, v) >= 2;
  for (const start of vertices(room, land)) {
    const path = [start];
    while (path.length < length) {
      const next = neighbors(room, path.at(-1)).find(
        (n) => land(n) && !path.includes(n),
      );
      if (!next) break;
      path.push(next);
    }
    if (path.length === length) return path;
  }
  throw new Error("no inland path");
}
/** A coast vertex with an adjacent sea-or-coast vertex (somewhere to sail). */
function coastPair(room) {
  for (const c of vertices(room, (v) => common.isCoastVertex(room.board, v))) {
    const w = neighbors(room, c).find((n) =>
      common.isWaterVertex(room.board, n),
    );
    if (w) return [c, w];
  }
  throw new Error("no coast pair");
}
const snap = (room) =>
  JSON.stringify({
    b: room.board,
    t: room.turnState,
    r: room.players.map((p) => p.resources),
  });

/** A's soldier at path[0] facing B's wall on edge path[0]–path[1]. */
function openGate(room) {
  const [a, b] = inlandPath(room, 2);
  road(room, "B", a, b, true);
  const s = soldier(room, "A", a, { stationed: true });
  assert.equal(
    run(room, "moveSoldier", "A", { soldierId: s.id, targetVertexId: b }).error,
    undefined,
  );
  assert.ok(room.wallGate, "gate should open");
  return { s, a, b };
}

// ── board freeze ────────────────────────────────────────────────────────
test("battle in progress: every piece action is refused, state unchanged", () => {
  const room = freshRoom();
  const [v, w] = inlandPath(room, 2);
  const atk = soldier(room, "A", v);
  soldier(room, "B", v);
  const cannon = soldier(room, "A", w, { type: "cannon", stationed: true });
  const mover = soldier(room, "A", w);
  assert.equal(
    run(room, "startAttack", "A", { soldierIds: [atk.id], targetVertexId: v })
      .error,
    undefined,
  );
  assert.ok(room.battleState);
  const before = snap(room);
  for (const [act, payload] of [
    ["cannonSplash", { soldierId: cannon.id, vertexId: v }],
    ["moveSoldier", { soldierId: mover.id, targetVertexId: v }],
    ["unstationCannon", { soldierId: cannon.id }],
  ]) {
    assert.equal(
      run(room, act, "A", payload).error,
      "A battle is in progress",
      act,
    );
  }
  assert.equal(snap(room), before);
});

test("open wall gate: attack, capture and cannon fire are refused for everyone", () => {
  const room = freshRoom();
  const { s, a } = openGate(room);
  soldier(room, "B", a);
  const cannon = soldier(room, "A", a, { type: "cannon", stationed: true });
  const before = snap(room);
  assert.equal(
    run(room, "startAttack", "A", { soldierIds: [s.id], targetVertexId: a })
      .error,
    "A wall crossing is in progress",
  );
  assert.equal(
    run(room, "cannonSplash", "A", { soldierId: cannon.id, vertexId: a }).error,
    "A wall crossing is in progress",
  );
  assert.equal(snap(room), before);
});

// ── wall gate ───────────────────────────────────────────────────────────
test("wall owner cannot roll before the crosser has guessed", () => {
  const room = freshRoom();
  openGate(room);
  const r = run(room, "rollWallGate", "B");
  assert.equal(r.error, "Wait for the crosser to guess first");
  assert.equal(room.wallGate.roll, null);
});

test("undoing a wall crossing restores the stationed flag", () => {
  const room = freshRoom();
  const { s, a, b } = openGate(room);
  run(room, "wallGuess", "A", { guess: 3 });
  withRoll(3, () => run(room, "rollWallGate", "B"));
  assert.equal(s.vertexId, b);
  assert.equal(s.stationed, false);
  room.wallGate = null; // the reveal timer clears it in play
  assert.equal(run(room, "undoBuild", "A").error, undefined);
  assert.equal(s.vertexId, a);
  assert.equal(s.stationed, true);
});

test("crosser silent: the gate timer guesses for them, then the owner timer rolls", async () => {
  const { syncWallGateTimer } = await import("../dist/wallGateTimer.js");
  const room = freshRoom();
  store.putRoom(room);
  P(room, "A").connected = false; // an absent crosser is answered at once
  const io = { to: () => ({ emit: () => {} }) };
  const { b } = openGate(room);
  // Real players own something, or bonuses would knock them out mid-test.
  settlement(room, "B", b);
  settlement(room, "C", inlandPath(room, 6)[5]);
  syncWallGateTimer(io, room);
  const guess = room.wallGate.guess;
  assert.notEqual(guess, null, "server guessed for the absent crosser");
  P(room, "B").connected = false;
  syncWallGateTimer(io, room);
  assert.ok(room.wallGate, `gate cleared early (guess was ${guess})`);
  assert.notEqual(
    room.wallGate.roll,
    null,
    "server rolled for the absent owner",
  );
});

test("turn timer pauses while a wall gate is open", async () => {
  const { syncPhaseTimer } = await import("../dist/phaseTimer.js");
  const room = freshRoom();
  room.turnTimerMs = 60_000;
  room.phaseTimerEndsAt = Date.now() + 30_000;
  openGate(room);
  syncPhaseTimer({ to: () => ({ emit: () => {} }) }, room);
  assert.equal(room.phaseTimerEndsAt, null);
  assert.ok(
    room.phaseTimerRemainingMs > 25_000 && room.phaseTimerRemainingMs <= 30_000,
  );
});

// ── cannons ─────────────────────────────────────────────────────────────
test("an injured soldier cannot be upgraded to a cannon", () => {
  const room = freshRoom();
  const [v] = inlandPath(room, 1);
  settlement(room, "A", v);
  const s = soldier(room, "A", v, { injured: true });
  assert.equal(
    run(room, "upgradeCannon", "A", { soldierId: s.id }).error,
    "Heal this soldier before upgrading it to a cannon",
  );
  assert.equal(s.type, "infantry");
});

test("splash can hit the cannon’s own vertex; the cannon is immune", () => {
  const room = freshRoom();
  const [v] = inlandPath(room, 1);
  const cannon = soldier(room, "A", v, { type: "cannon", stationed: true });
  const ally = soldier(room, "A", v);
  // Fire opens the pending shot: the board freezes, no dice yet.
  assert.equal(
    run(room, "cannonSplash", "A", { soldierId: cannon.id, vertexId: v }).error,
    undefined,
  );
  assert.equal(ally.injured, false);
  assert.equal(room.cannonShot.chained, true);
  assert.equal(room.cannonShot.cannonRoll, null);
  assert.deepEqual(room.cannonShot.victims.map((x) => x.soldierId), [ally.id]);
  // A owns both the cannon and the victim — A rolls each owed die.
  // Cannon 6 vs victim 6: a tie goes to the cannon → injure.
  withRoll(6, () => run(room, "rollCannonShot", "A", { soldierId: null }));
  assert.equal(ally.injured, false, "victim not resolved before its own roll");
  withRoll(6, () => run(room, "rollCannonShot", "A", { soldierId: ally.id }));
  assert.equal(ally.injured, true);
  assert.ok(room.board.soldiers[cannon.id]);
});

test("a pending ranged shot freezes the board and seats the victim's roll", () => {
  const room = freshRoom();
  const [v, w] = inlandPath(room, 2);
  const cannon = soldier(room, "A", v, { type: "cannon", stationed: true });
  const target = soldier(room, "B", w);
  const bystander = soldier(room, "A", v);
  assert.equal(
    run(room, "cannonAttack", "A", { soldierId: cannon.id, targetSoldierId: target.id }).error,
    undefined,
  );
  // Frozen like a battle: nobody can move while dice are owed.
  assert.equal(
    run(room, "moveSoldier", "A", { soldierId: bystander.id, targetVertexId: w }).error,
    "A cannon shot is in progress",
  );
  // Seats: the victim's die belongs to B, the cannon's to A.
  assert.equal(
    run(room, "rollCannonShot", "A", { soldierId: target.id }).error,
    "Only that soldier’s owner rolls its die",
  );
  withRoll(2, () => run(room, "rollCannonShot", "B", { soldierId: target.id }));
  assert.ok(room.board.soldiers[target.id], "still pending the cannon's roll");
  // Cannon 5 vs target 2: margin 3 ≥ 2 → kill, and the board unfreezes.
  withRoll(5, () => run(room, "rollCannonShot", "A", { soldierId: null }));
  assert.equal(room.cannonShot.victims[0].outcome, "kill");
  assert.equal(room.board.soldiers[target.id], undefined);
  assert.equal(
    run(room, "moveSoldier", "A", { soldierId: bystander.id, targetVertexId: w }).error === "A cannon shot is in progress",
    false,
  );
});

test("cannon shots and wall attacks cannot be undone (nor anything before them)", () => {
  for (const shoot of ["cannonAttack", "cannonSplash", "cannonAttackWall"]) {
    const room = freshRoom();
    const [v, w] = inlandPath(room, 2);
    const cannon = soldier(room, "A", v, { type: "cannon", stationed: true });
    const walker = soldier(room, "A", v);
    const target = soldier(room, "B", w);
    road(room, "B", v, w, true);
    const step = neighbors(room, v).find((n) => n !== w);
    road(room, "A", v, step);
    assert.equal(
      run(room, "moveSoldier", "A", {
        soldierId: walker.id,
        targetVertexId: step,
      }).error,
      undefined,
    );
    assert.equal(room.turnState.undoLog.length, 1);
    const payload =
      shoot === "cannonAttack"
        ? { soldierId: cannon.id, targetSoldierId: target.id }
        : shoot === "cannonSplash"
          ? { soldierId: cannon.id, vertexId: w }
          : { soldierId: cannon.id, edgeId: edgeBetween(room, v, w).id };
    assert.equal(
      withRoll(4, () => run(room, shoot, "A", payload)).error,
      undefined,
      shoot,
    );
    assert.equal(run(room, "undoBuild", "A").error, "Nothing to undo", shoot);
  }
});

test("single wall shot: fire opens a pending shot, the shooter rolls to breach", () => {
  const room = freshRoom();
  const [v, w] = inlandPath(room, 2);
  const cannon = soldier(room, "A", v, { type: "cannon", stationed: true });
  const edge = edgeBetween(room, v, w);
  road(room, "B", v, w, true);
  assert.equal(
    run(room, "cannonAttackWall", "A", { soldierId: cannon.id, edgeId: edge.id }).error,
    undefined,
  );
  // Fire commits the action but doesn't breach — the wall awaits the roll.
  const shot = room.cannonShot;
  assert.equal(shot.kind, "wall");
  assert.equal(shot.roll, null);
  assert.equal(room.board.roads[edge.roadId].isWall, true);
  assert.ok(room.turnState.soldiersActedThisTurn.includes(cannon.id));
  // Someone else can't roll it; the shooter rolls 4+ → wall → road.
  assert.equal(run(room, "rollWallShot", "B").error, "Only the shooter rolls the breach die");
  assert.equal(withRoll(4, () => run(room, "rollWallShot", "A")).error, undefined);
  assert.equal(shot.roll, 4);
  assert.equal(shot.breached, true);
  assert.equal(room.board.roads[edge.roadId].isWall, false);
});

test("single wall shot: a roll below the threshold leaves the wall up", () => {
  const room = freshRoom();
  const [v, w] = inlandPath(room, 2);
  const cannon = soldier(room, "A", v, { type: "cannon", stationed: true });
  const edge = edgeBetween(room, v, w);
  road(room, "B", v, w, true);
  run(room, "cannonAttackWall", "A", { soldierId: cannon.id, edgeId: edge.id });
  assert.equal(withRoll(3, () => run(room, "rollWallShot", "A")).error, undefined);
  assert.equal(room.cannonShot.breached, false);
  assert.equal(room.board.roads[edge.roadId].isWall, true);
});

test("explosive shot breaches on fire — no die, 1 ore spent", () => {
  const room = freshRoom();
  const [v, w] = inlandPath(room, 2);
  const cannon = soldier(room, "A", v, { type: "cannon", stationed: true });
  const edge = edgeBetween(room, v, w);
  road(room, "B", v, w, true);
  assert.equal(
    run(room, "cannonAttackWall", "A", { soldierId: cannon.id, edgeId: edge.id, explosive: true }).error,
    undefined,
  );
  assert.equal(room.board.roads[edge.roadId].isWall, false);
  assert.equal(P(room, "A").resources.Ore, 8);
  assert.equal(room.cannonShot.explosive, true);
  assert.equal(room.cannonShot.breached, true);
  // Nothing left to roll.
  assert.equal(run(room, "rollWallShot", "A").error, "That shot is already resolved");
});

test("explosive shot needs the ore", () => {
  const room = freshRoom();
  const [v, w] = inlandPath(room, 2);
  const cannon = soldier(room, "A", v, { type: "cannon", stationed: true });
  const edge = edgeBetween(room, v, w);
  road(room, "B", v, w, true);
  P(room, "A").resources.Ore = 0;
  assert.equal(
    run(room, "cannonAttackWall", "A", { soldierId: cannon.id, edgeId: edge.id, explosive: true }).error,
    "Not enough ore for an explosive shot",
  );
  assert.equal(room.cannonShot, null);
  assert.equal(room.board.roads[edge.roadId].isWall, true);
});

test("a wall shot freezes the board from fire through the reveal", () => {
  const room = freshRoom();
  const [v, w] = inlandPath(room, 2);
  const cannon = soldier(room, "A", v, { type: "cannon", stationed: true });
  const mover = soldier(room, "A", v);
  const step = neighbors(room, v).find((n) => n !== w);
  road(room, "A", v, step);
  const edge = edgeBetween(room, v, w);
  road(room, "B", v, w, true);
  run(room, "cannonAttackWall", "A", { soldierId: cannon.id, edgeId: edge.id });
  assert.equal(
    run(room, "moveSoldier", "A", { soldierId: mover.id, targetVertexId: step }).error,
    "A wall breach is in progress",
  );
  withRoll(4, () => run(room, "rollWallShot", "A"));
  // The breach stays on the table through its reveal — the board waits it
  // out, same as a wall gate's resolve.
  assert.equal(
    run(room, "moveSoldier", "A", { soldierId: mover.id, targetVertexId: step }).error,
    "A wall breach is in progress",
  );
});

test("shooter silent: the cannon-shot timer rolls the breach die for them", async () => {
  const { syncCannonShotTimer } = await import("../dist/cannonShotTimer.js");
  const room = freshRoom();
  store.putRoom(room);
  const [v, w] = inlandPath(room, 2);
  settlement(room, "B", w);
  settlement(room, "C", inlandPath(room, 6)[5]);
  const cannon = soldier(room, "A", v, { type: "cannon", stationed: true });
  const edge = edgeBetween(room, v, w);
  road(room, "B", v, w, true);
  const io = { to: () => ({ emit: () => {} }) };
  run(room, "cannonAttackWall", "A", { soldierId: cannon.id, edgeId: edge.id });
  P(room, "A").connected = false;
  syncCannonShotTimer(io, room);
  assert.notEqual(room.cannonShot.roll, null, "server rolled for the absent shooter");
});

// ── ships ───────────────────────────────────────────────────────────────
test("every player gets ship steps in their own Action phase", () => {
  const room = freshRoom();
  room.turnMode = { build: "around", action: "around" };
  const [c] = coastPair(room);
  const sh = ship(room, "B", c);
  room.turnState.phase = "Build";
  room.turnState.player = "A";
  room.turnState.offset = 0;
  room.turnState.dicePlayerIndex = 0;
  for (
    let i = 0;
    i < 8 &&
    !(room.turnState.phase === "Action" && room.turnState.player === "B");
    i++
  )
    advanceTurn(room);
  assert.equal(room.turnState.phase, "Action");
  assert.equal(room.turnState.player, "B");
  assert.equal(room.turnState.shipSteps[sh.id], 4); // ceil(7/2)
});

test("boarding: only from the ship’s own vertex; an empty ship is claimed; a crewed foreign ship is refused", () => {
  const room = freshRoom();
  const [c] = coastPair(room);
  const sh = ship(room, "B", c);
  const away = soldier(
    room,
    "A",
    neighbors(room, c).find(
      (n) => common.landHexCount(room.board, n) >= 1 && n !== c,
    ),
  );
  assert.equal(
    run(room, "embarkSoldier", "A", { soldierId: away.id, shipId: sh.id })
      .error,
    "Soldiers board from the ship’s own vertex",
  );
  const here = soldier(room, "A", c, { stationed: true });
  assert.equal(
    run(room, "embarkSoldier", "A", { soldierId: here.id, shipId: sh.id })
      .error,
    undefined,
  );
  assert.equal(sh.ownerId, "A");
  assert.equal(run(room, "undoBuild", "A").error, undefined);
  assert.equal(sh.ownerId, "B");
  assert.equal(here.aboardShipId, null);
  assert.equal(here.stationed, true);
  soldier(room, "B", c, { aboardShipId: sh.id });
  assert.equal(
    run(room, "embarkSoldier", "A", { soldierId: here.id, shipId: sh.id })
      .error,
    "You can’t board another player’s crewed ship",
  );
});

test("landing only on the ship’s own coast vertex", () => {
  const room = freshRoom();
  const [c, w] = coastPair(room);
  const sh = ship(room, "A", c);
  const t = soldier(room, "A", c, { aboardShipId: sh.id });
  assert.equal(
    run(room, "disembarkSoldier", "A", { soldierId: t.id, vertexId: w }).error,
    "Soldiers land on the ship’s own vertex",
  );
  assert.equal(
    run(room, "disembarkSoldier", "A", { soldierId: t.id, vertexId: c }).error,
    undefined,
  );
  assert.equal(t.aboardShipId, null);
});

test("ship may dock over a settlement, but its crew must land to capture or attack", () => {
  const room = freshRoom();
  const [c, w] = coastPair(room);
  settlement(room, "B", c);
  soldier(room, "B", c);
  const sh = ship(room, "A", w);
  const t = soldier(room, "A", w, { aboardShipId: sh.id });
  room.turnState.shipSteps[sh.id] = 2;
  assert.equal(
    run(room, "moveShip", "A", { shipId: sh.id, vertexId: c }).error,
    undefined,
  );
  assert.equal(t.vertexId, c);
  assert.equal(
    run(room, "startAttack", "A", { soldierIds: [t.id], targetVertexId: c })
      .error,
    "Land your troops before attacking",
  );
  assert.equal(
    run(room, "captureSettlement", "A", { soldierId: t.id, vertexId: c }).error,
    "Land your troops before capturing",
  );
});

test("a settlement cannot be built under a ship", () => {
  const room = freshRoom();
  const [c] = coastPair(room);
  ship(room, "B", c);
  const r = common.canBuildSettlementAt(
    room.board,
    { ...room.turnState, phase: "SetUp", placedSettlement: false },
    "A",
    c,
  );
  assert.equal(r.reason, "A ship occupies that vertex");
});

test("a ship settles on its own coast vertex", () => {
  const room = freshRoom();
  phase(room, "Build");
  const [c] = coastPair(room);
  const sh = ship(room, "A", c);
  assert.equal(
    run(room, "convertShipToSettlement", "A", { shipId: sh.id, vertexId: c })
      .error,
    undefined,
  );
  assert.ok(room.board.vertices[c].settlementId);
  assert.equal(room.board.ships[sh.id], undefined);
});

test("undoing a ship move leaves troops that have since left the ship where they are", () => {
  const room = freshRoom();
  const [c, w] = coastPair(room);
  const sh = ship(room, "A", w);
  const t = soldier(room, "A", w, { aboardShipId: sh.id });
  room.turnState.shipSteps[sh.id] = 2;
  run(room, "moveShip", "A", { shipId: sh.id, vertexId: c });
  t.aboardShipId = null; // left the ship (e.g. repositioned after a battle)
  assert.equal(run(room, "undoBuild", "A").error, undefined);
  assert.equal(sh.vertexId, w);
  assert.equal(t.vertexId, c);
});

test("a Knight spawned where your troops are all aboard joins them aboard", () => {
  const room = freshRoom();
  const [c] = coastPair(room);
  const sh = ship(room, "A", c);
  soldier(room, "A", c, { aboardShipId: sh.id });
  P(room, "A").developmentCards = ["knight"];
  room.devCardChoice = {
    player: "A",
    card: "knight",
    cardIndex: 0,
    spawn: true,
  };
  assert.equal(
    run(room, "knightSpawnSoldier", "A", { vertexId: c }).error,
    undefined,
  );
  const spawned = Object.values(room.board.soldiers).filter(
    (s) => s.vertexId === c && s.owner === "A",
  );
  assert.ok(spawned.every((s) => s.aboardShipId === sh.id));
});

test("dev preset stages no soldiers on foot at sea", async () => {
  const { applyDevPreset } = await import("../dist/devPreset.js");
  const room = freshRoom();
  room.board.soldiers = {};
  room.board.settlements = {};
  room.board.roads = {};
  for (const v of Object.values(room.board.vertices)) v.settlementId = null;
  for (const e of Object.values(room.board.edges)) e.roadId = null;
  const log = console.log;
  console.log = () => {};
  applyDevPreset(room);
  console.log = log;
  const atSea = Object.values(room.board.soldiers).filter(
    (s) =>
      s.aboardShipId === null &&
      common.landHexCount(room.board, s.vertexId) === 0,
  );
  assert.deepEqual(atSea, []);
});

// ── capture spread ──────────────────────────────────────────────────────
function captureCase(build) {
  const room = freshRoom();
  const ctx = build(room);
  const s = soldier(room, "A", ctx.captured);
  assert.equal(
    run(room, "captureSettlement", "A", {
      soldierId: s.id,
      vertexId: ctx.captured,
    }).error,
    undefined,
  );
  return ctx;
}

test("capture: a chain to a dead end transfers, walls included", () => {
  const { r1, w, r2 } = captureCase((room) => {
    const [a, b, c, d] = inlandPath(room, 4);
    settlement(room, "B", a);
    return {
      captured: a,
      r1: road(room, "B", a, b),
      w: road(room, "B", b, c, true),
      r2: road(room, "B", c, d),
    };
  });
  assert.deepEqual([r1.ownerId, w.ownerId, r2.ownerId], ["A", "A", "A"]);
  assert.equal(w.isWall, true);
});

test("capture: a chain reaching another player’s building keeps its owners", () => {
  const { r1, w, r2 } = captureCase((room) => {
    const [a, b, c, d] = inlandPath(room, 4);
    settlement(room, "B", a);
    settlement(room, "C", d);
    return {
      captured: a,
      r1: road(room, "B", a, b),
      w: road(room, "C", b, c, true),
      r2: road(room, "C", c, d),
    };
  });
  assert.deepEqual([r1.ownerId, w.ownerId, r2.ownerId], ["B", "C", "C"]);
});

test("capture: a bystander’s road between the captured settlement and a dead end transfers", () => {
  const { r } = captureCase((room) => {
    const [a, b] = inlandPath(room, 2);
    settlement(room, "B", a);
    return { captured: a, r: road(room, "C", a, b) };
  });
  assert.equal(r.ownerId, "A");
});

test("capture: a fork is judged per branch", () => {
  const { trunk, dead, toC } = captureCase((room) => {
    const land = (v) => common.landHexCount(room.board, v) >= 2;
    const x = vertices(
      room,
      (v) => land(v) && neighbors(room, v).filter(land).length === 3,
    )[0];
    const [s, u, l] = neighbors(room, x).filter(land);
    const lEnd = neighbors(room, l).find(
      (n) =>
        n !== x &&
        land(n) &&
        !neighbors(room, n).includes(s) &&
        !neighbors(room, n).includes(u),
    );
    settlement(room, "B", s);
    settlement(room, "C", lEnd);
    return {
      captured: s,
      trunk: road(room, "B", s, x),
      dead: road(room, "B", x, u),
      toC: road(room, "B", x, l),
      toC2: road(room, "B", l, lEnd),
    };
  });
  assert.deepEqual([trunk.ownerId, dead.ownerId, toC.ownerId], ["A", "A", "B"]);
});

// ── roads ───────────────────────────────────────────────────────────────
test("building and undoing a road leaves the board’s edge adjacency intact", () => {
  const room = freshRoom();
  phase(room, "Build");
  const [a, b] = inlandPath(room, 2);
  settlement(room, "A", a);
  const edge = edgeBetween(room, a, b);
  const before = JSON.stringify([
    room.board.vertices[a].roadIds,
    room.board.vertices[b].roadIds,
  ]);
  assert.equal(
    run(room, "buildRoad", "A", { edgeId: edge.id }).error,
    undefined,
  );
  assert.equal(
    JSON.stringify([
      room.board.vertices[a].roadIds,
      room.board.vertices[b].roadIds,
    ]),
    before,
  );
  assert.equal(run(room, "undoBuild", "A").error, undefined);
  assert.equal(
    JSON.stringify([
      room.board.vertices[a].roadIds,
      room.board.vertices[b].roadIds,
    ]),
    before,
  );
  assert.equal(edge.roadId, null);
});

test("snapshot v2 → v3 strips stray road ids from vertex.roadIds and drops the undo log", () => {
  const room = freshRoom();
  const v = Object.values(room.board.vertices)[0];
  v.roadIds.push("r_stray");
  room.turnState.undoLog = [
    { kind: "moveSoldier", soldierId: "x", originalVertexId: "y" },
  ];
  const out = migrate(JSON.parse(JSON.stringify(room)), 2);
  assert.ok(!out.board.vertices[v.id].roadIds.includes("r_stray"));
  assert.deepEqual(out.turnState.undoLog, []);
});

// ── The Admiral ─────────────────────────────────────────────────────────
const bonuses = (room) => {
  common.applyBonuses(room);
  return room.bonuses;
};
/** Keep players alive: one settlement + one soldier each, inland. */
function keepAlive(room) {
  const path = inlandPath(room, 6);
  settlement(room, "A", path[0]);
  soldier(room, "A", path[0]);
  settlement(room, "B", path[1]);
  soldier(room, "B", path[1]);
  settlement(room, "C", path[2]);
  soldier(room, "C", path[2]);
  return path;
}

test("The Admiral: strictly most ships at ≥3; ties keep the holder", () => {
  const room = freshRoom();
  keepAlive(room);
  const [c, w] = coastPair(room);
  const other = vertices(
    room,
    (v) => common.isWaterVertex(room.board, v) && v !== c && v !== w,
  );
  for (const v of other.slice(0, 3)) ship(room, "A", v);
  for (const v of other.slice(3, 5)) ship(room, "B", v);
  let b = bonuses(room);
  assert.equal(b.hasAdmiral["A"], true);
  assert.equal(b.fleetSize["A"], 3);
  assert.equal(b.fleetSize["B"], 2);
  const vp = P(room, "A").victoryPoints;
  // A rival tying the top fleet doesn't take the title.
  ship(room, "B", other[5]);
  b = bonuses(room);
  assert.equal(b.hasAdmiral["A"], true);
  // A rival strictly exceeding it does.
  ship(room, "B", other[6]);
  b = bonuses(room);
  assert.equal(b.hasAdmiral["B"], true);
  assert.equal(b.hasAdmiral["A"], false);
  // VP: A loses the Admiral point, B gains it.
  assert.equal(P(room, "A").victoryPoints, vp - 1); // Admiral point left with the title
  // Below 3 ships, nobody is Admiral.
  for (const id of Object.keys(room.board.ships)) delete room.board.ships[id];
  ship(room, "B", other[7]);
  ship(room, "B", other[8]); // B leads 2-0-0 — under the minimum
  b = bonuses(room);
  assert.ok(!b.hasAdmiral["A"] && !b.hasAdmiral["B"]);
});

test("The Admiral: an eliminated player’s ships count for nobody", () => {
  const room = freshRoom();
  keepAlive(room);
  const other = vertices(room, (v) => common.isWaterVertex(room.board, v));
  for (const v of other.slice(0, 3)) ship(room, "C", v); // C leads 3-0-0
  for (const v of other.slice(3, 5)) ship(room, "A", v); // A has 2
  let b = bonuses(room);
  assert.equal(b.hasAdmiral["C"], true);
  // Knock C out: no settlements and no soldiers → their ships are dead weight.
  for (const s of Object.values(room.board.settlements))
    if (s.ownerId === "C") delete room.board.settlements[s.id];
  for (const s of Object.values(room.board.soldiers))
    if (s.owner === "C") delete room.board.soldiers[s.id];
  for (const v of Object.values(room.board.vertices))
    if (v.settlementId && !room.board.settlements[v.settlementId])
      v.settlementId = null;
  b = bonuses(room);
  assert.equal(b.hasAdmiral["C"], false);
  assert.equal(b.fleetSize["C"], 0);
  assert.ok(!b.hasAdmiral["A"]); // A needs a third ship
  ship(room, "A", other[5]);
  b = bonuses(room);
  assert.equal(b.hasAdmiral["A"], true);
});

test("The Admiral: no holder when ships are disabled", () => {
  const room = freshRoom();
  keepAlive(room);
  const other = vertices(room, (v) => common.isWaterVertex(room.board, v));
  for (const v of other.slice(0, 3)) ship(room, "A", v);
  room.shipsEnabled = false;
  const b = bonuses(room);
  assert.ok(!b.hasAdmiral["A"]);
  assert.equal(b.fleetSize["A"], 0);
});

test("The Admiral’s ships get +1 sail step when an Action phase opens", () => {
  const room = freshRoom();
  keepAlive(room);
  const [c, w] = coastPair(room);
  const other = vertices(
    room,
    (v) => common.isWaterVertex(room.board, v) && v !== c && v !== w,
  );
  const mine = ship(room, "A", c);
  ship(room, "A", other[0]);
  ship(room, "A", other[1]);
  const rival = ship(room, "B", w);
  common.applyBonuses(room);
  assert.equal(room.bonuses.hasAdmiral["A"], true);
  room.turnState.dicePlayerIndex = 0;
  for (
    let i = 0;
    i < 8 &&
    !(room.turnState.phase === "Action" && room.turnState.player === "B");
    i++
  )
    advanceTurn(room);
  assert.equal(room.turnState.shipSteps[mine.id], 5); // ceil(7/2) + 1
  assert.equal(room.turnState.shipSteps[rival.id], 4); // no bonus for B's ship
});

test("undoing a sail refunds against the Admiral allowance", () => {
  const room = freshRoom();
  keepAlive(room);
  const [c, w] = coastPair(room);
  const sh = ship(room, "A", c);
  const third = vertices(
    room,
    (v) => common.isWaterVertex(room.board, v) && v !== c && v !== w,
  );
  ship(room, "A", third[0]);
  ship(room, "A", third[1]);
  common.applyBonuses(room);
  room.turnState.shipSteps[sh.id] = 5; // as granted: ceil(7/2) + 1
  assert.equal(
    run(room, "moveShip", "A", { shipId: sh.id, vertexId: w }).error,
    undefined,
  );
  assert.equal(room.turnState.shipSteps[sh.id], 4);
  assert.equal(run(room, "undoBuild", "A").error, undefined);
  assert.equal(room.turnState.shipSteps[sh.id], 5); // refunded to the Admiral allowance, not 4
});

// ── The Great Wall ──────────────────────────────────────────────────────
/** A run of `length` edge-linked vertices avoiding `used` (greedy DFS). */
function chainPath(room, length, used = new Set()) {
  for (const start of vertices(room, () => true)) {
    if (used.has(start)) continue;
    const go = (path) => {
      if (path.length === length) return path;
      for (const n of neighbors(room, path.at(-1))) {
        if (used.has(n) || path.includes(n)) continue;
        const out = go([...path, n]);
        if (out) return out;
      }
      return null;
    };
    const out = go([start]);
    if (out) return out;
  }
  throw new Error("no chain path");
}

test("The Great Wall: longest wall run ≥3; enemy settlements sever; ties keep the holder", () => {
  const room = freshRoom();
  const seed = new Set(keepAlive(room));
  const pa = chainPath(room, 4, seed);
  const used = new Set([...seed, ...pa]);
  const pb = chainPath(room, 5, used);
  // A's run of 3: pa[0]-pa[1]-pa[2]-pa[3].
  road(room, "A", pa[0], pa[1], true);
  road(room, "A", pa[1], pa[2], true);
  road(room, "A", pa[2], pa[3], true);
  let b = bonuses(room);
  assert.equal(b.hasGreatWall["A"], true);
  assert.equal(b.wallRun["A"], 3);
  const vp = P(room, "A").victoryPoints;
  // B's walls on the two links either side of A's settlement on pb[2]:
  // two runs of 2 — the enemy building severs, so B can't reach 3.
  settlement(room, "A", pb[2]);
  road(room, "B", pb[0], pb[1], true);
  road(room, "B", pb[1], pb[2], true);
  road(room, "B", pb[2], pb[3], true);
  road(room, "B", pb[3], pb[4], true);
  b = bonuses(room);
  assert.equal(b.wallRun["B"], 2);
  assert.equal(b.hasGreatWall["A"], true);
  // B extends to a clean run of 3 elsewhere: tied 3-3, the holder stays.
  const pb2 = chainPath(room, 4, new Set([...used, ...pb]));
  road(room, "B", pb2[0], pb2[1], true);
  road(room, "B", pb2[1], pb2[2], true);
  road(room, "B", pb2[2], pb2[3], true);
  b = bonuses(room);
  assert.equal(b.wallRun["B"], 3);
  assert.equal(b.hasGreatWall["A"], true);
  // A detached wall still counts toward A's run only — extend B to 4 → title moves.
  road(room, "B", pb2[3], neighbors(room, pb2[3]).find((n) => !pb2.includes(n) && !used.has(n) && !pb2.includes(n)), true);
  b = bonuses(room);
  assert.equal(b.hasGreatWall["B"], true);
  assert.equal(b.hasGreatWall["A"], false);
  assert.equal(P(room, "A").victoryPoints, vp); // −1 Great Wall, +1 for the settlement at pb[2]
});

test("The Great Wall buff: the holder's walls need 5+ to breach", () => {
  const room = freshRoom();
  const seed = new Set(keepAlive(room));
  const pa = chainPath(room, 4, seed);
  road(room, "A", pa[0], pa[1], true);
  road(room, "A", pa[1], pa[2], true);
  road(room, "A", pa[2], pa[3], true);
  // A detached wall far from the run — still buffed ("all their walls").
  const pc = chainPath(room, 2, new Set([...seed, ...pa]));
  const detached = road(room, "A", pc[0], pc[1], true);
  bonuses(room);
  assert.equal(room.bonuses.hasGreatWall["A"], true);
  // B's stationed cannon shoots the detached wall: a 4 misses, a 5 breaches.
  phase(room, "Action", "B");
  const cannon = soldier(room, "B", pc[0], { type: "cannon", stationed: true });
  const edge = edgeBetween(room, pc[0], pc[1]);
  assert.equal(
    run(room, "cannonAttackWall", "B", { soldierId: cannon.id, edgeId: edge.id }).error,
    undefined,
  );
  assert.equal(
    withRoll(4, () => run(room, "rollWallShot", "B")).error,
    undefined,
  );
  assert.equal(room.board.roads[detached.id].isWall, true); // held
  room.turnState.soldiersActedThisTurn = [];
  room.cannonShot = null;
  assert.equal(
    run(room, "cannonAttackWall", "B", { soldierId: cannon.id, edgeId: edge.id }).error,
    undefined,
  );
  assert.equal(
    withRoll(5, () => run(room, "rollWallShot", "B")).error,
    undefined,
  );
  assert.equal(room.board.roads[detached.id].isWall, false); // breached on 5+
});
