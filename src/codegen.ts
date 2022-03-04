import { inspect } from 'util'
import {
    options,
    JumpCond,
    OpArg,
    Opcode,
    PrimitiveType,
    SSABlock,
    SSAUnit,
    Type,
    dumpSSA,
} from './middlegen'
import { optimize, orderBlocks, calculateCost, calculateCounterCost, makeInliningChoice } from './optimizer'

const ri = '\x005'
const opc = '\x00+\x002'
const cond = '\x003'
const label = '\x00r\x003'
const glob = '\x00+\x002'
const nostyle = '\x00r'
const comment = '\x00r\x000'
const fmt = {
    assign: '\x00a',
    cflow: '\x00b',
    unit: '\x00c',
    blockio: '\x00d',
    rawio: '\x00e'
}
const selector = '\x00f'

const hlcolors = {
    kw: '\x00r\x005',
    imm: '\x00r\x003',
    ident: '\x00r\x004',
    operator: '\x00r\x001',
    number: '\x00r\x002',
}

const kw = [
    'fn',
    'do',
    'return',
    'true',
    'false',
    'printflush',
    'printf',
    'print',
    'getlink',
    'if',
    'else',
    'end',
    'use',
    'while',
    'switch',
    'case',
    'default',
    'let',
    'read',
    'seton',
]
const kwregex = new RegExp('\\b(' + kw.join('|') + ')\\b', 'g')
function highlight(k: string, hotrange = [0, 0]) {
    k = k
        .replaceAll(/"[^"]*"/g, re => '%s%' + re + '%S%')
        .replaceAll(/(?<=\s|^)[a-zA-Z_][a-zA-Z_0-9]*(?=\s|$)/g, id => '%i%' + id + '%r%')
        .replaceAll(/(?<=\s|^)[0-9]+(\.[0-9]*)?(?=\s|$)/g, id => '%n%' + id + '%r%')
        .replaceAll(/[\:\*\/\+\-=\.!<>]/g, id => '%o%' + id + '%r%')
        .replaceAll(/(?<=\s|^)@[a-zA-Z_][a-zA-Z_0-9]*(?=\s|$)/g, id => '%@%' + id + '%r%')
        .replaceAll(kwregex, kw => '%k%' + kw + '%r%')
        .replaceAll('%n%', hlcolors.number)
        .replaceAll('%i%', hlcolors.ident)
        .replaceAll('%@%', hlcolors.imm)
        .replaceAll('%k%', hlcolors.kw)
        .replaceAll('%o%', hlcolors.operator)
        .replaceAll('%r%', nostyle)
        .replaceAll('%s%', '\x01!+')
        .replaceAll('%S%', '\x01!-')
    
    // injector...
    let pos = 0
    let state = false
    let output = ''
    let mode = ''
    let is_str = false
    for (let i = 0;i < k.length;i++) {
        if (k[i] == '\x01' && k[i + 1] == '!') {
            if (k[i + 2] == '+') is_str = true
            if (k[i + 2] == '-') is_str = false
            i += 2
            mode = '3'
            if (is_str) output += hlcolors.imm
            else output += nostyle
            continue
        }
        if (k[i] == '\x00') {
            if (!is_str) output += k.slice(i, i + 2)
            i++
            if (!is_str) mode = k[i]
            if (state && k[i] == 'r') output += '\x00+'
            continue
        }
        if (pos >= hotrange[0] && pos < hotrange[0]+hotrange[1] && !state) {
            state = true
            output += '\x00r\x00+'
            if (mode) output += '\x00'+mode
        }
        if (pos >= hotrange[0]+hotrange[1] && state) {
            output += '\x00-\x00r'
            state = false
            if (mode) output += '\x00'+mode
        }
        if (k[i] == '{' && k[i+1] == '}' && is_str) {
            output += hlcolors.ident + '{}' + hlcolors.imm
            pos += 2
            i++
            continue
        }
        pos += 1
        output += k[i]
    }
    return output
}

