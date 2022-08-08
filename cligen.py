
options = {
    'bind-loads': 'Bind registers to locals when loaded',
    'const-prop': 'Propagate constants accross the code',
    'eliminate-branches': 'Eliminate branches in cases where fallthrough is enough',
    'eliminate-dead-code': 'Eliminate some dead instructions.',
    'forward': 'Forward moves when used once',
    'inline': '[raw-arg-refs] Inline small functions',
    'interleave-ssa': 'Interlave code and SSA opcodes',
    'merge-print': 'Merge sequential constant-value prints left by the optimizer',
    'merge-blocks': 'Merge blocks that must come after each other',
    'max': 'Enable as much opt stuff as possible',
    'no-end': '[no-safe-abort] Remove the last `end` opcode from the code',
    'no-safe-abort': 'Disable compiler-generated safety abort loops',
    'raw-arg-refs': 'Use raw argument references',
    'reorder-blocks': 'Use weighted block reordering, rather than sequential block order',
    'strip-comments': 'Strip comments from the output to save on lines',
    
    'gen2': 'Enable WIP gen2 code generation, in preparation for machine code',
    'prg': 'Enable experimental less-optimizing prg codegen (pretty reasonable codegen)',

    'frontend=modern': '[!frontend=qlxasm] Use the modern QLX frontend',
    'frontend=qlxasm': '[!frontend=modern] Use QLX as a fancy macro assembler',

    'dump=ast': 'Dump AST',
    'dump=prg-dfg': '[prg] Dump the PRG data-flow graph',
    'dump=prg-dfg-expandvars': '[dump=prg-dfg] Expand variables in PRG data-flow graph dumps',
    'dump=fresh-ssa': 'Dump initial SSA contents',
    'dump=ssa-pre-opt': 'Dump SSA before optimization',
    'dump=ssa-pre-emit': 'Dump final SSA to be emitted',
    'dump=native-graph-coloring': 'Dump native codegen graph coloring results',
    'cg-output=suppress': 'Do not output anything',
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

longest_name = 28

for nam in options.keys():
    longest_name = len(nam) + 2 if len(nam) + 2 > longest_name else longest_name

tsiface = [
    'export interface Options {',
    '    target: string'
]
struct = [
    'const options = {',
    '    target: \'none\','
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

targets = [
    ('mlog', []),
    ('native', [
        ('x86_64', []),
        ('aarch64', [])
    ])
]

checkcode = []
helpmsg = []
helpmsg.append('Usage: qlx [OPTIONS...] <input> [-o <output>]')
helpmsg.append('    --target <codegen>[,OPTION...]' + (' ' * (longest_name - 28)) + ' - Set the target to compile for. Nested targets are delimited with commas. Available targets:')
def print_target_tree(tip, depth):
    if len(tip[1]):
        helpmsg.append('    ' + ' ' * longest_name + '     ' + ' ' * depth + ' - ' + tip[0] + ':')
        for k in tip[1]: print_target_tree(k, depth + 2)
    else:
        helpmsg.append('    ' + ' ' * longest_name + '     ' + ' ' * depth + ' - ' + tip[0])
for k in targets: print_target_tree(k, 2)

for opt in options.keys():
    paddng = " " * (4 + longest_name + 2) + "   "
    helplines = options[opt].splitlines()
    needs = []
    conflicts = []
    tsiface.append(f'    {mapname(opt)}: boolean')
    while helplines[0][0] == '[':
        tag = helplines[0][1:].split('] ')[0]
        helplines[0] = helplines[0][3 + len(tag):]
        if tag[0] == '!':
            conflicts.append('-f' + tag[1:])
            checkcode.append(f'if (options.{mapname(opt)} && options.{mapname(tag[1:])}) _printHelpMessage();')
        else:
            needs.append('-f' + tag)
            checkcode.append(f'if (options.{mapname(opt)} && !options.{mapname(tag)}) _printHelpMessage();')
    if len(needs) != 0:
        if len(needs) == 1:
            helplines.append(f'\\x1b[1mNeeds\\x1b[0m {needs[0]}')
        else:
            helplines.append(f'\\x1b[1mNeeds\\x1b[0m {", ".join(needs[:-1])} and {needs[-1]}')
    if len(conflicts) != 0:
        if len(conflicts) == 1:
            helplines.append(f'\\x1b[1mConflicts with\\x1b[0m {conflicts[0]}')
        else:
            helplines.append(f'\\x1b[1mConflicts with\\x1b[0m {", ".join(conflicts[:-1])} and {conflicts[-1]}')

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
parsecode.append('if (!input || options.target == \'none\') _printHelpMessage();')
parsecode.append('onCLIParseComplete(options, input!, output);')

print('\n'.join([
    'import { onCLIParseComplete } from \'./cli\';',
    *struct,
    *parsecode
]))

