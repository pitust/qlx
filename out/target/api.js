"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _MindustryProgram = require('./mlog/MindustryProgram');
var _NativeProgram = require('./mlog/NativeProgram');


 function createProgram() {
    if (process.env.QLX_EXPERIMANTAL_NATIVE == 'yes') return new (0, _NativeProgram.NativeProgram)()
    return new (0, _MindustryProgram.MindustryProgram)()
} exports.createProgram = createProgram;
