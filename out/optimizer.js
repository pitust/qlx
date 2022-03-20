"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }










var _middlegen = require('./middlegen');

// reorder blocks to maximize fallthrough savings
 function orderBlocks(blocks, b0) {
    const order = []
    if (_middlegen.options.reorderBlocks) {
        const bset = new Set(blocks.keys())
        order.push(b0)
        bset.delete(b0)
        for (const b of blocks) {
            if (b.cond == _middlegen.JumpCond.Abort) b.targets = []
        }
        while (bset.size) {
            const blockHeat = new Map([...blocks.values()].map(e => [e, 0]))
            for (const b of blocks) {
                for (const t of b.targets) blockHeat.set(t, blockHeat.get(t) + 1)
            }
            const t = order[order.length - 1].targets.filter(e => bset.has(e))
            if (t.length == 0) {
                const be = order.find(e => e.targets.filter(e => bset.has(e)).length)
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
                const b = bset.keys().next().value
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
} exports.orderBlocks = orderBlocks;

function findall(blocks, pred) {
    const output = []
    for (const blk of [blocks].flat()) {
        for (const op of blk.ops) {
            if (pred(op, blk)) output.push({ op, blk })
        }
    }
    return output
}
function findin(ops, pred) {
    const output = []
    for (const op of ops) {
        if (pred(op, ops)) output.push(op)
    }
    return output
}
function findcond(blocks, pred) {
    const output = []
    for (const blk of [blocks].flat()) {
        const cond = { cond: blk.cond, args: blk.condargs }
        if (pred(cond, blk)) output.push({ cond, blk })
    }
    return output
}
function findallblk(blocks, pred) {
    const output = []
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
function getprev(block, op) {
    let idx = block.ops.findIndex(top => op == top)
    if (idx === -1) return null
    if (idx - 1 < 0) return null
    return _nullishCoalesce(block.ops[idx - 1], () => ( null))
}
function getnext(block, op) {
    let idx = block.ops.findIndex(top => op == top)
    if (idx === -1) return null
    if (idx + 1 >= block.ops.length) return null
    return _nullishCoalesce(block.ops[idx + 1], () => ( null))
}
function usesreg(o, r) {
    if (reg(o.args[0]) == r) return 'store'
    for (const arg of o.args) {
        if (reg(arg) == r) return 'load'
    }
    return false
}
function usesfor(o, r, level) {
    let keyslot = 0
    if ('op' in o && o.op == _middlegen.Opcode.TargetOp) keyslot = o.args[0] == '_lookupblox' ? 1 : -1
    if ('cond' in o) keyslot = -1
    if (level != 'load' && reg(o.args[keyslot]) == r) return true
    if (level == 'store') return false
    for (const arg of o.args) {
        if (reg(arg) == r) return true
    }
    return false
}
function remap_args(
    select,
    op,
    pred
) {
    op.args = op.args.map((arg, idx) => {
        if (idx != 0 && select == 'store') return arg
        if (idx == 0 && select == 'load') return arg
        return _nullishCoalesce(pred(arg), () => ( arg))
    })
}
function reg(arg) {
    if (arg === null) return null
    if (typeof arg == 'object' && 'reg' in arg) return arg.reg
    return null
}
function glob(arg) {
    if (arg === null) return null
    if (typeof arg == 'object' && 'glob' in arg) return arg.glob
    return null
}
function getarg(arg) {
    if (arg === null) return null
    if (typeof arg == 'object' && 'arg' in arg) return arg.arg
    return null
}
function isarg(arg) {
    if (arg === null) return false
    if (typeof arg == 'object' && 'arg' in arg) return true
    return false
}
function str(arg) {
    if (typeof arg == 'string') return arg
    return null
}

function eliminateDeadCode(blocks) {
    for (const match of findall(blocks, op => op.op == _middlegen.Opcode.LdGlob || op.op == _middlegen.Opcode.Move)) {
        const r = reg(match.op.args[0])
        if (!r) continue

        // if there is one use of our register...
        if (findall(blocks, op => usesfor(op, r, 'ldst')).length != 1) continue

        // and no use in conds...
        if (findcond(blocks, cond => usesfor(cond, r, 'ldst')).length) continue

        // then remove this opcode
        match.blk.ops = match.blk.ops.filter(op => match.op != op)
    }
    for (const match of findall(
        blocks,
        op => op.op == _middlegen.Opcode.StGlob || op.op == _middlegen.Opcode.StInitGlob
    )) {
        const tgd = str(match.op.args[0])
        if (!tgd) continue

        // if nobody uses this global...
        if (
            findall(blocks, op => {
                // fix a misoptimization in some structure cases
                if (op.op == _middlegen.Opcode.StGlob && op.args[0] == tgd) return false
                if (op.args.find(e => e && typeof e == 'object' && 'glob' in e && e.glob == tgd))
                    return true
                if (op.op == _middlegen.Opcode.LdGlob) return op.args[1] == tgd
                return false
            }).length
        )
            continue

        // then remove this opcode
        match.blk.ops = match.blk.ops.filter(op => match.op != op)
    }
    for (const match of findall(blocks, op => op.op == _middlegen.Opcode.StLoc || op.op == _middlegen.Opcode.StInitLoc)) {
        const tgd = str(match.op.args[0])
        if (!tgd) continue

        // if nobody uses this global...
        if (
            findall(blocks, op => {
                // fix a misoptimization in some structure cases
                if (op.op == _middlegen.Opcode.StLoc && op.args[0] == tgd) return false
                if (op.args.find(e => e && typeof e == 'object' && 'loc' in e && e.loc == tgd))
                    return true
                if (op.op == _middlegen.Opcode.LdLoc) return op.args[1] == tgd
                return false
            }).length
        )
            continue

        // then remove this opcode
        match.blk.ops = match.blk.ops.filter(op => match.op != op)
    }
}
function bindLoads(blocks) {
    // load forwarding
    for (const match of findall(
        blocks,
        op => op.op == _middlegen.Opcode.LdGlob || !!(op.op == _middlegen.Opcode.Move && glob(op.args[1]))
    )) {
        const r = reg(match.op.args[0])
        const tgd = match.op.op == _middlegen.Opcode.Move ? glob(match.op.args[1]) : str(match.op.args[1])
        if (!r || !tgd) continue

        // if we are the only place someone stores to the target reg...
        if (findall([match.blk], op => usesfor(op, r, 'store')).length != 1) continue

        // then, until the end of the block, a function call or a store to target,
        // substitute the register to a global ref
        const rstart = match.blk.ops.findIndex(top => top == match.op)
        for (const op of match.blk.ops.slice(rstart + 1)) {
            remap_args('load', op, arg => (reg(arg) && reg(arg) == r ? { glob: tgd } : null))
            if (op.op == _middlegen.Opcode.Call) break // yeah calls break this optimization
            if (op.op == _middlegen.Opcode.StGlob && str(op.args[0]) == tgd) break
            if (op.op == _middlegen.Opcode.Move && glob(op.args[1]) == tgd) break
        }
    }
    // remove pointless arg to reg moves
    for (const match of findall(blocks, op => op.op == _middlegen.Opcode.Move)) {
        const dst = reg(match.op.args[0])
        const src = getarg(match.op.args[1])
        const next = getnext(match.blk, match.op)
        if (!dst || src === null || !next) continue

        // if we are the only place someone stores to the target reg...
        // NOTE: this is SSA, not three-address code: all regs are stored to exactly once (i think)
        if (findall([match.blk], op => usesfor(op, dst, 'store')).length != 1) continue

        // and this register is used exactly once...
        // TODO: is that a requirement?
        if (findall(blocks, op => usesfor(op, dst, 'load')).length == 1) continue

        // and the next operation uses this new register...
        if (!usesfor(next, dst, 'load')) continue

        // then we forward the argument
        remap_args('load', next, arg => (reg(arg) && reg(arg) == dst ? { arg: src } : null))
    }
    // remove unused local/global loads
    for (const match of findall(blocks, op => op.op == _middlegen.Opcode.LdGlob || op.op == _middlegen.Opcode.LdLoc)) {
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
    // forward blox into variables
    for (const match of findall(
        blocks,
        op => op.op == _middlegen.Opcode.TargetOp && op.args[0] == '_lookupblox'
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
        remap_args('load', m.op, arg => (reg(arg) && reg(arg) == r ? { blox: tgd } : null))

        // also, we can remove the opcode
        match.blk.ops = match.blk.ops.filter(op => match.op != op)
    }
}
function getParentSet(blocks) {
    const m = new Map()

    for (const b of blocks) m.set(b, new Set())
    for (const b of blocks) {
        for (const t of b.targets) {
            m.get(t).add(b)
        }
    }

    return m
}
function deepClone(t) {
    // @ts-ignore
    return structuredClone(t) // note: this is quite slow iirc
}
function propagateConstants(blocks) {
    let replaced = false
    const parentsets = getParentSet(blocks)
    const gmap = new Map()
    for (const blk of blocks) {
        const constantValues = new Map()
        const constantGlobals = new Map()
        function isKnown(val) {
            if (reg(val)) return constantValues.has(reg(val))
            if (typeof val == 'object' && 'glob' in val) return constantGlobals.has(val.glob)
            if (typeof val == 'number') return true
            return false
        }
        function getValue(val) {
            if (reg(val)) return constantValues.get(reg(val))
            if (typeof val == 'object' && 'glob' in val) return constantGlobals.get(val.glob)
            if (typeof val == 'number') return val
            throw new Error('ice: bad getValue')
        }
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

        const tryexpand = (arg) => {
            if (typeof arg == 'number') return arg
            if (reg(arg) && constantValues.get(reg(arg))) return constantValues.get(reg(arg))
            return null
        }
        const replacementStream = []
        for (const op of blk.ops) {
            replacementStream.push(op)
            const replace = (op) => {
                replacementStream[replacementStream.length - 1] = op
                replaced = true
            }
            if (
                (op.op == _middlegen.Opcode.StGlob || op.op == _middlegen.Opcode.StInitGlob) &&
                typeof op.args[1] == 'number'
            ) {
                constantGlobals.set(str(op.args[0]), op.args[1])
            }
            if (op.op == _middlegen.Opcode.Move && typeof op.args[1] == 'number') {
                constantValues.set(reg(op.args[0]), op.args[1])
            }
            if (
                op.op == _middlegen.Opcode.LdGlob &&
                typeof op.args[1] == 'string' &&
                constantGlobals.has(op.args[1])
            ) {
                const r = reg(op.args[0])
                if (r) constantValues.set(r, constantGlobals.get(op.args[1]))
            }
            if (op.op == _middlegen.Opcode.BinOp) {
                const out = reg(op.args[0])
                const left = tryexpand(op.args[2])
                const right = tryexpand(op.args[3])
                if (!out || left === null || right === null) continue
                if (op.args[1] == 'notEqual') {
                    if (left != right) constantValues.set(out, 1)
                    else constantValues.set(out, 0)
                    replace({
                        op: _middlegen.Opcode.Move,
                        pos: op.pos,
                        args: [{ reg: out }, constantValues.get(out)],
                    })
                }
                if (op.args[1] == 'equal') {
                    if (left == right) constantValues.set(out, 1)
                    else constantValues.set(out, 0)
                    replace({
                        op: _middlegen.Opcode.Move,
                        pos: op.pos,
                        args: [{ reg: out }, constantValues.get(out)],
                    })
                }
                if (op.args[1] == 'add') {
                    constantValues.set(out, left + right)
                    replace({
                        op: _middlegen.Opcode.Move,
                        pos: op.pos,
                        args: [{ reg: out }, constantValues.get(out)],
                    })
                }
                if (op.args[1] == 'sub') {
                    constantValues.set(out, left - right)
                    replace({
                        op: _middlegen.Opcode.Move,
                        pos: op.pos,
                        args: [{ reg: out }, constantValues.get(out)],
                    })
                }
            }
            if (op.op == _middlegen.Opcode.TargetOp) {
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
            } else {
                op.args = op.args.map((arg, idx) => {
                    if (!idx) return arg
                    if (isKnown(arg)) return getValue(arg)
                    return arg
                })
            }
        }
        blk.ops = replacementStream
        if (blk.cond == _middlegen.JumpCond.TestBoolean && isKnown(blk.condargs[0])) {
            blk.cond = _middlegen.JumpCond.Always
            blk.targets = [blk.targets[+(getValue(blk.condargs[0]) == 0)]]
            blk.condargs = []
        }
        if (blk.cond == _middlegen.JumpCond.Equal && isKnown(blk.condargs[0]) && isKnown(blk.condargs[1])) {
            blk.cond = _middlegen.JumpCond.Always
            blk.targets = [blk.targets[+(getValue(blk.condargs[0]) != getValue(blk.condargs[1]))]]
            blk.condargs = []
        }
        if (blk.cond == _middlegen.JumpCond.TestBoolean && typeof blk.condargs[0] == 'number') {
            blk.cond = _middlegen.JumpCond.Always
            blk.targets = [blk.targets[+(blk.condargs[0] == 0)]]
            blk.condargs = []
        }
        gmap.set(blk, constantGlobals)
    }

    return replaced
}
function mergePrintOperations(blocks) {
    for (const blk of blocks) {
        const replacementStream = []
        let wasprinting = false
        for (const op of blk.ops) {
            replacementStream.push(op)
            const replace = (op) => {
                replacementStream[replacementStream.length - 1] = op
            }
            if (
                op.op == _middlegen.Opcode.TargetOp &&
                op.args[0] == 'print.ref' &&
                typeof op.args[1] == 'number'
            ) {
                if (wasprinting) {
                    replacementStream.pop()
                    const top = replacementStream[replacementStream.length - 1]
                    top.args[1] = `"${str(top.args[1]).slice(1, -1)}${op.args[1]}"`
                } else {
                    replace({
                        op: _middlegen.Opcode.TargetOp,
                        pos: op.pos,
                        meta: op.meta,
                        args: ['print.direct', `"${op.args[1]}"`],
                    })
                    wasprinting = true
                }
            } else if (op.op == _middlegen.Opcode.TargetOp && op.args[0] == 'print.direct') {
                if (wasprinting) {
                    replacementStream.pop()
                    const top = replacementStream[replacementStream.length - 1]
                    top.args[1] = `"${str(top.args[1]).slice(1, -1)}${str(op.args[1]).slice(
                        1,
                        -1
                    )}"`
                }
                wasprinting = true
            } else {
                wasprinting = false
            }
        }
        blk.ops = replacementStream
    }
}
function mergeBlocks(blocks) {
    merge: while (true) {
        if (_middlegen.options.eliminateDeadCode) eliminateDeadCode(blocks)
        const parentsets = getParentSet(blocks)
        for (const blk of blocks) {
            if (blk.cond == _middlegen.JumpCond.Always && parentsets.get(blk.targets[0]).size == 1) {
                blk.ops.push(...deepClone(blk.targets[0].ops))
                blk.cond = blk.targets[0].cond
                blk.condargs = deepClone(blk.targets[0].condargs)
                blk.targets = blk.targets[0].targets
                continue merge
            }
        }
        for (const blk of blocks) {
            if (blk.cond == _middlegen.JumpCond.Always && blk.ops.length == 0) {
                // empty blocks get deleted
                for (const p of parentsets.get(blk))
                    p.targets = p.targets.map(e => (e == blk ? blk.targets[0] : e))
                if (parentsets.get(blk).size) continue merge
            }
        }
        break
    }
}
function performRawArgumentBinding(blocks) {
    const name2id = new Map()
    for (const blk of blocks) {
        for (const op of blk.ops) {
            if (op.op == _middlegen.Opcode.BindArgument) {
                const [name, id] = op.args
                name2id.set(`${name}`, { arg: +`${id}` })
                blk.ops = blk.ops.filter(e => e != op)
            }
        }
    }
    for (const blk of blocks) {
        for (const op of blk.ops) {
            if (op.op == _middlegen.Opcode.LdLoc) {
                if (name2id.has(`${op.args[1]}`)) {
                    op.op = _middlegen.Opcode.Move
                    op.args[1] = name2id.get(`${op.args[1]}`)
                }
            }
        }
    }
}
const inlinedSet = new Set()
function performInlining(
    blocks,
    getInliningDecision,
    getFunctionBlocks,
    isRoot
) {
    for (const blk of blocks) {
        if (blk.ops.length == 1 && blk.ops[0].op == _middlegen.Opcode.Call) {
            // call block
            // Should we inline?
            const callop = blk.ops[0]
            if (getInliningDecision(str(callop.args[1]))) {
                const blkz = deepClone(getFunctionBlocks(str(callop.args[1])))
                const rootblock = blk
                blk.ops = []

                // allocate a register for the return value...
                const retvalue = callop.args[0]

                // and all the params...
                const argind = callop.args.slice(2)
                const argreg = argind.map(() => _middlegen.getreg.call(void 0, ))
                argreg.forEach((reg, idx) => {
                    const val = argind[idx]
                    blk.ops.push({
                        pos: callop.pos,
                        meta: callop.meta,
                        op: _middlegen.Opcode.Move,
                        args: [{ reg }, val],
                    })
                })
                let earlyops = blk.ops

                // okay we need to process them a bit:
                // if they have a return, immediatly truncate the block and save the return value
                for (const blk of blkz) {
                    const opstream2 = []
                    for (const op of blk.ops) {
                        if (op.op == _middlegen.Opcode.Return || op.op == _middlegen.Opcode.ReturnVoid) {
                            if (op.op == _middlegen.Opcode.Return) {
                                if (retvalue) opstream2.push({
                                    pos: op.pos,
                                    meta: op.meta,
                                    op: _middlegen.Opcode.Move,
                                    args: [retvalue, op.args[0]],
                                })
                            }
                            blk.cond = _middlegen.JumpCond.Always
                            blk.condargs = []
                            blk.targets = rootblock.targets
                            break
                        }
                        if (op.op == _middlegen.Opcode.BindArgument) {
                            earlyops.push({
                                pos: op.pos,
                                meta: op.meta,
                                op: _middlegen.Opcode.StLoc,
                                args: [],
                            })
                        }
                        if (op.op == _middlegen.Opcode.LdLoc) {
                            op.args[1] = `${str(callop.args[1])}::${op.args[1]}`
                            if (isRoot) op.op = _middlegen.Opcode.LdGlob
                        }
                        if (op.op == _middlegen.Opcode.StLoc) {
                            op.args[0] = `${str(callop.args[1])}::${op.args[0]}`
                            if (isRoot) op.op = _middlegen.Opcode.StGlob
                        }
                        remap_args('all', op, arg =>
                            isarg(arg) ? { reg: argreg[getarg(arg)] } : null
                        )
                        opstream2.push(op)
                    }
                    blk.ops = opstream2
                }

                // glue it all together
                blk.targets = [blkz[0]]
                blk.condargs = []
                blk.cond = _middlegen.JumpCond.Always

                // snap in all their blocks too
                blocks.push(...blkz)
                inlinedSet.add(blk)
            }
        } else {
            if (blk.cond == _middlegen.JumpCond.AlwaysNoMerge) {
                if (inlinedSet.has(blk.targets[0])) blk.cond = _middlegen.JumpCond.Always
            }
        }
    }
    blocks = orderBlocks(new Set(blocks), blocks[0])
    return blocks
}
 function optimize(
    u,
    blocks,
    getInliningDecision,
    getFunctionBlocks,
    isRoot
) {
    if (_middlegen.options.rawArgRefs) performRawArgumentBinding(blocks)
    if (_middlegen.options.inline)
        blocks = performInlining(blocks, getInliningDecision, getFunctionBlocks, isRoot)
    if (_middlegen.options.constProp)
        while (propagateConstants(blocks)) {
            blocks = orderBlocks(new Set(blocks), blocks[0])
        }
    if (_middlegen.options.bindLoads) bindLoads(blocks)
    if (_middlegen.options.eliminateDeadCode) eliminateDeadCode(blocks)
    if (_middlegen.options.mergeBlocks) mergeBlocks(blocks)
    if (_middlegen.options.mergePrint) mergePrintOperations(blocks)
    blocks = orderBlocks(new Set(blocks), blocks[0])
    u.blocks = new Set(blocks)
    return blocks
} exports.optimize = optimize;
const opcost = {
    BinOp: 1,
    ReturnVoid: 1,
    Return: 2,
    Function: 0,
    StInitGlob: 1,
    TargetOp: 1,
    StGlob: 1,
    StLoc: 1,
    LdLoc: 1,
    Move: 1,
    End: 1,
    TypeGlob: 0,
}
const condcost = {
    Always: 0.5,
    AlwaysNoMerge: 0,
    Abort: 0,
    Equal: 1.1,
    TestBoolean: 1.1,
}
 function calculateCost(blocks, count) {
    let cost = 0
    for (const blk of blocks) {
        for (const op of blk.ops) {
            if (op.op == _middlegen.Opcode.Call) {
                cost += op.args.length
                continue
            }
            if (!(_middlegen.Opcode[op.op] in opcost)) {
                cost += 3
                console.log('todo op:', _middlegen.Opcode[op.op])
            } else {
                cost += opcost[_middlegen.Opcode[op.op]]
            }
        }
        if (!(_middlegen.JumpCond[blk.cond] in condcost)) {
            cost += 3
            console.log('todo cond:', _middlegen.JumpCond[blk.cond])
        } else {
            cost += condcost[_middlegen.JumpCond[blk.cond]]
        }
    }
    return (cost * (count - 1)) / count
} exports.calculateCost = calculateCost;
 function calculateCounterCost(blocks) {
    let cost = 3
    for (const blk of blocks) {
        for (const op of blk.ops) {
            if (op.op == _middlegen.Opcode.BindArgument) {
                cost += 1
                continue
            }
        }
    }
    return cost
} exports.calculateCounterCost = calculateCounterCost;
 function makeInliningChoice(cost, counterCost) {
    if (cost <= counterCost) return true
    return false
} exports.makeInliningChoice = makeInliningChoice;
