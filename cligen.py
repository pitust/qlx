
options = {
    'bind-loads': 'bind registers to locals when loaded',
    'const-prop': 'propagate constants accross the code',
    'eliminate-branches': 'eliminate branches in cases where fallthrough is enough',
    'eliminate-dead-code': 'eliminate some dead instructions.',
    'forward': 'forward moves when used once',
    'inline': '[raw-arg-refs] inline small functions',
    'interleave-ssa': 'interlave code and SSA opcodes',
    'merge-print': 'merge sequential constant-value prints left by the optimizer',
    'merge-blocks': 'merge blocks that must come after each other',
    'max': 'enable as much opt stuff as possible',
    'no-end': '[no-safe-abort] remove the last `end` opcode from the code',
    'no-safe-abort': 'disable compiler-generated safety abort loops',
    'raw-arg-refs': 'use raw argument references',
    'reorder-blocks': 'use weighted block reordering, rather than sequential block order',
    'strip-comments': 'strip comments from the output to save on lines',
    
    'gen2': 'Enable WIP gen2 code generation, in preparation for machine code',
    'prg': 'Enable experimental less-optimizing prg codegen (pretty reasonable codegen)',

    'dump=ast': 'dump AST',
    'dump=prg-dfg': '[prg] dump the PRG data-flow graph',
    'dump=prg-dfg-expandvars': '[dump=prg-dfg] expand variables in PRG data-flow graph dumps',
    'dump=fresh-ssa': 'dump initial SSA contents',
    'dump=ssa-pre-opt': 'dump SSA before optimization',
    'dump=ssa-pre-emit': 'dump final SSA to be emitted',
    'cg-output=suppress': 'do not output anything',
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
    return ''.join(data).replace('=', '_')

longest_name = 0

for nam in options.keys():
    longest_name = len(nam) + 2 if len(nam) + 2 > longest_name else longest_name

tsiface = [
    'export interface Options {',
    '    target: string'
]
struct = [
    'const options = {',
    '    target: \'default\','
]
parsecode = [
    'let input = null;',
    'let output = null;',
    'if (process.argv.includes(\'-h\') || process.argv.includes(\'--help\')) {',
    '    _printHelpMessage();',
    '}',
    'let isNextTarget = false',
    'for (let arg of process.argv.slice(2)) {',
    '    if (arg[0] != \'-\' && !isNextTarget) {',
    '        if (!input) {',
    '            input = arg;',
    '            continue;',
    '        } else {',
    '            console.log(\'error: input redefined:\', arg);',
    '            process.exit(1);',
    '        }',
    '    }',
    '    if (arg == \'--target\') { isNextTarget = true; continue; }',
    '    if (arg.startsWith(\'--target=\')) { arg = arg.slice(9); isNextTarget = true; }',
    '    if (isNextTarget) { isNextTarget = false; options.target = arg; continue; }'
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

