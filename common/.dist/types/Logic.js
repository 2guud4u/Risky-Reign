"use strict";
exports.__esModule = true;
exports.SoldierPrice = exports.RoadPrice = exports.SettlementPrice = exports.generateGameBoard = void 0;
var Hex_1 = require("./Hex");
var Board_1 = require("./Board");
var generateGameBoard = function (boardRadius, hexSize) {
    var hexes = (0, Hex_1.generateHexes)(boardRadius);
    var intersections = (0, Board_1.generateIntersections)(hexes, hexSize);
    intersections = (0, Board_1.connectIntersections)(intersections, hexSize);
    return { hexes: hexes, intersections: intersections };
};
exports.generateGameBoard = generateGameBoard;
exports.SettlementPrice = {
    Wood: -1,
    Brick: -1,
    Sheep: -1,
    Wheat: -1,
    Ore: 0
};
exports.RoadPrice = {
    Wood: -1,
    Brick: -1,
    Sheep: 0,
    Wheat: 0,
    Ore: 0
};
exports.SoldierPrice = {
    Wood: 0,
    Brick: -1,
    Sheep: -1,
    Wheat: -1,
    Ore: 0
};
