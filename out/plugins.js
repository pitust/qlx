"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _path = require('path'); var _path2 = _interopRequireDefault(_path);

const mixins = new Map()

 function checkForMixin(s, t) {
    if (!mixins.has(s)) return null
    return (mixins.get(s))(t)
} exports.checkForMixin = checkForMixin;

 function registerMixin(mixin, cb) {
    if (mixins.has(mixin)) {
        console.log('Error: mixin conflict: %s redeclared', mixin)
        process.exit(1)
    }
    mixins.set(mixin, cb)
} exports.registerMixin = registerMixin;

function applyPlg(p) {
    p && p.load && p.load()
}

 function loadPlugin(name) {
    try {
        applyPlg(require(name))
    } catch (e) {
        applyPlg(require(_path2.default.join(process.cwd(), name)))
    }
} exports.loadPlugin = loadPlugin;