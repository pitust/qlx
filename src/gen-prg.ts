// PRG, the pretty reasonable QLX codegen
import { SSAUnit, SSABlock, SSAOp, dumpSSA, Opcode, OpArg, JumpCond, options } from './middlegen'

function _fatal(er): never {
    console.log('fatal:', er)
    process.exit(1)
}

// strategy
// essentially, each register becomes an `expr`
// each ExpressionHolder can be one of a few differnet expression kinds
type expr =
    | { type: 'Number'; value: number }
    | { type: 'String'; value: string }
    | { type: 'Variable'; value: string; blockid: number }
    | { type: 'Call'; args: expr[] }
    | { type: 'LT'; left: expr; right: expr }
    | { type: 'Add'; left: expr; right: expr }
    | { type: 'Sub'; left: expr; right: expr }
    | { type: 'Eq'; left: expr; right: expr }
    | { type: 'NEq'; left: expr; right: expr }
    | { type: 'Negate'; value: expr }

type op =
    | { type: 'CallResultUser'; expr: expr }
    | { type: 'Print'; expr: expr }
    | { type: 'PrintFlush'; expr: expr }
    | { type: 'GlobalSynchronizationBarrier'; glb: string; expr: expr }
    | { type: 'Condbr'; cond: expr; target: number }
    | { type: 'ControlFlowExit' }

class Cache<T, U> {
    _cache = new Map<T, U>()
    get_or(k: T, or: (k: T) => U): U {
        if (this._cache.has(k)) return this._cache.get(k)
        const v = or(k)
        this._cache.set(k, v)
        return v
    }
    callable(or: (k: T) => U): (k: T) => U {
        const this_ = this
        return k => {
            return this_.get_or(k, or)
        }
    }
}
function multicache<T1, T2, U>(final: (T1, T2) => U): (T1, T2) => U {
    return (
        c => (a, b) =>
            c(a)(b)
    )(
        new Cache<T1, (k: T2) => U>().callable(t1 =>
            new Cache<T2, U>().callable(t2 => final(t1, t2))
        )
    )
}

const Negate = new Cache<expr, expr>().callable(n => ({ type: 'Negate', value: n }))
const Number = new Cache<number, expr>().callable(n => ({ type: 'Number', value: n }))
const String = new Cache<string, expr>().callable(n => ({ type: 'String', value: n }))
const Variable = multicache<string, number, expr>((nm, bi) => ({
    type: 'Variable',
    value: nm,
    blockid: bi,
}))
const LT = multicache<expr, expr, expr>((left, right) => ({ type: 'LT', left, right }))
const Add = multicache<expr, expr, expr>((left, right) => ({ type: 'Add', left, right }))
const Sub = multicache<expr, expr, expr>((left, right) => ({ type: 'Sub', left, right }))
const Eq = multicache<expr, expr, expr>((left, right) => ({ type: 'Eq', left, right }))
const NEq = multicache<expr, expr, expr>((left, right) => ({ type: 'NEq', left, right }))

type block = op[]
type program = block[]

function sequenceBlocks(u: SSAUnit) {
    const order: SSABlock[] = []
    const bset = new Set(u.blocks)
    order.push(u.startBlock)
    bset.delete(u.startBlock)
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
    return order
}

