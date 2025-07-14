"use strict";
exports.__esModule = true;
exports.generateHexes = exports.terrainColors = exports.getRollMap = exports.TerrainResourceMap = void 0;
var data_1 = require("../utils/data");
var numTokens = {
    2: 1,
    3: 2,
    4: 2,
    5: 2,
    6: 2,
    8: 2,
    9: 2,
    10: 2,
    11: 2,
    12: 1
};
var terrains = {
    Wheat: 4,
    Sheep: 4,
    Ore: 3,
    Desert: 1,
    Brick: 3,
    Wood: 4,
    Water: 0,
    Nothing: 0
};
exports.TerrainResourceMap = {
    Wheat: 'Wheat',
    Sheep: 'Sheep',
    Ore: 'Ore',
    Brick: 'Brick',
    Wood: 'Wood',
    Water: 'Nothing',
    Desert: 'Nothing',
    Nothing: 'Nothing'
};
function getRollMap(hexes) {
    var rollMap = new Map();
    hexes.forEach(function (hex) {
        if (hex.rollNumber !== null) {
            if (rollMap.has(hex.rollNumber)) {
                rollMap.get(hex.rollNumber).push(hex.id);
            }
            else {
                rollMap.set(hex.rollNumber, [hex.id]);
            }
        }
    });
    return rollMap;
}
exports.getRollMap = getRollMap;
exports.terrainColors = {
    Wood: '#228B22',
    Sheep: '#7CFC00',
    Wheat: '#FFD700',
    Brick: '#CD853F',
    Ore: '#A9A9A9',
    Desert: '#F4A460',
    Water: '#00FFFF'
};
var generateHexes = function (boardRadius) {
    var hexes = [];
    var TerrainList = (0, data_1.shuffleArray)((0, data_1.flattenAndFillObject)(terrains));
    var tokenList = (0, data_1.shuffleArray)((0, data_1.flattenAndFillObject)(numTokens));
    var id = 0;
    for (var q = -boardRadius; q <= boardRadius; q++) {
        for (var r = Math.max(-boardRadius, -q - boardRadius); r <= Math.min(boardRadius, -q + boardRadius); r++) {
            var s = -q - r;
            var terrain = TerrainList.pop();
            if (!terrain) {
                terrain = 'Water';
            }
            if (terrain === 'Desert') {
                hexes.push({
                    id: id,
                    intersections: new Set(),
                    coord: { q: q, r: r, s: s },
                    terrain: terrain,
                    robber: true,
                    rollNumber: null
                });
            }
            else {
                var token = tokenList.pop();
                hexes.push({
                    id: id,
                    intersections: new Set(),
                    coord: { q: q, r: r, s: s },
                    terrain: terrain,
                    robber: false,
                    rollNumber: token
                });
            }
            id += 1;
        }
    }
    return hexes;
};
exports.generateHexes = generateHexes;
