import {
    options,
    SSAUnit,
    SSABlock,
    SSAOp,
    Opcode,
    OpArg,
    Cond,
    JumpCond,
    dumpSSA,
} from './middlegen'

// reorder blocks to maximize fallthrough savings
export function orderBlocks(blocks: Set<SSABlock>, b0: SSABlock): SSABlock[] {
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
                const be = <SSABlock>order.find(e => e.targets.filter(e => bset.has(e)).length)
                if (!be) break
                const t = be.targets.filter(e => bset.has(e))[0]
                bset.delete(t)
                order.push(t)
                continue
            }
            if (t.length == 1) {
                bset.delete(t[0])
                order.push(t[0])
                continue
            }
            if (blockHeat.get(t[0]) < blockHeat.get(t[1])) {
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
    return order
}

function findall(blocks: SSABlock | SSABlock[], pred: (o: SSAOp, b: SSABlock) => boolean) {
    const output: { op: SSAOp; blk: SSABlock }[] = []
    for (const blk of [blocks].flat()) {
        for (const op of blk.ops) {
            if (pred(op, blk)) output.push({ op, blk })
        }
    }
    return output
}
function findcond(blocks: SSABlock | SSABlock[], pred: (c: Cond, b: SSABlock) => boolean) {
    const output: { cond: Cond; blk: SSABlock }[] = []
    for (const blk of [blocks].flat()) {
        const cond = { cond: blk.cond, args: blk.condargs }
        if (pred(cond, blk)) output.push({ cond, blk })
    }
    return output
}
function findallblk(blocks: SSABlock | SSABlock[], pred: (o: SSAOp, b: SSABlock) => boolean) {
    const output: SSABlock[] = []
    forloop: for (const blk of [blocks].flat()) {
        for (const op of blk.ops) {
            if (pred(op, blk)) {
                output.push(blk)
                continue forloop
            }
        }
    }
    return output
}
function usesreg(o: SSAOp, r: number): 'load' | 'store' | false {
    if (reg(o.args[0]) == r) return 'store'
    for (const arg of o.args) {
        if (reg(arg) == r) return 'load'
    }
    return false
}
function usesfor(o: SSAOp | Cond, r: number, level: 'load' | 'ldst' | 'store'): boolean {
    let keyslot = 0
    if ('op' in o && o.op == Opcode.TargetOp) keyslot = o.args[0] == '_lookupblox' ? 1 : -1
    if ('cond' in o) keyslot = -1
    if (level != 'load' && reg(o.args[keyslot]) == r) return true
    if (level == 'store') return false
    for (const arg of o.args) {
        if (reg(arg) == r) return true
    }
    return false
}
function remap_args(
    select: 'all' | 'store' | 'load',
    op: SSAOp,
    pred: (op: OpArg) => OpArg | null
) {
    op.args = op.args.map((arg, idx) => {
        if (idx != 0 && select == 'store') return arg
        if (idx == 0 && select == 'load') return arg
        return pred(arg) ?? arg
    })
}
function reg(arg: OpArg): number | null {
    if (typeof arg == 'object' && 'reg' in arg) return arg.reg
    return null
}
function str(arg: OpArg): string | null {
    if (typeof arg == 'string') return arg
    return null
}

