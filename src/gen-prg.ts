// PRG, the pretty reasonable QLX codegen
import { SSAUnit, SSABlock, SSAOp, dumpSSA, Opcode, OpArg, JumpCond, options } from './middlegen'
import { createProgram } from './target/api'
import { name, Program } from './target/targen'

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
    | { type: 'LT'; left: expr; right: expr }
    | { type: 'Add'; left: expr; right: expr }
    | { type: 'Sub'; left: expr; right: expr }
    | { type: 'Eq'; left: expr; right: expr }
    | { type: 'NEq'; left: expr; right: expr }
    | { type: 'Negate'; value: expr }
    | { type: 'CallSynchronisationBarrier'; target: string; args: expr[] }

type op =
    | { type: 'Print'; expr: expr }
    | { type: 'PrintFlush'; expr: expr }
    | { type: 'GlobalSynchronizationBarrier'; glb: string; expr: expr }
    | { type: 'Condbr'; cond: expr; target: number }
    | { type: 'ControlFlowExit' }
    | { type: 'ControlFlowReturn' }
    | { type: 'CallSynchronisationBarrier'; target: string; args: expr[] }
    | { type: 'ArgumentStorageBarrier'; index: number; variable: string }
    | { type: 'ReturnValueBarrier'; value: expr }

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
                console.log(`    "g_${g}_${i}" [label="*${g} (${i})*"]`)
            }
        } else {
            console.log(`    "g_${g}" [label="*${g}*"]`)
        }
    }
    let id = -1
    const graphedExpressions = new Map<expr, string>()
    let idgen = 0
    function graphExpression(src: string, e: expr, isInvertedPointer: boolean = false) {
        if (!graphedExpressions.has(e)) {
            let id = `ge_${idgen++}`
            if (e.type == 'Number') console.log(`    ${id} [label="*${e.value}*"]`)
            if (e.type == 'String')
                console.log(`    ${id} [label="*${e.value.replaceAll('\n', '\\\\n')}*"]`)
            if (e.type == 'Variable') {
                if (options.dump_prgDfgExpandvars) {
                    id = `"g_${e.value}_${e.blockid}"`
                } else {
                    id = `"g_${e.value}"`
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
            if (e.type == 'CallSynchronisationBarrier') {
                const args: string[] = [`<${id}>Call ${e.target}`]
                for (let i = 0; i < e.args.length; i++) {
                    args.push(`<n${i}>arg ${i}`)
                    graphExpression(`${id}:n${i}`, e.args[i])
                }
                console.log(`    ${id} [shape=record,label="${args.join('|')}"]`)
                id = `${id}:${id}`
            }
            graphedExpressions.set(e, id)
        }
        if (isInvertedPointer) {
            if (src.startsWith('block'))
                rexpr.push(`    ${src} -> ${graphedExpressions.get(e)}[weight=50]`)
            else console.log(`    ${src} -> ${graphedExpressions.get(e)}[weight=50]`)
        } else {
            if (src.startsWith('block'))
                rexpr.push(`    ${graphedExpressions.get(e)} -> ${src}[weight=50]`)
            else console.log(`    ${graphedExpressions.get(e)} -> ${src}[weight=50]`)
        }
    }
    for (const blk of blks) {
        id++
        let stripExit = false
        let label = [
            '<start>entry',
            ...blk.map((e, i) => {
                let output = 'idk ' + e.type
                if (e.type == 'CallSynchronisationBarrier') {
                    output = `Call`
                    graphExpression(`block${id}:op${i}`, e, true)
                }
                if (e.type == 'Print') output = 'Print'
                if (e.type == 'PrintFlush') output = 'PrintFlush'
                if (e.type == 'GlobalSynchronizationBarrier') {
                    return `<op${i}>var ${e.glb}`
                }
                if (e.type == 'ArgumentStorageBarrier') {
                    output = `arg #${e.index} is ${e.variable}`
                }
                if (e.type == 'ReturnValueBarrier') {
                    output = `return value`
                }
                if (e.type == 'Condbr') output = `condbr`
                if (e.type == 'ControlFlowReturn') {
                    output = 'return'
                    stripExit = true
                }
                if (e.type == 'ControlFlowExit') {
                    output = 'exit'
                    stripExit = true
                }
                return `<op${i}>${output}`
            }),
            '<end>exit',
        ]
        if (stripExit) label = label.slice(0, -1)
        rexpr.push(`    block${id} [label="${label.join('|')}",shape=record]`)
    }
    id = -1
    for (const blk of blks) {
        let stripExit = false
        id++
        blk.forEach((e, i) => {
            const target = `block${id}:op${i}`
            if (e.type == 'Print') graphExpression(target, e.expr)
            if (e.type == 'PrintFlush') graphExpression(target, e.expr)
            if (e.type == 'ReturnValueBarrier') graphExpression(target, e.value)
            if (e.type == 'GlobalSynchronizationBarrier') {
                graphExpression(target, e.expr)
                if (options.dump_prgDfgExpandvars) {
                    rexpr.push(`    block${id}:op${i} -> "g_${e.glb}_${id}"[weight=500]`)
                } else {
                    rexpr.push(`    block${id}:op${i} -> "g_${e.glb}"[weight=500]`)
                }
            }
            if (e.type == 'Condbr') {
                graphExpression(target, e.cond)
                rexpr.push(`    block${id}:op${i} -> block${e.target}:start [weight=1]`)
            }
            if (e.type == 'ControlFlowReturn' || e.type == 'ControlFlowExit') {
                stripExit = true
            }
        })
        if (!stripExit) rexpr.push(`    block${id}:end -> block${id + 1}:start [weight=10]`)
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
                if (reft.get(e) == 1) {
                    if (e.type == 'Number') return
                    if (e.type == 'String') return
                    if (e.type == 'Variable') return
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
                    if (e.type == 'CallSynchronisationBarrier') e.args.forEach(e => scanRefs(e))
                }
            }
            if (op.type == 'CallSynchronisationBarrier') op.args.forEach(e => scanRefs(e))
            if (op.type == 'Print') scanRefs(op.expr)
            if (op.type == 'PrintFlush') scanRefs(op.expr)
            if (op.type == 'GlobalSynchronizationBarrier') scanRefs(op.expr)
            if (op.type == 'ReturnValueBarrier') scanRefs(op.value)
            if (op.type == 'Condbr') scanRefs(op.cond)
            if (op.type == 'ControlFlowExit' || op.type == 'ControlFlowReturn') break
        }
    }
    return reft
}
export function buildUnit(program: Program, o: SSAUnit, mod: string, fn: string) {
    if (fn != '_init') program.label(`fn.${fn}`)
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
            } else if (op.op == Opcode.StLoc) {
                const e = gexpr(op.args[1])
                variableShadowTable.set(`${mod}::${fn}::${op.args[0]}`, e)
            } else if (op.op == Opcode.LdLoc) {
                const nam = `${mod}::${fn}::${op.args[1]}`
                registerBindingTable.set(
                    reg(op.args[0]),
                    variableShadowTable.has(nam) ? variableShadowTable.get(nam) : Variable(nam, id)
                )
            } else if (op.op == Opcode.BindArgument) {
                bmap.get(blk).push({
                    type: 'ArgumentStorageBarrier',
                    variable: `${op.args[0]}`,
                    index: +`${op.args[1]}`,
                })
            } else if (op.op == Opcode.TargetOp && op.args[0] == 'print.ref') {
                bmap.get(blk).push({ type: 'Print', expr: gexpr(op.args[1]) })
            } else if (op.op == Opcode.TargetOp && op.args[0] == 'print.direct') {
                bmap.get(blk).push({ type: 'Print', expr: String(JSON.parse(`${op.args[1]}`)) })
            } else if (op.op == Opcode.BinOp && op.args[1] == 'add') {
                registerBindingTable.set(reg(op.args[0]), Add(gexpr(op.args[2]), gexpr(op.args[3])))
            } else if (op.op == Opcode.BinOp && op.args[1] == 'sub') {
                registerBindingTable.set(reg(op.args[0]), Sub(gexpr(op.args[2]), gexpr(op.args[3])))
            } else if (op.op == Opcode.BinOp && op.args[1] == 'lessThan') {
                registerBindingTable.set(reg(op.args[0]), LT(gexpr(op.args[2]), gexpr(op.args[3])))
            } else if (op.op == Opcode.End) {
                bmap.get(blk).push({ type: 'ControlFlowExit' })
                break
            } else if (op.op == Opcode.Return) {
                bmap.get(blk).push({ type: 'ReturnValueBarrier', value: gexpr(op.args[0]) })
                bmap.get(blk).push({ type: 'ControlFlowReturn' })
                break
            } else if (op.op == Opcode.ReturnVoid) {
                bmap.get(blk).push({ type: 'ControlFlowReturn' })
                break
            } else if (op.op == Opcode.Function) {
            } else if (op.op == Opcode.Call) {
                const csb: op & expr = {
                    type: 'CallSynchronisationBarrier',
                    target: `${op.args[1]}`,
                    args: [],
                }
                if (op.args[0] !== null) {
                    registerBindingTable.set(reg(op.args[0]), csb)
                }
                csb.args = op.args.slice(2).map(e => gexpr(e))
                bmap.get(blk).push(csb)
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
    const completed = new Map<expr, name>()

    const tg = (
        ti => () =>
            program.name2(`t.${ti++}`)
    )(1)
    let watermark = -1

    function possiblyHint(e: expr, nam: name) {
        if (allrc.get(e) == 1 && !completed.has(e)) attemptCompletion(e, nam, true)
    }
    const immvalues = new Map<expr, number>()
    function attemptCompletion(e: expr, nameHint: name = tg(), hinted: boolean = false) {
        if (completed.has(e)) return false
        if (e.type == 'Number') {
            completed.set(e, program.imm(e.value))
            immvalues.set(e, e.value)
            return true
        }
        if (e.type == 'String') {
            completed.set(e, program.stri(e.value))
            return true
        }
        if (e.type == 'Variable') {
            completed.set(e, program.name(`v.${e.value}`))
            return true
        }
        if (e.type == 'Negate') {
            const name = nameHint
            possiblyHint(e.value, nameHint)
            attemptCompletion(e.value)
            if (!completed.has(e.value)) return false
            program.binop(name, program.imm(0), 'eq', completed.get(e.value))
            completed.set(e, name)
            return true
        }
        if (e.type == 'LT' || e.type == 'Add' || e.type == 'Sub') {
            let name = nameHint
            possiblyHint(e.left, nameHint)
            attemptCompletion(e.left)
            attemptCompletion(e.right)
            if (immvalues.has(e.left) && immvalues.has(e.right)) {
                const sim: Record<string, (a: number, b: number) => number> = {
                    LT(a, b) {
                        return +(a < b)
                    },
                    Add(a, b) {
                        return +(a + b)
                    },
                    Sub(a, b) {
                        return +(a - b)
                    },
                } as const
                immvalues.set(e, sim[e.type](immvalues.get(e.left), immvalues.get(e.right)))
                completed.set(e, program.imm(immvalues.get(e)))
                return
            }
            if (!completed.has(e.left)) return false
            if (!completed.has(e.right)) return false
            if (allrc.get(e.left) == 1 && !immvalues.has(e.left)) name = completed.get(e.left)
            const names = {
                LT: 'lt',
                Add: 'add',
                Sub: 'sub',
            } as const
            program.binop(name, completed.get(e.left), names[e.type], completed.get(e.right))
            completed.set(e, name)
            return true
        }
        // Barriers are completed after execution completes
        if (e.type == 'CallSynchronisationBarrier') {
            return false
        }
        _fatal('todo type ' + e.type)
    }
    for (const blk of bmap.values()) {
        watermark++
        if (conditionalBranchTargetSet.has(watermark)) program.label(`b.${watermark}`)
        function getex(e: expr): name {
            attemptCompletion(e)
            // note to future self and/or future maintainers:
            //    if you are here because you were adding opcodes, please remember to add it to the recursive
            //    scanner, or liveness will never compute correctly!
            if (!completed.has(e))
                _fatal(
                    `incomplete expression (${e.type}) cannot be passed to getex (bad mgen/gen-prg)`
                )
            return completed.get(e)
        }

        for (const op of blk) {
            if (op.type == 'Print') {
                program.platformHookPrintValue(getex(op.expr))
            } else if (op.type == 'PrintFlush') {
                _fatal('TODO: printflush needs hooks and prg stuff')
                // program.platformHookPrintFlush(getex(op.expr))
                // console.log(` printflush ${getex(op.expr)}`)
            } else if (op.type == 'GlobalSynchronizationBarrier') {
                program.move(program.name(`v.${op.glb}`), getex(op.expr))
            } else if (op.type == 'Condbr') {
                program.bnz(`b.${op.target}`, getex(op.cond))
            } else if (op.type == 'ControlFlowExit') {
                program.platformHookEnd()
            } else if (op.type == 'ControlFlowReturn') {
                program.retv(`fn.${fn}`)
            } else if (op.type == 'ArgumentStorageBarrier') {
                program.move(program.name(`v.${op.variable}`), program.name2(`a${op.index}`))
            } else if (op.type == 'ReturnValueBarrier') {
                program.move(program.name2(`ret0`), getex(op.value))
            } else if (op.type == 'CallSynchronisationBarrier') {
                const return_value = tg()
                const actual_return_value = program.call(
                    return_value,
                    `${op.target}`,
                    op.args.map(getex)
                )
                program.move(return_value, actual_return_value)
                completed.set(op, return_value)
            } else {
                // _fatal(`bad op ${op.type}`)
            }
        }
    }
}
export function buildProgram(units: [SSAUnit, Map<string, SSAUnit>]) {
    const program = createProgram()
    buildUnit(program, units[0], '_main', '_init')
    for (const [nm, u] of units[1]) buildUnit(program, u, '_main', nm)
    console.log(program.generate())
}
