"use strict";
exports.__esModule = true;
exports.zip = exports.groupBy = exports.calcEuclideanDistance = exports.pixelToCube = exports.flattenAndFillObject = exports.shuffleArray = exports.cubeToPixel = void 0;
function cubeToPixel(cube, size) {
    var x = size * (Math.sqrt(3) * cube.q + (Math.sqrt(3) / 2) * cube.r);
    var y = size * ((3 / 2) * cube.r);
    return { x: x, y: y };
}
exports.cubeToPixel = cubeToPixel;
function shuffleArray(array) {
    var _a;
    for (var i = array.length - 1; i > 0; i--) {
        // Pick a random index from 0 to i
        var j = Math.floor(Math.random() * (i + 1));
        // Swap elements at indices i and j
        _a = [array[j], array[i]], array[i] = _a[0], array[j] = _a[1];
    }
    return array;
}
exports.shuffleArray = shuffleArray;
function flattenAndFillObject(target) {
    return Object.entries(target).flatMap(function (_a) {
        var key = _a[0], count = _a[1];
        return Array(count).fill(key);
    });
}
exports.flattenAndFillObject = flattenAndFillObject;
function pixelToCube(x, y, size) {
    var sqrt3 = Math.sqrt(3);
    // Reverse the x calculation: q = (x / (size * sqrt3) - (sqrt3 / 2) * r / sqrt3)
    var r = y * size * (3 / 2);
    var q = (x / size - (sqrt3 / 2) * r) / sqrt3;
    var s = -(q + r);
    return { q: q, r: r, s: s };
}
exports.pixelToCube = pixelToCube;
function calcEuclideanDistance(a, b) {
    return Math.sqrt(Math.pow((a.x - b.x), 2) + Math.pow((a.y - b.y), 2));
}
exports.calcEuclideanDistance = calcEuclideanDistance;
function groupBy(array, key) {
    return array.reduce(function (acc, item) {
        var groupKey = item[key]; // The key by which to group
        if (!acc[groupKey]) {
            acc[groupKey] = [];
        }
        acc[groupKey].push(item);
        return acc;
    }, {}); // Initialize accumulator as an empty object
}
exports.groupBy = groupBy;
function zip() {
    var arrays = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        arrays[_i] = arguments[_i];
    }
    // Get the shortest array length
    var length = Math.min.apply(Math, arrays.map(function (arr) { return arr.length; }));
    var result = [];
    var _loop_1 = function (i) {
        var zippedItem = arrays.map(function (arr) { return arr[i]; });
        result.push(zippedItem);
    };
    // Iterate over the arrays and create the zipped result
    for (var i = 0; i < length; i++) {
        _loop_1(i);
    }
    return result;
}
exports.zip = zip;