function eliminateDeadCode(blocks: SSABlock[]) {
    for (const match of findall(blocks, op => op.op == Opcode.LdGlob || op.op == Opcode.Move)) {
        const r = reg(match.op.args[0])
        if (!r) continue

        // if there is one use of our register...
        if (findall(blocks, op => usesfor(op, r, 'ldst')).length != 1) continue

        // and no use in conds...
        if (findcond(blocks, cond => usesfor(cond, r, 'ldst')).length) continue

        // then remove this opcode
        match.blk.ops = match.blk.ops.filter(op => match.op != op)
    }
    for (const match of findall(blocks, op => op.op == Opcode.StGlob)) {
        const tgd = str(match.op.args[0])
        if (!tgd) continue

        // if nobody uses this global...
        if (
            findall(blocks, op => {
                if (op.args.find(e => typeof e == 'object' && 'glob' in e && e.glob == tgd))
                    return true
                if (op.op == Opcode.LdGlob) return op.args[0] == tgd
                return false
            }).length
        )
            continue

        // then remove this opcode
        match.blk.ops = match.blk.ops.filter(op => match.op != op)
    }
}
function bindLoads(blocks: SSABlock[]) {
    for (const match of findall(blocks, op => op.op == Opcode.LdGlob)) {
        const r = reg(match.op.args[0])
        const tgd = str(match.op.args[1])
        if (!r || !tgd) continue

        // if we are the only place someone stores to the target reg...
        if (findall([match.blk], op => usesfor(op, r, 'store')).length != 1) continue

        // and there are no global stores to this global in the current block...
        if (findall([match.blk], op => op.op == Opcode.StGlob && op.args[1] == tgd).length) continue

        // then, until the end of the block or to a function call, substitute the register to a global ref
        for (const op of match.blk.ops) {
            remap_args('load', op, arg => reg(arg) && reg(arg) == r && { glob: tgd })
            if (op.op == Opcode.Call) break // yeah calls break this optimization
        }
    }
    for (const match of findall(blocks, op => op.op == Opcode.LdGlob)) {
        const r = reg(match.op.args[0])
        const tgd = str(match.op.args[1])
        if (!r || !tgd) continue

        // if there is one use of our register...
        if (findall(blocks, op => usesfor(op, r, 'ldst')).length != 1) continue

        // and no use in conds...
        if (findcond(blocks, cond => usesfor(cond, r, 'ldst')).length) continue

        // then remove this opcode
        match.blk.ops = match.blk.ops.filter(op => match.op != op)
    }
    for (const match of findall(
        blocks,
        op => op.op == Opcode.TargetOp && op.args[0] == '_lookupblox'
    )) {
        const r = reg(match.op.args[1])
        const tgd = str(match.op.args[2])
        if (!r || !tgd) continue

        // tgd must be a ref for this all to work:
        if (!/^[a-zA-Z]+[1-9][0-9]*$/.test(tgd)) continue

        // if there are two usage (one us and one target) of this match...
        if (findall(blocks, op => usesfor(op, r, 'ldst')).length != 2) continue

        // and there is no branch condition testing for this...
        if (findcond(blocks, cond => usesfor(cond, r, 'ldst')).length) continue

        // then we can forward it into a blox!
        const m = findall(blocks, op => usesfor(op, r, 'ldst') && op != match.op)[0]
        remap_args('load', m.op, arg => reg(arg) && reg(arg) == r && { blox: tgd })

        // also, we can remove the opcode
        match.blk.ops = match.blk.ops.filter(op => match.op != op)
    }
}
function getParentSet(blocks: SSABlock[]): Map<SSABlock, Set<SSABlock>> {
    const m = new Map<SSABlock, Set<SSABlock>>()

    for (const b of blocks) m.set(b, new Set<SSABlock>())
    for (const b of blocks) {
        for (const t of b.targets) {
            m.get(t).add(b)
        }
    }

    return m
}
function propagateConstants(blocks: SSABlock[]): boolean {
    let replaced: boolean = false
    const parentsets = getParentSet(blocks)
    const gmap = new Map<SSABlock, Map<string, number>>()
    for (const blk of blocks) {
        const constantValues = new Map<number, number>()
        const constantGlobals = new Map<string, number>()
        try_to_block_prop: do {
            let shouldIntersect = false
            for (const s of parentsets.get(blk)) {
                if (!gmap.has(s)) {
                    constantGlobals.clear()
                    break try_to_block_prop
                }
                if (shouldIntersect) {
                    for (const [k, v] of gmap.get(s)) {
                        if (constantGlobals.get(k) != v) constantGlobals.delete(k)
                    }
                } else {
                    for (const [k, v] of gmap.get(s)) constantGlobals.set(k, v)
                }
            }
        } while (false)

        const tryexpand = (arg: OpArg) => {
            if (typeof arg == 'number') return arg
            if (reg(arg) && constantValues.get(reg(arg))) return constantValues.get(reg(arg))
            return null
        }
        const replacementStream: SSAOp[] = []
        for (const op of blk.ops) {
            replacementStream.push(op)
            const replace = (op: SSAOp) => {
                replacementStream[replacementStream.length - 1] = op
                replaced = true
            }
            if (op.op == Opcode.StGlob && typeof op.args[1] == 'number') {
                constantGlobals.set(str(op.args[0])!, op.args[1])
            }
            if (op.op == Opcode.Move && typeof op.args[1] == 'number') {
                constantValues.set(reg(op.args[0])!, op.args[1])
            }
            if (
                op.op == Opcode.LdGlob &&
                typeof op.args[1] == 'string' &&
                constantGlobals.has(op.args[1])
            ) {
                const r = reg(op.args[0])
                if (r) constantValues.set(r, constantGlobals.get(op.args[1]))
            }
            if (op.op == Opcode.BinOp) {
                const out = reg(op.args[0])
                const left = tryexpand(op.args[2])
                const right = tryexpand(op.args[3])
                if (!out || left === null || right === null) continue
                if (op.args[1] == 'notEqual') {
                    if (left != right) constantValues.set(out, 1)
                    else constantValues.set(out, 0)
                    replace({
                        op: Opcode.Move,
                        args: [{ reg: out }, constantValues.get(out)],
                    })
                }
            }
            if (op.op == Opcode.TargetOp) {
                op.args = op.args.map(arg => {
                    if (typeof arg == 'object' && reg(arg) && constantValues.has(reg(arg))) {
                        replaced = true
                        return constantValues.get(reg(arg))
                    }
                    if (typeof arg == 'object' && 'glob' in arg && constantGlobals.has(arg.glob)) {
                        replaced = true
                        return constantGlobals.get(arg.glob)
                    }
                    return arg
                })
            }
        }
        blk.ops = replacementStream
        if (
            blk.cond == JumpCond.TestBoolean &&
            reg(blk.condargs[0]) &&
            constantValues.has(reg(blk.condargs[0]))
        ) {
            blk.cond = JumpCond.Always
            blk.targets = [blk.targets[+(constantValues.get(reg(blk.condargs[0])) > 0)]]
            blk.condargs = []
        }
        gmap.set(blk, constantGlobals)
    }

    return replaced
}
function mergePrintOperations(blocks: SSABlock[]) {
    for (const blk of blocks) {
        const replacementStream: SSAOp[] = []
        let wasprinting = false
        for (const op of blk.ops) {
            replacementStream.push(op)
            const replace = (op: SSAOp) => {
                replacementStream[replacementStream.length - 1] = op
            }
            if (
                op.op == Opcode.TargetOp &&
                op.args[0] == 'print.ref' &&
                typeof op.args[1] == 'number'
            ) {
                if (wasprinting) {
                    replacementStream.pop()
                    const top = replacementStream[replacementStream.length - 1]
                    top.args[1] = `"${str(top.args[1]).slice(1, -1)}${op.args[1]}"`
                } else {
                    replace({
                        op: Opcode.TargetOp,
                        args: ['print.direct', `"${op.args[1]}"`]
                    })
                    wasprinting = true
                }
            } else if (op.op == Opcode.TargetOp && op.args[0] == 'print.direct') {
                if (wasprinting) {
                    replacementStream.pop()
                    replacementStream[replacementStream.length - 1].args[1] += `${op.args[1]}`
                }
                wasprinting = true
            } else {
                wasprinting = false
            }
        }
        blk.ops = replacementStream
    }
}

export function optimize(u: SSAUnit, blocks: SSABlock[]) {
    const _savblocks = blocks
    if (options.constProp)
        while (propagateConstants(blocks)) {
            console.log('pass')
            blocks = orderBlocks(new Set(blocks), blocks[0])
        }
    if (options.bindLoads) bindLoads(blocks)
    if (options.eliminateDeadCode) eliminateDeadCode(blocks)
    if (options.mergePrint) mergePrintOperations(blocks)
    _savblocks.splice(0)
    _savblocks.push(...blocks)
    dumpSSA(u, blocks)
}
