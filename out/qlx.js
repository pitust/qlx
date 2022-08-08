"use strict";var _cli = require('./cli');
const options = {
    target: 'none',
    bindLoads: false,
    cgOutput_suppress: false,
    constProp: false,
    dump_ast: false,
    dump_freshSsa: false,
    dump_nativeGraphColoring: false,
    dump_prgDfg: false,
    dump_prgDfgExpandvars: false,
    dump_ssaPreEmit: false,
    dump_ssaPreOpt: false,
    eliminateBranches: false,
    eliminateDeadCode: false,
    forward: false,
    frontend_modern: false,
    frontend_qlxasm: false,
    gen2: false,
    inline: false,
    interleaveSsa: false,
    max: false,
    mergeBlocks: false,
    mergePrint: false,
    noEnd: false,
    noSafeAbort: false,
    prg: false,
    rawArgRefs: false,
    reorderBlocks: false,
    stripComments: false,
}
let input = null;
let output = null;
if (process.argv.includes('-h') || process.argv.includes('--help')) {
    _printHelpMessage();
}
let isNextTarget = false
for (let arg of process.argv.slice(2)) {
    if (arg[0] != '-' && !isNextTarget) {
        if (!input) {
            input = arg;
            continue;
        } else {
            console.log('error: input redefined:', arg);
            process.exit(1);
        }
    }
    if (arg == '--target') { isNextTarget = true; continue; }
    if (arg.startsWith('--target=')) { arg = arg.slice(9); isNextTarget = true; }
    if (isNextTarget) { isNextTarget = false; options.target = arg; continue; }
    else if (arg == '-fbind-loads') options.bindLoads = true; 
    else if (arg == '-fcg-output=suppress') options.cgOutput_suppress = true; 
    else if (arg == '-fconst-prop') options.constProp = true; 
    else if (arg == '-fdump=ast') options.dump_ast = true; 
    else if (arg == '-fdump=fresh-ssa') options.dump_freshSsa = true; 
    else if (arg == '-fdump=native-graph-coloring') options.dump_nativeGraphColoring = true; 
    else if (arg == '-fdump=prg-dfg') options.dump_prgDfg = true; 
    else if (arg == '-fdump=prg-dfg-expandvars') options.dump_prgDfgExpandvars = true; 
    else if (arg == '-fdump=ssa-pre-emit') options.dump_ssaPreEmit = true; 
    else if (arg == '-fdump=ssa-pre-opt') options.dump_ssaPreOpt = true; 
    else if (arg == '-feliminate-branches') options.eliminateBranches = true; 
    else if (arg == '-feliminate-dead-code') options.eliminateDeadCode = true; 
    else if (arg == '-fforward') options.forward = true; 
    else if (arg == '-ffrontend=modern') options.frontend_modern = true; 
    else if (arg == '-ffrontend=qlxasm') options.frontend_qlxasm = true; 
    else if (arg == '-fgen2') options.gen2 = true; 
    else if (arg == '-finline') options.inline = true; 
    else if (arg == '-finterleave-ssa') options.interleaveSsa = true; 
    else if (arg == '-fmax') options.max = true; 
    else if (arg == '-fmerge-blocks') options.mergeBlocks = true; 
    else if (arg == '-fmerge-print') options.mergePrint = true; 
    else if (arg == '-fno-end') options.noEnd = true; 
    else if (arg == '-fno-safe-abort') options.noSafeAbort = true; 
    else if (arg == '-fprg') options.prg = true; 
    else if (arg == '-fraw-arg-refs') options.rawArgRefs = true; 
    else if (arg == '-freorder-blocks') options.reorderBlocks = true; 
    else if (arg == '-fstrip-comments') options.stripComments = true; 
    else if (arg.startsWith('-o') && arg.length > 2) output = arg.slice(2)
    else {
        console.log('error: unknown argument:', arg);
        process.exit(1);
    }
}
function _printHelpMessage() {
    console.log("Usage: qlx [OPTIONS...] <input> [-o <output>]");
    console.log("    --target <codegen>[,OPTION...] - Set the target to compile for. Nested targets are delimited with commas. Available targets:");
    console.log("                                        - mlog");
    console.log("                                        - native:");
    console.log("                                          - x86_64");
    console.log("                                          - aarch64");
    console.log("    -fbind-loads                   - Bind registers to locals when loaded");
    console.log("    -fcg-output=suppress           - Do not output anything");
    console.log("    -fconst-prop                   - Propagate constants accross the code");
    console.log("    -fdump=ast                     - Dump AST");
    console.log("    -fdump=fresh-ssa               - Dump initial SSA contents");
    console.log("    -fdump=native-graph-coloring   - Dump native codegen graph coloring results");
    console.log("    -fdump=prg-dfg                 - Dump the PRG data-flow graph");
    console.log("                                     \x1b[1mNeeds\x1b[0m -fprg");
    console.log("    -fdump=prg-dfg-expandvars      - Expand variables in PRG data-flow graph dumps");
    console.log("                                     \x1b[1mNeeds\x1b[0m -fdump=prg-dfg");
    console.log("    -fdump=ssa-pre-emit            - Dump final SSA to be emitted");
    console.log("    -fdump=ssa-pre-opt             - Dump SSA before optimization");
    console.log("    -feliminate-branches           - Eliminate branches in cases where fallthrough is enough");
    console.log("    -feliminate-dead-code          - Eliminate some dead instructions.");
    console.log("    -fforward                      - Forward moves when used once");
    console.log("    -ffrontend=modern              - Use the modern QLX frontend");
    console.log("                                     \x1b[1mConflicts with\x1b[0m -ffrontend=qlxasm");
    console.log("    -ffrontend=qlxasm              - Use QLX as a fancy macro assembler");
    console.log("                                     \x1b[1mConflicts with\x1b[0m -ffrontend=modern");
    console.log("    -fgen2                         - Enable WIP gen2 code generation, in preparation for machine code");
    console.log("    -finline                       - Inline small functions");
    console.log("                                     \x1b[1mNeeds\x1b[0m -fraw-arg-refs");
    console.log("    -finterleave-ssa               - Interlave code and SSA opcodes");
    console.log("    -fmax                          - Enable as much opt stuff as possible");
    console.log("    -fmerge-blocks                 - Merge blocks that must come after each other");
    console.log("    -fmerge-print                  - Merge sequential constant-value prints left by the optimizer");
    console.log("    -fno-end                       - Remove the last `end` opcode from the code");
    console.log("                                     \x1b[1mNeeds\x1b[0m -fno-safe-abort");
    console.log("    -fno-safe-abort                - Disable compiler-generated safety abort loops");
    console.log("    -fprg                          - Enable experimental less-optimizing prg codegen (pretty reasonable codegen)");
    console.log("    -fraw-arg-refs                 - Use raw argument references");
    console.log("    -freorder-blocks               - Use weighted block reordering, rather than sequential block order");
    console.log("    -fstrip-comments               - Strip comments from the output to save on lines");
    process.exit(1);
}
if (options.dump_prgDfg && !options.prg) _printHelpMessage();
if (options.dump_prgDfgExpandvars && !options.dump_prgDfg) _printHelpMessage();
if (options.frontend_modern && options.frontend_qlxasm) _printHelpMessage();
if (options.frontend_qlxasm && options.frontend_modern) _printHelpMessage();
if (options.inline && !options.rawArgRefs) _printHelpMessage();
if (options.noEnd && !options.noSafeAbort) _printHelpMessage();
if (!input || options.target == 'none') _printHelpMessage();
_cli.onCLIParseComplete.call(void 0, options, input, output);
