"use strict";
exports.__esModule = true;
exports.isBuildType = exports.SoldierImpl = exports.RoadImpl = exports.SettlementImpl = void 0;
var SettlementImpl = /** @class */ (function () {
    function SettlementImpl(owner, upgraded) {
        this.owner = owner;
        this.upgraded = upgraded;
    }
    return SettlementImpl;
}());
exports.SettlementImpl = SettlementImpl;
var RoadImpl = /** @class */ (function () {
    function RoadImpl(start, end, owner) {
        this.start = start;
        this.end = end;
        this.owner = owner;
    }
    return RoadImpl;
}());
exports.RoadImpl = RoadImpl;
var SoldierImpl = /** @class */ (function () {
    function SoldierImpl(injured, owner) {
        this.owner = owner;
        this.injured = injured;
    }
    return SoldierImpl;
}());
exports.SoldierImpl = SoldierImpl;
var buildTypes = ["Settlement", "Road", "City", "Soldier"];
var isBuildType = function (arg) {
    return buildTypes.includes(arg);
};
exports.isBuildType = isBuildType;
