// PRG, the pretty reasonable QLX codegen
import { SSAUnit, SSABlock, SSAOp, dumpSSA, Opcode, OpArg, JumpCond } from './middlegen'

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
        console.log(`    g_${g} [label="*${g}*"]`)
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
            if (e.type == 'Variable') id = `g_${e.value}`
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
                rexpr.push(`    block${id}:op${i} -> g_${e.glb}[weight=500]`)
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
export function buildProgram(o: SSAUnit): program {
    const blocks = sequenceBlocks(o)
    const bmap = new Map<SSABlock, block>()
    for (const blk of blocks) {
        bmap.set(blk, [])
    }
    let id = -1
    dumpSSA(o, blocks)
    const registerBindingTable = new Map<number, expr>()
    const knownGlobals = new Set<string>()
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
            variableShadowTable.clear()
        }
        if (blk.cond == JumpCond.Always && blocks[id + 1] != blk.targets[0]) {
            bmap.get(blk).push({
                type: 'Condbr',
                cond: Number(1),
                target: blocks.indexOf(blk.targets[0]),
            })
        }
        if (blk.cond == JumpCond.TestBoolean) {
            if (blocks[id + 1] != blk.targets[0]) {
                bmap.get(blk).push({
                    type: 'Condbr',
                    cond: gexpr(blk.condargs[0]),
                    target: blocks.indexOf(blk.targets[0]),
                })
            }
            if (blocks[id + 1] != blk.targets[1]) {
                bmap.get(blk).push({
                    type: 'Condbr',
                    cond: Negate(gexpr(blk.condargs[0])),
                    target: blocks.indexOf(blk.targets[1]),
                })
            }
        }
    }
    emitGraph(knownGlobals, [...bmap.values()])
}
