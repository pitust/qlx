"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _typechk = require('./typechk');
var _middlegen = require('./middlegen');
var _codegen = require('./codegen');
var _codegen22 = require('./codegen2');
var _fs = require('fs');

var _genprg = require('./gen-prg');

 function onCLIParseComplete(o, input, output) {
    Object.assign(_middlegen.options, o)
    if (_middlegen.options.max) {
        _middlegen.options.noEnd = true
        _middlegen.options.bindLoads = true
        _middlegen.options.noSafeAbort = true
        _middlegen.options.eliminateBranches = true
        _middlegen.options.rawArgRefs = true
        _middlegen.options.reorderBlocks = true
        _middlegen.options.constProp = true
        _middlegen.options.eliminateDeadCode = true
        _middlegen.options.inline = true
        _middlegen.options.mergePrint = true
        _middlegen.options.mergeBlocks = true
        _middlegen.options.max = true
    }
    const writeCode = (code) => (output ? _fs.writeFileSync.call(void 0, output, code) : console.log(code))
    const u = _middlegen.generateSSA.call(void 0, input)
    if (_middlegen.options.dump_freshSsa) {
        _middlegen.dumpSSA.call(void 0, u[0])
        for (const [, p] of u[1]) _middlegen.dumpSSA.call(void 0, p)
    }
    if (!_typechk.checkAllTypes.call(void 0, u)) {
        console.log('fatal error: type check failed; exiting')
        process.exit(1)
    }
    if (_middlegen.options.prg) _genprg.buildProgram.call(void 0, u)
    else if (_middlegen.options.gen2) _codegen22.generateCode.call(void 0, u, writeCode)
    else _codegen.generateCode.call(void 0, u, writeCode)
    // goodbye, qlxemit
    // it was not that bad
    //     compileCode(input, writeCode)
} exports.onCLIParseComplete = onCLIParseComplete;