const optimizedFunctionBlocks = new Map<string, SSABlock[]>()
const inliningCost = new Map<string, number>()
const inliningCounterCost = new Map<string, number>()
const functionCallReferenceSet = new Set<string>()
function generateUnit(mod: string, fn: string, unit: SSAUnit, writeCode: (s: string) => void) {
    function immref(arg: OpArg): string {
        if (typeof arg == 'number') return `${ri}${arg}${nostyle}`
        if (typeof arg == 'string') return ri + JSON.stringify(arg) + nostyle
        if ('reg' in arg) return `${ri}r${arg.reg}${nostyle}`
        if ('arg' in arg) return `${ri}arg-${arg.arg}.${mod}::${fn}${nostyle}`
        if ('glob' in arg) return `${glob}${mod}::_init::${arg.glob}${nostyle}`
        if ('blox' in arg) return glob + arg.blox + nostyle
        console.log(`error: no rtti support rn!`)
        process.exit(2)
    }

    const afterBlock = new Map<SSABlock, SSABlock>()
    let blocks = orderBlocks(unit.blocks, unit.startBlock)
    inliningCounterCost.set(`${mod}::${fn}`, calculateCounterCost(blocks))
    // run optimization passes 8 times
    for (let i = 0;i < 8;i++) blocks = optimize(unit, blocks, tfn => {
        const choice = makeInliningChoice(inliningCost.get(`${mod}::${tfn}`), inliningCounterCost.get(`${mod}::${tfn}`))
        console.log(`inlining choice for: inline[${tfn} into ${fn}]:`, choice)
        return choice
    }, tfn => {
        return optimizedFunctionBlocks.get(`${mod}::${tfn}`)
    })
    inliningCost.set(`${mod}::${fn}`, calculateCost(blocks))
    optimizedFunctionBlocks.set(`${mod}::${fn}`, blocks)
    if (options.dumpSsa) {
        dumpSSA(unit, blocks)
        return
    }
    let code: string[] = []
    const genid = (
        i => () =>
            `b_${i++}`
    )(0)
    for (let i = 1; i < blocks.length; i++) afterBlock.set(blocks[i], blocks[i - 1])
    const bnames = new Map<SSABlock, string>()
    const usedlabels = new Set<string>()
    bnames.set(unit.startBlock, 'entry')
    function blookup(blk: SSABlock) {
        const id = bnames.has(blk) ? bnames.get(blk)! : genid()
        bnames.set(blk, id)
        return id
    }
    let programLongestOpcode = 4
    for (const blk of blocks) {
        const id = blookup(blk)
        code.push(`${label}${mod}::${fn}.${id}${nostyle}:`)
        for (const op of blk.ops) {
            let watermark = code.length
            if (options.interleaveSsa)
                code.push(
                    `    # ${opc}${Opcode[op.op]}${nostyle} ${op.args
                        .map(e => inspect(e, { breakLength: Infinity }))
                        .join(' ')}`
                )
            if (op.op == Opcode.TypeGlob || op.op == Opcode.TypeLoc) {
            } else if (op.op == Opcode.StGlob || op.op == Opcode.StInitGlob) {
                code.push(`    ${fmt.assign}set ${glob}${mod}::_init::${op.args[0]}${nostyle} ${immref(op.args[1])}`)
            } else if (op.op == Opcode.Move) {
                code.push(`    ${fmt.assign}set${nostyle} ${immref(op.args[0])} ${immref(op.args[1])}`)
            } else if (op.op == Opcode.BindArgument) {
                code.push(`    ${fmt.assign}set${nostyle} ${glob}${mod}::${fn}::${op.args[0]} ${nostyle}${ri}arg-${op.args[1]}.${mod}::${fn}${nostyle}`)
            } else if (op.op == Opcode.Call) {
                for (let i = 0;i < op.args.length - 2;i++) {
                    code.push(`    ${fmt.assign}set ${ri}arg-${i}.${mod}::${op.args[1]}${nostyle} ${immref(op.args[i+2])}`)
                }
                code.push(`    ${fmt.assign}op ${selector}add ${ri}lr.${mod}::${op.args[1]} ${selector}@counter ${ri}2${nostyle}`)
                code.push(`    ${fmt.assign}jump ${selector}always ${label}fn.${mod}::${op.args[1]}${nostyle}`) 
                functionCallReferenceSet.add(`${mod}::${op.args[1]}`)
            } else if (op.op == Opcode.LdGlob) {
                code.push(`    ${fmt.assign}set${nostyle} ${immref(op.args[0])} ${label}${mod}::_init::${op.args[1]}${nostyle}`)
            } else if (op.op == Opcode.LdLoc) {
                code.push(`    ${fmt.assign}set${nostyle} ${immref(op.args[0])} ${label}${mod}::${fn}::${op.args[1]}${nostyle}`)
            } else if (op.op == Opcode.BinOp) {
                code.push(
                    `    ${fmt.assign}op ${selector}${op.args[1]}${nostyle} ${immref(op.args[0])} ${immref(op.args[2])} ${immref(
                        op.args[3]
                    )}`
                )
            } else if (op.op == Opcode.TargetOp) {
                const ops = {
                    'print.direct': () => `${fmt.rawio}print ${ri}${op.args[1]}${nostyle}`,
                    'print.ref': () => `${fmt.rawio}print${nostyle} ${immref(op.args[1])}`,
                    'print.flush': () => `${fmt.rawio}printflush${nostyle} ${immref(op.args[1])}`,
                    _lookupblox: () => `${fmt.assign}set${nostyle} ${immref(op.args[1])} ${op.args[2]}`,
                }
                if (!(<string>op.args[0] in ops)) console.log('op:', op.args[0])
                code.push(`    ${ops[<keyof typeof ops>op.args[0]]()}`)
            } else if (op.op == Opcode.ReturnVoid) {
                code.push(`    ${fmt.cflow}set ${selector}@counter ${ri}lr.${mod}::${fn}${nostyle}`)
            } else if (op.op == Opcode.End) {
                if (
                    options.noEnd &&
                    blocks[blocks.length - 1] == blk &&
                    blk.cond == JumpCond.Abort
                ) {
                    continue
                }
                code.push(`    ${fmt.cflow}end${nostyle}`)
            } else if (op.op == Opcode.Function) {
                // `Function` is a typechecker hint.
            } else {
                console.log(`error: unknown op:`, Opcode[op.op], ...op.args)
                process.exit(2)
            }
            for (let i = watermark; i < code.length; i++) {
                programLongestOpcode = Math.max(code[i].replaceAll(/\x00./g, '').length + 4, programLongestOpcode)
                code[i] += ' #@@ ' + op.pos + '  \t'
                if (op.meta) code[i] += '| ' + nostyle + highlight(op.meta.line, op.meta.range)
            }
            if ([Opcode.Return, Opcode.ReturnVoid, Opcode.End].includes(op.op)) break
        }
        if (options.interleaveSsa)
            code.push(
                `    # ${JumpCond[blk.cond]} ${blk.condargs
                    .map(e => inspect(e, { breakLength: Infinity }))
                    .join(' ')}`
            )
        const hasCons =
            options.eliminateBranches &&
            blk.targets.length > 0 &&
            afterBlock.get(blk.targets[0]) == blk
        const hasAlt =
            options.eliminateBranches &&
            blk.targets.length > 1 &&
            afterBlock.get(blk.targets[1]) == blk
        if (blk.cond == JumpCond.Always) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(`    ${fmt.cflow}jump ${label}${target}${nostyle}`)
            } else code.push(`    ${comment}# falls through`)
        } else if (blk.cond == JumpCond.AlwaysNoMerge) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(`    ${fmt.cflow}jump ${label}${target} ${comment}# ${ri}note: this should never happen!`)
            } else code.push(`    ${comment}# (call block falls through)`)
        } else if (blk.cond == JumpCond.TestBoolean) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(`    ${fmt.cflow}jump ${label}${target} ${selector}notEqual${nostyle} 0 ${immref(blk.condargs[0])} ${comment}# consequent`)
            }
            if (!hasAlt) {
                const target = `${mod}::${fn}.${blookup(blk.targets[1])}`
                usedlabels.add(target)
                code.push(`    ${fmt.cflow}jump ${label}${target} ${selector}equal${nostyle} 0 ${immref(blk.condargs[0])} ${comment}# alternate`)
            }
        } else if (blk.cond == JumpCond.Equal) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(`    ${fmt.cflow}jump ${label}${target} ${selector}equal${nostyle} ${immref(blk.condargs[0])} ${immref(blk.condargs[1])} ${comment}# consequent`)
            }
            if (!hasAlt) {
                const target = `${mod}::${fn}.${blookup(blk.targets[1])}`
                usedlabels.add(target)
                code.push(`    ${fmt.cflow}jump ${label}${target} ${selector}notEqual${nostyle} ${immref(blk.condargs[0])} ${immref(blk.condargs[1])} ${comment}# alternate`)
            }
        } else if (blk.cond == JumpCond.Abort) {
            if (!options.noSafeAbort) code.push(`    ${fmt.assign}op ${selector}sub @counter @counter ${ri}1 ${comment}# abort`)
            else code.push(`    ${comment}# abort!`)
        } else {
            code.push(`    ${comment}# ${fmt.rawio}TODO${comment}: branch: ${JumpCond[blk.cond]}`)
        }
    }
    for (let i = 0; i < code.length; i++) {
        const tbl = code[i].split(' #@@ ')
        if (tbl.length == 1) continue
        const lol = tbl.slice(0, -1).join(' #@@ ')
        const lolcount = lol.match(/\x00./g).length
        code[i] = lol.padEnd(programLongestOpcode + lolcount * 2) + comment + '# ' + tbl.slice(-1)[0] + nostyle
    }
    if (options.stripComments) {
        code = code.map(line => line.split('#')[0]).filter(e => e.replaceAll(/\x00./g, '').trim())
    }
    if (options.eliminateBranches) {
        code = code.filter(e => !(e.endsWith(':') && !usedlabels.has(e.slice(4, -3))))
    }
    const colormap = {
        r: '\x1b[0m',
        '+': '\x1b[1m',
        '-': '\x1b[2m',
        '0': '\x1b[30m',
        '1': '\x1b[31m',
        '2': '\x1b[32m',
        '3': '\x1b[33m',
        '4': '\x1b[34m',
        '5': '\x1b[35m',
        '6': '\x1b[36m',
        '7': '\x1b[37m',
        a: '\x1b[0;35m', // assign
        b: '\x1b[0;34m', // cflow
        // unit: '\x00c',
        // blockio: '\x00d',
        e: '\x1b[0;31m', // rawio
        f: '\x1b[0;36m', // selector
    }
    writeCode(code.join('\n').replaceAll(/\0(.)/g, (_, mode) => {
        if (process.env.QLXCOLOR == 'on') {
            if (mode in colormap) return colormap[mode]
            return '{' + mode + '}'
        } else if (process.env.QLXCOLOR == 'debug') {
            return '{' + mode + '}'
        } else {
            return ''
        }
    }))
}
export function generateCode(units: [SSAUnit, Map<string, SSAUnit>], writeCode: (s: string) => void) {
    let buf = [
        process.env.QLXCOLOR == 'on' ? '    \x1b[0;30m# compiled by qlx\x1b[0m' : '    # compiled by qlx'
    ]
    
    // const argc = units[0].startBlock.ops.filter(e => e.op == Opcode.BindArgument).length
    const refcounts = new Map<string, number>()
    for (const [nm] of units[1]) refcounts.set(nm, 0)
    
    for (const [nm, u] of units[1]) {
        for (const blk of u.blocks) {
            for (const op of blk.ops) {
                const tgd = `${op.args[1]}`
                if (op.op == Opcode.Call) refcounts.set(tgd, refcounts.get(tgd)+1)
            }
        }
    }
    
    let buffers = new Map<string, string[]>()
    for (const [nm, u] of units[1]) {
        let buf1 = []
        buffers.set(`_main::${nm}`, buf1)
        buf1.push(process.env.QLXCOLOR == 'on' ? `\x1b[0;33mfn._main::${nm}\x1b[0m:` : `fn._main::${nm}:`)
        generateUnit('_main', nm, u, code => {
            buf1.push(code)
        })
    }
    generateUnit('_main', '_init', units[0], code => {
        buf.push(code)
    })
    for (const u of functionCallReferenceSet) buf.push(...buffers.get(u))
    writeCode(buf.join('\n'))
}


