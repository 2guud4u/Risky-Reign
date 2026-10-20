process.env.DATA_DIR = '/tmp/dbgwall-data';
const store = await import('/Users/jiahuajiang/Desktop/Code/RiskOfCatan/backend/dist/store.js');
const common = await import('common');
const room = store.createGameRoom('W1', 'A');
for (const name of ['A', 'B', 'C']) room.players.push({ id: 's' + name, name, color: '#e11', token: 't' + name, resources: { Wood: 9, Brick: 9, Sheep: 9, Wheat: 9, Ore: 9 }, victoryPoints: 0, eliminated: false, connected: true, developmentCards: [], freeRoadsLeft: 0, devCardsBoughtThisTurn: 0 });
room.turnState.playerOrder = ['A', 'B', 'C'];
room.gameStatus = 'playing';
room.turnState.phase = 'Action'; room.turnState.player = 'A';
const V = () => Object.keys(room.board.vertices);
const nb = (v) => common.adjacentVertexIds(room.board, v);
const land = (v) => common.landHexCount(room.board, v) >= 2;
function inlandPath(len) {
  for (const start of V().filter(land)) {
    const path = [start];
    while (path.length < len) {
      const next = nb(path.at(-1)).find((n) => land(n) && !path.includes(n));
      if (!next) break;
      path.push(next);
    }
    if (path.length === len) return path;
  }
  throw new Error('no path');
}
const st = (room, owner, vid) => { const id = 'st' + vid; room.board.settlements[id] = { id, vertexId: vid, ownerId: owner, level: 'settlement', builtAt: 0 }; room.board.vertices[vid].settlementId = id; };
const keepAlive = (room) => { const p = inlandPath(6); st(room, 'A', p[0]); st(room, 'B', p[1]); st(room, 'C', p[2]); return p; };
function chainPath(length, used = new Set()) {
  for (const start of V()) {
    if (used.has(start)) continue;
    const go = (path) => {
      if (path.length === length) return path;
      for (const n of nb(path.at(-1))) {
        if (used.has(n) || path.includes(n)) continue;
        const out = go([...path, n]);
        if (out) return out;
      }
      return null;
    };
    const out = go([start]);
    if (out) return out;
  }
  throw new Error('no chain');
}
const edgeBetween = (a, b) => Object.values(room.board.edges).find((e) => (e.vertexAId === a && e.vertexBId === b) || (e.vertexAId === b && e.vertexBId === a));
let seq = 0;
const road = (owner, a, b) => { const e = edgeBetween(a, b); if (!e) throw new Error('no edge ' + a + ' ' + b); const id = 'r' + seq++; room.board.roads[id] = { id, edgeId: e.id, ownerId: owner, builtAt: 0, isWall: true }; e.roadId = id; };
const seed = new Set(keepAlive(room));
const pa = chainPath(4, seed);
const used = new Set([...seed, ...pa]);
const pb = chainPath(5, used);
road('A', pa[0], pa[1]); road('A', pa[1], pa[2]); road('A', pa[2], pa[3]);
common.applyBonuses(room);
console.log('A run', room.bonuses.wallRun);
st(room, 'A', pb[2]);
road('B', pb[0], pb[1]); road('B', pb[1], pb[2]); road('B', pb[2], pb[3]); road('B', pb[3], pb[4]);
common.applyBonuses(room);
console.log('after B severed:', room.bonuses.wallRun);
const pb2 = chainPath(4, new Set([...used, ...pb]));
console.log('pb2', pb2, 'settlements on pb2?', pb2.map((v) => room.board.settlements[room.board.vertices[v].settlementId]?.ownerId));
road('B', pb2[0], pb2[1]); road('B', pb2[1], pb2[2]); road('B', pb2[2], pb2[3]);
common.applyBonuses(room);
console.log('after B run3:', room.bonuses.wallRun, room.bonuses.hasGreatWall);
console.log('B wall edges:', Object.values(room.board.roads).filter((r) => r.ownerId === 'B').map((r) => room.board.edges[r.edgeId].vertexAId + '-' + room.board.edges[r.edgeId].vertexBId));
