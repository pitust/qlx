import { options, JumpCond, OpArg, Opcode, PrimitiveType, SSABlock, SSAUnit, Type } from './middlegen'

enum BranchFlags {
    Yes =           0x0001,
    No =            0x0002,
    Both =          0x0003,
    AlwaysBranch =  0x0004,
    Terminate =     0x0010,
    TermUnchecked = 0x0110,
    TermChecked =   0x0120,
}

const branchFlags = new WeakMap<SSABlock, BranchFlags>()

// reorder blocks to maximize fallthrough savings
function orderBlocks(blocks: Set<SSABlock>, b0: SSABlock, afterBlock: Map<SSABlock, SSABlock>): SSABlock[] {
    const order: SSABlock[] = []
    if (options.reorderBlocks) {
        const bset = new Set(blocks.keys())
        order.push(b0)
        bset.delete(b0)
        while (bset.size) {
            const blockHeat = new Map<SSABlock, number>([...blocks.values()].map(e => [e, 0]))
            for (const b of blocks) {
                for (const t of b.targets) blockHeat.set(t, blockHeat.get(t) + 1)
            }
            const t = order[order.length - 1].targets.filter(e => bset.has(e))
            if (t.length == 0) {
                const b = <SSABlock>bset.keys().next().value
                bset.delete(b)
                order.push(b)
                continue
            }
            if (t.length == 1) {
                bset.delete(t[0])
                order.push(t[0])
                continue
            }
            if (blockHeat.get(t[0]) > blockHeat.get(t[1])) {
                bset.delete(t[0])
                order.push(t[0])
            } else {
                bset.delete(t[1])
                order.push(t[1])
            }
        }
    } else {
        const bset = new Set(blocks.keys())
        order.push(b0)
        bset.delete(b0)
        while (bset.size) {
            const t = order[order.length - 1].targets.filter(e => bset.has(e))
            if (t.length == 0) {
                const b = <SSABlock>bset.keys().next().value
                bset.delete(b)
                order.push(b)
                continue
            }
            for (const k of t) {
                bset.delete(k)
                order.push(k)
            }
        }
    }
    for (let i = 1;i < order.length;i++) afterBlock.set(order[i], order[i-1])
    return order
}

function immref(arg: OpArg): string {
    if (typeof arg == 'number') return `${arg}`
    if (typeof arg == 'string') return JSON.stringify(arg)
    if ('reg' in arg) return `_main::_init::r${arg.reg}`
    console.log(`error: no rtti support rn!`)
    process.exit(2)
}
export function generateCode(unit: SSAUnit) {
    const afterBlock = new Map<SSABlock, SSABlock>()
    const blocks = orderBlocks(unit.blocks, unit.startBlock, afterBlock)
    const code = []
    const genid = (i => () => `b_${i++}`)(0)
    const bnames = new Map<SSABlock, string>()
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
            if (op.op == Opcode.TypeGlob || op.op == Opcode.TypeLoc) {
            } else if (op.op == Opcode.StGlob) {
                if (typeof op.args[1] == 'object' && 'reg' in op.args[1]) console.log(`warn: reverse binding for globals should occur!`)
                code.push(`    set _main::_globals::${op.args[0]} ${immref(op.args[1])}`)
            } else if (op.op == Opcode.LdGlob) {
                if (typeof op.args[1] == 'object' && 'reg' in op.args[1]) console.log(`warn: forward loadbinding for globals should occur!`)
                code.push(`    set ${immref(op.args[0])} _main::_globals::${op.args[1]}`)
            } else if (op.op == Opcode.BinOp) {
                code.push(`    op ${op.args[1]} ${immref(op.args[0])} ${immref(op.args[2])} ${immref(op.args[3])}`)
            } else if (op.op == Opcode.TargetOp) {
                const ops = {
                    'print.direct': () => `print ${op.args[1]}`,
                    'print.ref': () => `print ${immref(op.args[1])}`,
                    'print.flush': () => `printflush ${immref(op.args[1])}`,
                    '_lookupblox': () => `set ${immref(op.args[1])} ${op.args[2]}`,
                }
                if (!(op.args[0] in ops)) console.log('op:', op.args[0])
                code.push(`    ${ops[op.args[0]]()}`)
            } else if (op.op == Opcode.End) {
                code.push(`    end`)
            } else {
                console.log(`error: unkown op:`, Opcode[op.op], ...op.args)
                process.exit(2)
            }
        }
        const hasCons = blk.targets.length > 0 && afterBlock.get(blk.targets[0]) == blk
        const hasAlt = blk.targets.length > 1 && afterBlock.get(blk.targets[1]) == blk
        if (blk.cond == JumpCond.Always) {
            code.push(`    jump _main::_init.${blookup(blk.targets[0])}`)
        } else if (blk.cond == JumpCond.TestBoolean) {
            if (hasCons) code.push(`    jump _main::_init.${blookup(blk.targets[0])} notEqual 0 ${immref(blk.condargs[0])} # consequent`)
            else code.push(`    # consequent eliminated`)
            if (hasAlt) code.push(`    jump _main::_init.${blookup(blk.targets[0])} equal 0 ${immref(blk.condargs[0])} # alternate`)
            else code.push(`    # alternate eliminated`)
        } else if (blk.cond == JumpCond.Abort) {
            code.push(`    op sub @counter @counter 1 # abort`) // TODO: if -fno-safe-abort is passed, this should be removed
        } else {
            code.push(`    # branch: ${JumpCond[blk.cond]}`)
        }
    }
    console.log(code.join('\n'))
}
