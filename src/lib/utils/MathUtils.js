import { randomInt } from "d3-random";

/**
 * Generates a random float in [min, max)
 * @param {number} min minimum
 * @param {number} max maximum
 * @returns {number} random float
 */
export function randFloat(min, max) {
    return Math.random() * (max - min) + min;
}

/**
 * Returns a random element from the given array.
 * @param {Array} array an array
 * @returns {any} random element from the array
 */
export function choose(array) {
    const index = randomInt(0, array.length)();
    return array[index];
}

/**
 * Shortcut for Math.max(minValue, Math.min(maxValue, value))
 * @param {number} value value
 * @param {number} minValue lower limit
 * @param {number} maxValue upper limit
 * @returns {number} clipped number
 */
export function clipValue(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, value));
}

/**
 * Swaps two numbers if the first is larger than the second
 * @param {number} x a number
 * @param {number} y a number
 * @returns {number[]} array with the smaller number first
 */
export function swapSoSmallerFirst(x, y) {
    if (x <= y) {
        return [x, y];
    }
    return [y, x];
}