function emitGraph(knownGlobals: Set<string>, blks: block[]) {
    console.log('digraph PRGControlFlowTrace {')
    console.log('    node [fontname="Handlee"];')
    console.log('    rankdir=LR;')
    const rexpr: string[] = []
    for (const g of knownGlobals) {
        if (options.dump_prgDfgExpandvars) {
            for (let i = 0; i < blks.length; i++) {
                console.log(`    g_${g}_${i} [label="*${g} (${i})*"]`)
            }
        } else {
            console.log(`    g_${g} [label="*${g}*"]`)
        }
    }
    let id = -1
    for (const blk of blks) {
        id++
        const label = [
            '<start>entry',
            ...blk.map((e, i) => {
                let output = 'idk'
                if (e.type == 'CallResultUser') output = 'CallResultUser'
                if (e.type == 'Print') output = 'Print'
                if (e.type == 'PrintFlush') output = 'PrintFlush'
                if (e.type == 'GlobalSynchronizationBarrier') {
                    return `<op${i}>var ${e.glb}`
                }
                if (e.type == 'Condbr') output = `Condbr`
                if (e.type == 'ControlFlowExit') output = 'ControlFlowExit'
                return `<op${i}>${output}`
            }),
            '<end>exit',
        ].join('|')
        rexpr.push(`    block${id} [label="${label}",shape=record]`)
    }
    const graphedExpressions = new Map<expr, string>()
    let idgen = 0
    function graphExpression(src: string, e: expr) {
        if (!graphedExpressions.has(e)) {
            let id = `ge_${idgen++}`
            if (e.type == 'Number') console.log(`    ${id} [label="*${e.value}*"]`)
            if (e.type == 'String')
                console.log(`    ${id} [label="*${e.value.replaceAll('\n', '\\\\n')}*"]`)
            if (e.type == 'Variable') {
                if (options.dump_prgDfgExpandvars) {
                    id = `g_${e.value}_${e.blockid}`
                } else {
                    id = `g_${e.value}`
                }
            }
            if (e.type == 'Add' || e.type == 'LT') {
                console.log(`    ${id} [shape=record,label="<left>A|<res>${e.type}|<right>B"]`)
                graphExpression(`${id}:left`, e.left)
                graphExpression(`${id}:right`, e.right)
                id = `${id}:res`
            }
            if (e.type == 'Negate') {
                console.log(`    ${id} [label="Negate",shape=record,label="Negate"]`)
                graphExpression(`${id}`, e.value)
            }
            graphedExpressions.set(e, id)
        }
        if (src.startsWith('block'))
            rexpr.push(`    ${graphedExpressions.get(e)} -> ${src}[weight=50]`)
        else console.log(`    ${graphedExpressions.get(e)} -> ${src}[weight=50]`)
    }
    id = -1
    for (const blk of blks) {
        id++
        blk.forEach((e, i) => {
            const target = `block${id}:op${i}`
            if (e.type == 'CallResultUser') graphExpression(target, e.expr)
            if (e.type == 'Print') graphExpression(target, e.expr)
            if (e.type == 'PrintFlush') graphExpression(target, e.expr)
            if (e.type == 'GlobalSynchronizationBarrier') {
                graphExpression(target, e.expr)
                if (options.dump_prgDfgExpandvars) {
                    rexpr.push(`    block${id}:op${i} -> g_${e.glb}_${id}[weight=500]`)
                } else {
                    rexpr.push(`    block${id}:op${i} -> g_${e.glb}[weight=500]`)
                }
            }
            if (e.type == 'Condbr') {
                graphExpression(target, e.cond)
                rexpr.push(`    block${id}:op${i} -> block${e.target}:start [weight=1]`)
            }
        })
        rexpr.push(`    block${id}:end -> block${id + 1}:start [weight=10]`)
    }
    for (const r of rexpr) console.log(r)
    console.log('}')
}
function computeExpressionReferences(blkz: block[]): Map<expr, number> {
    const reft = new Map<expr, number>()
    for (const blk of blkz) {
        for (const op of blk) {
            function scanRefs(e: expr) {
                reft.set(e, 1 + (reft.get(e) ?? 0))
                if (e.type == 'Number') return
                if (e.type == 'String') return
                if (e.type == 'Variable') return
                if (e.type == 'Call') {
                    e.args.forEach(scanRefs)
                    return
                }
                if (
                    e.type == 'LT' ||
                    e.type == 'Add' ||
                    e.type == 'Sub' ||
                    e.type == 'Eq' ||
                    e.type == 'NEq'
                ) {
                    scanRefs(e.left)
                    scanRefs(e.right)
                    return
                }
                if (e.type == 'Negate') {
                    scanRefs(e.value)
                    return
                }
            }
            if (op.type == 'CallResultUser') scanRefs(op.expr)
            if (op.type == 'Print') scanRefs(op.expr)
            if (op.type == 'PrintFlush') scanRefs(op.expr)
            if (op.type == 'GlobalSynchronizationBarrier') scanRefs(op.expr)
            if (op.type == 'Condbr') scanRefs(op.cond)
        }
    }
    return reft
}
export function buildProgram(o: SSAUnit) {
    const blocks = sequenceBlocks(o)
    const bmap = new Map<SSABlock, block>()
    for (const blk of blocks) {
        bmap.set(blk, [])
    }
    let id = -1
    const registerBindingTable = new Map<number, expr>()
    const knownGlobals = new Set<string>()
    const conditionalBranchTargetSet = new Set<number>()
    for (const blk of blocks) {
        id++
        // if a variable is stored to within this block, the appropriate entry is set
        // to ensure a GlobalSynchronizationBarrier is placed at the exit point of the block or
        // a condbr
        const variableShadowTable = new Map<string, expr>()
        function gexpr(arg: OpArg) {
            if (typeof arg == 'string') return String(arg)
            if (typeof arg == 'number') return Number(arg)
            if ('reg' in arg) return registerBindingTable.get(arg.reg)
            _fatal('unhandled gexpr case: ' + Object.keys(arg))
        }
        function reg(r: OpArg) {
            if (typeof r != 'object') _fatal('not a reg')
            if (!('reg' in r)) _fatal('not a reg')
            return r.reg
        }
        for (const op of blk.ops) {
            if (op.op == Opcode.StInitGlob) {
                const e = gexpr(op.args[1])
                variableShadowTable.set(`${op.args[0]}`, e)
            } else if (op.op == Opcode.StGlob) {
                const e = gexpr(op.args[1])
                variableShadowTable.set(`${op.args[0]}`, e)
            } else if (op.op == Opcode.LdGlob) {
                const nam = `${op.args[1]}`
                registerBindingTable.set(
                    reg(op.args[0]),
                    variableShadowTable.has(nam) ? variableShadowTable.get(nam) : Variable(nam, id)
                )
            } else if (op.op == Opcode.TargetOp && op.args[0] == 'print.ref') {
                bmap.get(blk).push({ type: 'Print', expr: gexpr(op.args[1]) })
            } else if (op.op == Opcode.TargetOp && op.args[0] == 'print.direct') {
                bmap.get(blk).push({ type: 'Print', expr: String(JSON.parse(`${op.args[1]}`)) })
            } else if (op.op == Opcode.BinOp && op.args[1] == 'add') {
                registerBindingTable.set(reg(op.args[0]), Add(gexpr(op.args[2]), gexpr(op.args[3])))
            } else if (op.op == Opcode.BinOp && op.args[1] == 'lessThan') {
                registerBindingTable.set(reg(op.args[0]), LT(gexpr(op.args[2]), gexpr(op.args[3])))
            } else if (op.op == Opcode.End) {
                bmap.get(blk).push({ type: 'ControlFlowExit' })
            } else {
                _fatal(`idk op ${Opcode[op.op]}`)
            }
        }
        for (const [nam, et] of variableShadowTable) {
            if (et.type == 'Variable' && et.value == nam) continue
            bmap.get(blk).push({ type: 'GlobalSynchronizationBarrier', glb: nam, expr: et })
            knownGlobals.add(nam)
        }
        variableShadowTable.clear()
        if (blk.cond == JumpCond.Always && blocks[id + 1] != blk.targets[0]) {
            bmap.get(blk).push({
                type: 'Condbr',
                cond: Number(1),
                target: blocks.indexOf(blk.targets[0]),
            })
            conditionalBranchTargetSet.add(blocks.indexOf(blk.targets[0]))
        }
        if (blk.cond == JumpCond.TestBoolean) {
            if (blocks[id + 1] != blk.targets[0]) {
                bmap.get(blk).push({
                    type: 'Condbr',
                    cond: gexpr(blk.condargs[0]),
                    target: blocks.indexOf(blk.targets[0]),
                })
                conditionalBranchTargetSet.add(blocks.indexOf(blk.targets[0]))
            }
            if (blocks[id + 1] != blk.targets[1]) {
                bmap.get(blk).push({
                    type: 'Condbr',
                    cond: Negate(gexpr(blk.condargs[0])),
                    target: blocks.indexOf(blk.targets[1]),
                })
                conditionalBranchTargetSet.add(blocks.indexOf(blk.targets[1]))
            }
        }
    }
    if (options.dump_prgDfg) emitGraph(knownGlobals, [...bmap.values()])
    const allrc = computeExpressionReferences([...bmap.values()])
    const completed = new Map<expr, string>()

    const tg = (
        ti => () =>
            `t.${ti++}`
    )(1)
    let watermark = 0
    function computeLive() {
        let madeProgress = false
        do {
            madeProgress = false
            for (const [e] of allrc) {
                if (completed.has(e)) continue
                // | { type: 'Number'; value: number }
                if (e.type == 'Number') {
                    completed.set(e, `${e.value}`)
                    madeProgress = true
                    continue
                }
                if (e.type == 'String') {
                    completed.set(e, `${JSON.stringify(e.value)}`)
                    madeProgress = true
                    continue
                }
                if (e.type == 'Variable') {
                    if (e.blockid != watermark) continue
                    completed.set(e, `v.${e.value}`)
                    madeProgress = true
                    continue
                }
                if (e.type == 'Negate') {
                    if (!completed.has(e.value)) continue
                    const name = tg()
                    console.log(` op equal ${name} 0 ${completed.get(e.value)}`)
                    completed.set(e, name)
                    madeProgress = true
                    continue
                }
                if (e.type == 'LT' || e.type == 'Add') {
                    if (!completed.has(e.left)) continue
                    if (!completed.has(e.right)) continue
                    const name = tg()
                    const names = {
                        LT: 'lessThan',
                        Add: 'add',
                    } as const
                    console.log(
                        ` op ${names[e.type]} ${name} ${completed.get(e.left)} ${completed.get(
                            e.right
                        )}`
                    )
                    completed.set(e, name)
                    madeProgress = true
                    continue
                }
                _fatal('todo type ' + e.type)
            }
        } while (madeProgress)
    }

    computeLive()

    watermark = -1
    for (const blk of bmap.values()) {
        watermark++
        if (conditionalBranchTargetSet.has(watermark)) console.log(`b.${watermark}:`)
        computeLive()
        function getex(e: expr): string {
            if (!completed.has(e))
                _fatal('uncompleted expression cannot be passed to getex (bad mgen/gen-prg)')
            return completed.get(e)
        }

        for (const op of blk) {
            if (op.type == 'Print') {
                console.log(` print ${getex(op.expr)}`)
            }
            if (op.type == 'PrintFlush') {
                console.log(` printflush ${getex(op.expr)}`)
            }
            if (op.type == 'GlobalSynchronizationBarrier') {
                console.log(` set v.${op.glb} ${getex(op.expr)}`)
            }
            if (op.type == 'Condbr') {
                console.log(` jump b.${op.target} notEqual 0 ${getex(op.cond)}`)
            }
            if (op.type == 'ControlFlowExit') {
                console.log(` end`)
            }
        }
    }
}
