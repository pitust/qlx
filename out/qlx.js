"use strict";var _cli = require('./cli');
const options = {
    ssa: false,
    stripComments: false,
    noEnd: false,
    noSafeAbort: false,
    dumpSsa: false,
    bindLoads: false,
    eliminateBranches: false,
    reorderBlocks: false,
    max: false,
    constProp: false,
    eliminateDeadCode: false,
    mergePrint: false,
    interleaveSsa: false,
}
let input = null;
let output = null;
if (process.argv.includes('-h') || process.argv.includes('--help')) {
    _printHelpMessage();
}
for (const arg of process.argv.slice(2)) {
    if (arg[0] != '-') {
        if (!input) {
            input = arg;
        } else {
            console.log('error: input redefined:', arg);
            process.exit(1);
        }
    }
    else if (arg == '-fssa') options.ssa = true; 
    else if (arg == '-fstrip-comments') options.stripComments = true; 
    else if (arg == '-fno-end') options.noEnd = true; 
    else if (arg == '-fno-safe-abort') options.noSafeAbort = true; 
    else if (arg == '-fdump-ssa') options.dumpSsa = true; 
    else if (arg == '-fbind-loads') options.bindLoads = true; 
    else if (arg == '-feliminate-branches') options.eliminateBranches = true; 
    else if (arg == '-freorder-blocks') options.reorderBlocks = true; 
    else if (arg == '-fmax') options.max = true; 
    else if (arg == '-fconst-prop') options.constProp = true; 
    else if (arg == '-feliminate-dead-code') options.eliminateDeadCode = true; 
    else if (arg == '-fmerge-print') options.mergePrint = true; 
    else if (arg == '-finterleave-ssa') options.interleaveSsa = true; 
    else if (arg.startsWith('-o') && arg.length > 2) output = arg.slice(2)
    else {
        console.log('error: unknown argument:', arg);
        process.exit(1);
    }
}
function _printHelpMessage() {
    console.log("Usage: qlx [OPTIONS...] <input> [-o<output>]");
    console.log("    -fssa                   - Enable experimental SSA codegen (single-statement assigned)");
    console.log("    -fstrip-comments        - strip comments from the output to save on lines");
    console.log("    -fno-end                - remove the last `end` opcode from the code");
    console.log("    -fno-safe-abort         - disable compiler-generated safety abort loops");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fdump-ssa              - dump the SSA generated");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fbind-loads            - bind registers to locals when loaded");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -feliminate-branches    - eliminate branches in cases where fallthrough is enough");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -freorder-blocks        - use weighted block reordering, rather than sequential block order");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fmax                   - enable as much stuff as possible");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fconst-prop            - propagate constants accross the code");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -feliminate-dead-code   - eliminate some dead instructions.");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fmerge-print           - merge sequential constant-value prints left by the optimizer");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -finterleave-ssa        - interlave code and SSA opcodes");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    process.exit(1);
}
if (options.noSafeAbort && !options.ssa) _printHelpMessage();
if (options.dumpSsa && !options.ssa) _printHelpMessage();
if (options.bindLoads && !options.ssa) _printHelpMessage();
if (options.eliminateBranches && !options.ssa) _printHelpMessage();
if (options.reorderBlocks && !options.ssa) _printHelpMessage();
if (options.max && !options.ssa) _printHelpMessage();
if (options.constProp && !options.ssa) _printHelpMessage();
if (options.eliminateDeadCode && !options.ssa) _printHelpMessage();
if (options.mergePrint && !options.ssa) _printHelpMessage();
if (options.interleaveSsa && !options.ssa) _printHelpMessage();
if (!input) _printHelpMessage();
_cli.onCLIParseComplete.call(void 0, options, input, output);
