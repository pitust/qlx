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
import { optimize, orderBlocks } from './optimizer'

function immref(arg: OpArg): string {
    if (typeof arg == 'number') return `${arg}`
    if (typeof arg == 'string') return JSON.stringify(arg)
    if ('reg' in arg) return `_main::_init::r${arg.reg}`
    if ('glob' in arg) return `_main::_globals::${arg.glob}`
    if ('blox' in arg) return arg.blox
    console.log(`error: no rtti support rn!`)
    process.exit(2)
}

export function generateCode(unit: SSAUnit, writeCode: (s: string) => void) {
    const afterBlock = new Map<SSABlock, SSABlock>()
    let blocks = orderBlocks(unit.blocks, unit.startBlock)
    // run optimization passes 8 times
    for (let i = 0;i < 8;i++) blocks = optimize(unit, blocks)
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
    for (const blk of blocks) {
        const id = blookup(blk)
        code.push(`_main::_init.${id}:`)
        for (const op of blk.ops) {
            if (options.interleaveSsa)
                code.push(
                    `    # ${Opcode[op.op]} ${op.args
                        .map(e => inspect(e, { breakLength: Infinity }))
                        .join(' ')}`
                )
            if (op.op == Opcode.TypeGlob || op.op == Opcode.TypeLoc) {
            } else if (op.op == Opcode.StGlob) {
                if (typeof op.args[1] == 'object' && 'reg' in op.args[1])
                    console.log(`warn: reverse binding for globals should occur!`)
                code.push(`    set _main::_globals::${op.args[0]} ${immref(op.args[1])}`)
            } else if (op.op == Opcode.Move) {
                code.push(`    set ${immref(op.args[0])} ${immref(op.args[1])}`)
            } else if (op.op == Opcode.LdGlob) {
                if (typeof op.args[1] == 'object' && 'reg' in op.args[1])
                    console.log(`warn: forward loadbinding for globals should occur!`)
                code.push(`    set ${immref(op.args[0])} _main::_globals::${op.args[1]}`)
            } else if (op.op == Opcode.BinOp) {
                code.push(
                    `    op ${op.args[1]} ${immref(op.args[0])} ${immref(op.args[2])} ${immref(
                        op.args[3]
                    )}`
                )
            } else if (op.op == Opcode.TargetOp) {
                const ops = {
                    'print.direct': () => `print ${op.args[1]}`,
                    'print.ref': () => `print ${immref(op.args[1])}`,
                    'print.flush': () => `printflush ${immref(op.args[1])}`,
                    _lookupblox: () => `set ${immref(op.args[1])} ${op.args[2]}`,
                }
                if (!(<string>op.args[0] in ops)) console.log('op:', op.args[0])
                code.push(`    ${ops[<keyof typeof ops>op.args[0]]()}`)
            } else if (op.op == Opcode.End) {
                if (
                    options.noEnd &&
                    blocks[blocks.length - 1] == blk &&
                    blk.cond == JumpCond.Abort
                ) {
                    continue
                }
                code.push(`    end`)
                break
            } else {
                console.log(`error: unknown op:`, Opcode[op.op], ...op.args)
                process.exit(2)
            }
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
                const target = `_main::_init.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(`    jump ${target}`)
            } else code.push(`    # falls through`)
        } else if (blk.cond == JumpCond.TestBoolean) {
            if (!hasCons) {
                const target = `_main::_init.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(`    jump ${target} notEqual 0 ${immref(blk.condargs[0])} # consequent`)
            } else {
                code.push(`    # consequent (eliminated)`)
            }
            if (!hasAlt) {
                const target = `_main::_init.${blookup(blk.targets[1])}`
                usedlabels.add(target)
                code.push(`    jump ${target} equal 0 ${immref(blk.condargs[0])} # alternate`)
            } else {
                code.push(`    # alternate (eliminated)`)
            }
        } else if (blk.cond == JumpCond.Abort) {
            if (!options.noSafeAbort) code.push(`    op sub @counter @counter 1 # abort`)
            else code.push(`    # abort!`)
        } else {
            code.push(`    # branch: ${JumpCond[blk.cond]}`)
        }
    }
    if (options.stripComments) {
        code = code.map(line => line.split('#')[0]).filter(e => e.trim())
    }
    if (options.eliminateBranches) {
        code = code.filter(e => !(e.endsWith(':') && !usedlabels.has(e.slice(0, -1))))
    }
    writeCode(code.join('\n'))
}
