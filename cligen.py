
options = {
    'bind-loads': '[ssa] bind registers to locals when loaded',
    'const-prop': '[ssa] propagate constants accross the code',
    'dump-ssa': '[ssa] dump the SSA generated',
    'eliminate-branches': '[ssa] eliminate branches in cases where fallthrough is enough',
    'eliminate-dead-code': '[ssa] eliminate some dead instructions.',
    'interleave-ssa': '[ssa] interlave code and SSA opcodes',
    'merge-print': '[ssa] merge sequential constant-value prints left by the optimizer',
    'merge-blocks': '[ssa] merge blocks that must come after each other',
    'max': '[ssa] enable as much stuff as possible',
    'no-end': '[ssa] [no-safe-abort] remove the last `end` opcode from the code',
    'no-safe-abort': '[ssa] disable compiler-generated safety abort loops',
    'raw-arg-refs': '[ssa] use raw argument references',
    'reorder-blocks': '[ssa] use weighted block reordering, rather than sequential block order',
    'ssa': 'Enable experimental SSA codegen (single-statement assigned)',
    'strip-comments': 'strip comments from the output to save on lines',
}
keydata = []
for k in options.keys():
    keydata.append(k)
keydata.sort()
options2 = {}
for k in keydata:
    options2[k] = options[k]
options = options2

def mapname(s: str) -> str:
    data = s.split('-')
    for i in range(1, len(data)):
        data[i] = data[i][0].upper() + data[i][1:]
    return ''.join(data)

longest_name = 0

for nam in options.keys():
    longest_name = len(nam) + 2 if len(nam) + 2 > longest_name else longest_name

tsiface = ['export interface Options {']
struct = ['const options = {']
parsecode = [
    'let input = null;',
    'let output = null;',
    'if (process.argv.includes(\'-h\') || process.argv.includes(\'--help\')) {',
    '    _printHelpMessage();',
    '}',
    'for (const arg of process.argv.slice(2)) {',
    '    if (arg[0] != \'-\') {',
    '        if (!input) {',
    '            input = arg;',
    '        } else {',
    '            console.log(\'error: input redefined:\', arg);',
    '            process.exit(1);',
    '        }',
    '    }',
]
checkcode = []
helpmsg = []
helpmsg.append('Usage: qlx [OPTIONS...] <input> [-o<output>]')
for opt in options.keys():
    paddng = " " * (4 + longest_name + 2) + "   "
    helplines = options[opt].splitlines()
    needs = []
    tsiface.append(f'    {mapname(opt)}: boolean')
    while helplines[0][0] == '[':
        tag = helplines[0][1:].split('] ')[0]
        helplines[0] = helplines[0][3 + len(tag):]
        needs.append('-f' + tag)
        checkcode.append(f'if (options.{mapname(opt)} && !options.{mapname(tag)}) _printHelpMessage();')
    if len(needs) != 0:
        if len(needs) == 1:
            helplines.append(f'\\x1b[1mNeeds\\x1b[0m {needs[0]}')
        else:
            helplines.append(f'\\x1b[1mNeeds\\x1b[0m {", ".join(needs[:-1])} and {needs[-1]}')

    helpmsg.append("    -f" + opt + " " * (longest_name - len(opt)) + " - " + helplines[0])
    for i in range(1, len(helplines)):
        helpmsg.append(paddng + helplines[i])
    parsecode.append(f'    else if (arg == \'-f{opt}\') options.{mapname(opt)} = true; ')
    struct.append(f'    {mapname(opt)}: false,')

tsiface.append('}')
struct.append('}')
with open('src/options.ts', 'w') as optionfile:
    optionfile.write('\n'.join(tsiface))
parsecode.append('    else if (arg.startsWith(\'-o\') && arg.length > 2) output = arg.slice(2)')
parsecode.append('    else {')
parsecode.append('        console.log(\'error: unknown argument:\', arg);')
parsecode.append('        process.exit(1);')
parsecode.append('    }')
parsecode.append('}')
parsecode.append('function _printHelpMessage() {')
for line in helpmsg:
    parsecode.append(f'    console.log("{line}");')
parsecode.append('    process.exit(1);')
parsecode.append('}')
for chkval in checkcode:
    parsecode.append(chkval)
parsecode.append('if (!input) _printHelpMessage();')
parsecode.append('onCLIParseComplete(options, input!, output);')

print('\n'.join([
    'import { onCLIParseComplete } from \'./cli\';',
    *struct,
    *parsecode
]))

