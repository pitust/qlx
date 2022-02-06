import { options, SSAUnit, SSABlock, SSAOp, Opcode, OpArg, Cond, JumpCond } from './middlegen'

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

function bindLoads(_u: SSAUnit, blocks: SSABlock[]) {
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

        // okay, now:
        // if there is one use of this register...
        if (findall(blocks, op => usesfor(op, r, 'ldst')).length != 1) continue
        
        // and no use in conds...
        if (findcond(blocks, cond => usesfor(cond, r, 'ldst')).length) continue
        
        // then remove this opcode
        match.blk.ops = match.blk.ops.filter(op => match.op != op)
    }
    for (const match of findall(blocks, op => op.op == Opcode.TargetOp && op.args[0] == '_lookupblox')) {
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

export function optimize(u: SSAUnit, blocks: SSABlock[]) {
    if (options.bindLoads) bindLoads(u, blocks)
}
