import { onCLIParseComplete } from './cli';
const options = {
    bindLoads: false,
    constProp: false,
    dumpSsa: false,
    eliminateBranches: false,
    eliminateDeadCode: false,
    forward: false,
    inline: false,
    interleaveSsa: false,
    max: false,
    mergeBlocks: false,
    mergePrint: false,
    noEnd: false,
    noSafeAbort: false,
    rawArgRefs: false,
    reorderBlocks: false,
    ssa: false,
    stripComments: false,
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
    else if (arg == '-fbind-loads') options.bindLoads = true; 
    else if (arg == '-fconst-prop') options.constProp = true; 
    else if (arg == '-fdump-ssa') options.dumpSsa = true; 
    else if (arg == '-feliminate-branches') options.eliminateBranches = true; 
    else if (arg == '-feliminate-dead-code') options.eliminateDeadCode = true; 
    else if (arg == '-fforward') options.forward = true; 
    else if (arg == '-finline') options.inline = true; 
    else if (arg == '-finterleave-ssa') options.interleaveSsa = true; 
    else if (arg == '-fmax') options.max = true; 
    else if (arg == '-fmerge-blocks') options.mergeBlocks = true; 
    else if (arg == '-fmerge-print') options.mergePrint = true; 
    else if (arg == '-fno-end') options.noEnd = true; 
    else if (arg == '-fno-safe-abort') options.noSafeAbort = true; 
    else if (arg == '-fraw-arg-refs') options.rawArgRefs = true; 
    else if (arg == '-freorder-blocks') options.reorderBlocks = true; 
    else if (arg == '-fssa') options.ssa = true; 
    else if (arg == '-fstrip-comments') options.stripComments = true; 
    else if (arg.startsWith('-o') && arg.length > 2) output = arg.slice(2)
    else {
        console.log('error: unknown argument:', arg);
        process.exit(1);
    }
}
function _printHelpMessage() {
    console.log("Usage: qlx [OPTIONS...] <input> [-o<output>]");
    console.log("    -fbind-loads            - bind registers to locals when loaded");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fconst-prop            - propagate constants accross the code");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fdump-ssa              - dump the SSA generated");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -feliminate-branches    - eliminate branches in cases where fallthrough is enough");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -feliminate-dead-code   - eliminate some dead instructions.");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fforward               - forward moves when used once");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -finline                - inline small functions");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa and -fraw-arg-refs");
    console.log("    -finterleave-ssa        - interlave code and SSA opcodes");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fmax                   - enable as much stuff as possible");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fmerge-blocks          - merge blocks that must come after each other");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fmerge-print           - merge sequential constant-value prints left by the optimizer");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fno-end                - remove the last `end` opcode from the code");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa and -fno-safe-abort");
    console.log("    -fno-safe-abort         - disable compiler-generated safety abort loops");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fraw-arg-refs          - use raw argument references");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -freorder-blocks        - use weighted block reordering, rather than sequential block order");
    console.log("                              \x1b[1mNeeds\x1b[0m -fssa");
    console.log("    -fssa                   - Enable experimental SSA codegen (single-statement assigned)");
    console.log("    -fstrip-comments        - strip comments from the output to save on lines");
    process.exit(1);
}
if (options.bindLoads && !options.ssa) _printHelpMessage();
if (options.constProp && !options.ssa) _printHelpMessage();
if (options.dumpSsa && !options.ssa) _printHelpMessage();
if (options.eliminateBranches && !options.ssa) _printHelpMessage();
if (options.eliminateDeadCode && !options.ssa) _printHelpMessage();
if (options.forward && !options.ssa) _printHelpMessage();
if (options.inline && !options.ssa) _printHelpMessage();
if (options.inline && !options.rawArgRefs) _printHelpMessage();
if (options.interleaveSsa && !options.ssa) _printHelpMessage();
if (options.max && !options.ssa) _printHelpMessage();
if (options.mergeBlocks && !options.ssa) _printHelpMessage();
if (options.mergePrint && !options.ssa) _printHelpMessage();
if (options.noEnd && !options.ssa) _printHelpMessage();
if (options.noEnd && !options.noSafeAbort) _printHelpMessage();
if (options.noSafeAbort && !options.ssa) _printHelpMessage();
if (options.rawArgRefs && !options.ssa) _printHelpMessage();
if (options.reorderBlocks && !options.ssa) _printHelpMessage();
if (!input) _printHelpMessage();
onCLIParseComplete(options, input!, output);
