import { onCLIParseComplete } from './cli';
const options = {
    ssa: false,
    reorderBlocks: false,
}
let input = null;
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
    else if (arg == '-freorder-blocks') options.reorderBlocks = true; 
    else {
        console.log('error: unknown argument:', arg);
        process.exit(1);
    }
}
function _printHelpMessage() {
    console.log("Usage: qlx [OPTIONS...] <input>");
    console.log("    -fssa              - Enable experimental SSA codegen (single-statement assigned)");
    console.log("    -freorder-blocks   - use weighted block reordering, rather than sequential block order.");
    console.log("                         \x1b[1mNeeds\x1b[0m -fssa");
    process.exit(1);
}
if (options.reorderBlocks && !options.ssa) _printHelpMessage();
if (!input) _printHelpMessage();
onCLIParseComplete(options, input);
