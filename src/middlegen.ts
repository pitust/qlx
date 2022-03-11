// vim: ts=4 sts=4 sw=4 et list
import assert from 'assert'
import { readFileSync } from 'fs'
import { ast, parseprogram } from './parseqlx'
import { dumpAstNode } from './dumpast'
function isast(t: ast | string): asserts t is ast {}
function isstr(t: ast | string): asserts t is string {}
function theast(t: ast | string): ast {
    isast(t)
    return t
}
function thestr(t: ast | string): string {
    isstr(t)
    return t
}
export enum Opcode {
    BindArgument,
    LdGlob,
    StGlob,
    Move,
    Function,
    StInitGlob,
    StInitLoc,
    TypeLoc,
    TypeGlob,
    LdLoc,
    StLoc,
    Call,
    BinOp,
    TargetOp,
    End,
    Return,
    ReturnVoid,

    NewObject,
    GetProp,
    SetProp,
}
export enum JumpCond {
    Always,
    AlwaysNoMerge, // we do not want to merge function call blocks, as they inhibit optimizations.
    LessThan,
    GreaterThan,
    LessEqual,
    GreaterEqual,
    Equal,
    NotEqual,
    TestBoolean,
    Abort,
}
export enum PrimitiveType {
    Bool,
    Float,
    String,
    Void,
    Null,
}
import { Options } from './options'
export const options: Options = <Options>{}
export interface CompoundType {
    name: string
    members: Map<string, Type>
}
export type Type = PrimitiveType | CompoundType
export type OpArg =
    | string
    | number
    | { reg: number }
    | { type: Type }
    | { glob: string }
    | { loc: string }
    | { blox: string }
    | { arg: number }
export const name2type = new Map<string, CompoundType>()
export interface SSAOp {
    pos: string
    meta?: {
        line: string
        range: [number, number]
    }
    op: Opcode
    args: OpArg[]
}
export interface Cond {
    cond: JumpCond
    args: OpArg[]
}
export interface SSABlock {
    ops: SSAOp[]
    cond: JumpCond
    condargs: OpArg[]
    targets: [] | [SSABlock] | [SSABlock, SSABlock]
}
export interface SSAUnit {
    startBlock: SSABlock
    blocks: Set<SSABlock>
}
interface SSAGenCtx {
    moduleName: string
    functionName: string
    startBlock: SSABlock
    currentBlock: SSABlock
    isGlobal: boolean
    blocks: Set<SSABlock>
    glob: Set<string>
}
export const getreg = (
    i => () => i++
)(1)
function construct(ctx: SSAGenCtx, type: Type): OpArg {
    if (typeof type == 'object') {
        let out = getreg()
        ctx.currentBlock.ops.push({
            pos: '<inline constructor for ' + type.name + '>',
            op: Opcode.NewObject,
            args: [{ reg: out }, { type }],
        })
        for (const [nm, ty] of type.members) {
            let newout = getreg()
            ctx.currentBlock.ops.push({
                pos: '<inline constructor for ' + type.name + ':' + nm + '>',
                op: Opcode.SetProp,
                args: [{ reg: newout }, { reg: out }, nm, construct(ctx, ty)],
            })
            out = newout
        }

        return { reg: out }
    }
    return 0
}
function doGenerateExpr(node: ast, ctx: SSAGenCtx, isCallStatement: boolean = false): OpArg {
    function pushOp(op: SSAOp) {
        ctx.currentBlock.ops.push(op)
    }
    const meta = { line: node.codeline, range: node.range }
    if (node.type == 'number') {
        return +thestr(node.children[0])
    }
    if (node.type == 'callnode') {
        const [tgdobj, callobj] = node.children
        const tgd = thestr(tgdobj)
        const callargs = theast(callobj).children
        const reg = getreg()

        // optimization: put all calls in their own blocks to permit optimizations
        const fwd: SSABlock = ssablk()
        const fwd2: SSABlock = ssablk()
        ctx.currentBlock.cond = JumpCond.AlwaysNoMerge
        ctx.currentBlock.condargs = []
        ctx.currentBlock.targets = [fwd]

        fwd.cond = JumpCond.AlwaysNoMerge
        fwd.condargs = []
        fwd.targets = [fwd2]

        fwd.ops.push({
            meta,
            pos: node.pos,
            op: Opcode.Call,
            args: [
                isCallStatement ? null : { reg },
                tgd,
                ...callargs.map(e => doGenerateExpr(theast(e), ctx)),
            ],
        })
        ctx.currentBlock = fwd2
        ctx.blocks.add(fwd)
        ctx.blocks.add(fwd2)
        return { reg }
    }
    if (node.type == 'binop') {
        const opc = thestr(node.children[0])
        const lhs = theast(node.children[1])
        const rhs = theast(node.children[2])
        const reg = getreg()
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.BinOp,
            args: [{ reg }, opc, doGenerateExpr(lhs, ctx), doGenerateExpr(rhs, ctx)],
        })
        return { reg }
    }
    if (node.type == 'blox') {
        const vname = thestr(node.children[0])
        const reg = getreg()
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.TargetOp,
            args: ['_lookupblox', { reg }, vname],
        })
        return { reg }
    }
    if (node.type == 'memread') {
        const cell = doGenerateExpr(theast(node.children[0]), ctx)
        const addr = doGenerateExpr(theast(node.children[1]), ctx)
        const reg = getreg()
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.TargetOp,
            args: ['read', { reg }, cell, addr],
        })
        return { reg }
    }
    if (node.type == 'varnode') {
        const vname = thestr(node.children[0])
        const reg = getreg()
        pushOp({
            meta,
            pos: node.pos,
            op: ctx.glob.has(vname) ? Opcode.LdGlob : Opcode.LdLoc,
            args: [{ reg }, vname],
        })
        return { reg }
    }
    if (node.type == 'new') {
        return construct(ctx, name2type.get(thestr(node.children[0])))
    }
    if (node.type == 'dot') {
        const tgd = doGenerateExpr(theast(node.children[0]), ctx)
        const reg = getreg()
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.GetProp,
            args: [{ reg }, tgd, thestr(node.children[1])],
        })
        return { reg }
    }

    assert(false, 'TODO: generate expr ' + node.type)
}
function doGenerateType(node: ast): { type: Type } {
    if (node.type == 'floatty') return { type: PrimitiveType.Float }
    if (node.type == 'voidty') return { type: PrimitiveType.Void }
    if (node.type == 'namedty') return { type: name2type.get(thestr(node.children[0])) }
    assert(false, 'TODO: type ' + node.type)
}
function ssablk(): SSABlock {
    return {
        ops: [],
        cond: JumpCond.Abort,
        condargs: [],
        targets: [],
    }
}
const functionGenerationQueue = new Set<ast>()
function doGenerateSSA(node: ast, ctx: SSAGenCtx) {
    function pushOp(op: SSAOp) {
        ctx.currentBlock.ops.push(op)
    }
    const meta = { line: node.codeline, range: node.range }
    if (node.type == 'programnode') {
        for (const c of node.children) {
            doGenerateSSA(theast(c), ctx)
        }
        return
    }
    if (node.type == 'blocknode') {
        for (const c of node.children) doGenerateSSA(theast(c), ctx)
        return
    }
    if (node.type == 'dotset') {
        const val = thestr(node.children[0])
        const reg = getreg()
        const reg2 = getreg()
        pushOp({
            meta,
            pos: node.pos,
            op: ctx.glob.has(val) ? Opcode.LdGlob : Opcode.LdLoc,
            args: [{ reg }, val],
        })
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.SetProp,
            args: [
                { reg: reg2 },
                { reg },
                thestr(node.children[1]),
                doGenerateExpr(theast(node.children[2]), ctx),
            ],
        })
        pushOp({
            meta,
            pos: node.pos,
            op: ctx.glob.has(val) ? Opcode.StGlob : Opcode.StLoc,
            args: [val, { reg: reg2 }],
        })
        return
    }
    if (node.type == 'while') {
        const condblk: SSABlock = ssablk()
        const body: SSABlock = ssablk()
        const fwd: SSABlock = ssablk()
        ctx.currentBlock.cond = JumpCond.Always
        ctx.currentBlock.condargs = []
        ctx.currentBlock.targets = [condblk]

        ctx.currentBlock = condblk
        const condvalue = doGenerateExpr(theast(node.children[0]), ctx)
        ctx.currentBlock.cond = JumpCond.TestBoolean
        ctx.currentBlock.condargs = [condvalue]
        ctx.currentBlock.targets = [body, fwd]
        ctx.currentBlock = body
        for (const b of theast(node.children[1]).children) doGenerateSSA(theast(b), ctx)
        ctx.currentBlock.cond = JumpCond.Always
        ctx.currentBlock.condargs = []
        ctx.currentBlock.targets = [condblk]
        ctx.currentBlock = fwd
        ctx.blocks.add(condblk)
        ctx.blocks.add(body)
        ctx.blocks.add(fwd)
        return
    }
    if (node.type == 'if') {
        if (
            theast(node.children[2]).type == 'blocknode' &&
            theast(node.children[2]).children.length == 0
        ) {
            // if .. do-end
            const cond = doGenerateExpr(theast(node.children[0]), ctx)
            const body: SSABlock = ssablk()
            const fwd: SSABlock = ssablk()
            ctx.currentBlock.cond = JumpCond.TestBoolean
            ctx.currentBlock.condargs = [cond]
            ctx.currentBlock.targets = [body, fwd]
            ctx.currentBlock = body
            for (const b of theast(node.children[1]).children) doGenerateSSA(theast(b), ctx)
            ctx.currentBlock.cond = JumpCond.Always
            ctx.currentBlock.condargs = []
            ctx.currentBlock.targets = [fwd]
            ctx.currentBlock = fwd
            ctx.blocks.add(body)
            ctx.blocks.add(fwd)
            return
        } else {
            // if .. do-else-end
            const cond = doGenerateExpr(theast(node.children[0]), ctx)
            const cons: SSABlock = ssablk()
            const alt: SSABlock = ssablk()
            const fwd: SSABlock = ssablk()
            ctx.currentBlock.cond = JumpCond.TestBoolean
            ctx.currentBlock.condargs = [cond]
            ctx.currentBlock.targets = [cons, alt]
            ctx.currentBlock = cons
            for (const b of theast(node.children[1]).children) doGenerateSSA(theast(b), ctx)
            ctx.currentBlock.cond = JumpCond.Always
            ctx.currentBlock.condargs = []
            ctx.currentBlock.targets = [fwd]
            ctx.currentBlock = alt
            for (const b of theast(node.children[2]).children) doGenerateSSA(theast(b), ctx)
            ctx.currentBlock.cond = JumpCond.Always
            ctx.currentBlock.condargs = []
            ctx.currentBlock.targets = [fwd]
            ctx.currentBlock = fwd
            ctx.blocks.add(cons)
            ctx.blocks.add(alt)
            ctx.blocks.add(fwd)
            return
        }
    }
    if (node.type == 'typedlet') {
        pushOp({
            meta,
            pos: node.pos,
            op: ctx.isGlobal ? Opcode.TypeGlob : Opcode.TypeLoc,
            args: [thestr(node.children[1]), doGenerateType(theast(node.children[0]))],
        })
        pushOp({
            meta,
            pos: node.pos,
            op: ctx.isGlobal ? Opcode.StGlob : Opcode.StLoc,
            args: [thestr(node.children[1]), doGenerateExpr(theast(node.children[2]), ctx)],
        })
        if (ctx.isGlobal) ctx.glob.add(thestr(node.children[1]))
        return
    }
    if (node.type == 'let') {
        pushOp({
            meta,
            pos: node.pos,
            op: ctx.isGlobal ? Opcode.StInitGlob : Opcode.StInitLoc,
            args: [thestr(node.children[0]), doGenerateExpr(theast(node.children[1]), ctx)],
        })
        if (ctx.isGlobal) ctx.glob.add(thestr(node.children[0]))
        return
    }
    if (node.type == 'set') {
        pushOp({
            meta,
            pos: node.pos,
            op: ctx.isGlobal ? Opcode.StGlob : Opcode.StLoc, // todo: store to globals from within functions
            args: [thestr(node.children[0]), doGenerateExpr(theast(node.children[1]), ctx)],
        })
        if (ctx.isGlobal) ctx.glob.add(thestr(node.children[1]))
        return
    }
    if (node.type == 'printnode') {
        if (theast(node.children[0]).type == 'blox') {
            // direct emission
            pushOp({
                meta,
                pos: node.pos,
                op: Opcode.TargetOp,
                args: ['print.direct', thestr(theast(node.children[0]).children[0])],
            })
            return
        } else {
            // value emission
            pushOp({
                meta,
                pos: node.pos,
                op: Opcode.TargetOp,
                args: ['print.ref', doGenerateExpr(theast(node.children[0]), ctx)],
            })
            return
        }
    }
    if (node.type == 'printflushnode') {
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.TargetOp,
            args: ['print.flush', doGenerateExpr(theast(node.children[0]), ctx)],
        })
        return
    }
    if (node.type == 'fnnode') {
        const name = thestr(node.children[0])
        const blk = theast(node.children[1])
        const args: ast[] = []
        const argc = +thestr(node.children[2])
        const ret = doGenerateType(theast(node.children[3]))
        if (argc) args.push(...blk.children.slice(0, argc).map(theast))
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.Function,
            args: [
                name,
                ret,
                ...args.map(e => doGenerateType(theast(theast(theast(e).children[0]).children[1]))),
            ],
        })
        functionGenerationQueue.add(node)
        return
    }
    if (node.type == 'callnode') {
        doGenerateExpr(node, ctx, node.type == 'callnode')
        return
    }
    if (node.type == 'memwrite') {
        const cell = doGenerateExpr(theast(node.children[0]), ctx)
        const addr = doGenerateExpr(theast(node.children[1]), ctx)
        const value = doGenerateExpr(theast(node.children[2]), ctx)
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.TargetOp,
            args: ['write', value, cell, addr],
        })
        return
    }
    if (node.type == 'bindarg') {
        const [c0, idx_] = node.children
        const idx = +thestr(idx_)
        const [nm_, typ] = theast(c0).children
        const nm = thestr(nm_)
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.BindArgument,
            args: [nm, idx, doGenerateType(theast(typ))],
        })
        return
    }
    if (node.type == 'returnnode') {
        pushOp({
            meta,
            pos: node.pos,
            op: Opcode.Return,
            args: [doGenerateExpr(theast(node.children[0]), ctx)],
        })
        return
    }
    if (node.type == 'switch') {
        const [cond_, body_, dfl_] = node.children
        const cond = theast(cond_)
        const body = theast(body_).children.map(e => theast(e))
        const dfl = theast(dfl_)

        const cval = doGenerateExpr(cond, ctx)
        const finished = ssablk()
        ctx.blocks.add(finished)
        for (const switchcase of body) {
            const switchblk = ssablk()
            const morecases = ssablk()
            ctx.blocks.add(switchblk)
            ctx.blocks.add(morecases)

            const [test, inner] = switchcase.children
            ctx.currentBlock.cond = JumpCond.Equal
            ctx.currentBlock.condargs = [cval, doGenerateExpr(theast(test), ctx)]
            ctx.currentBlock.targets = [switchblk, morecases]
            ctx.currentBlock = switchblk
            doGenerateSSA(theast(inner), ctx)
            ctx.currentBlock.cond = JumpCond.Always
            ctx.currentBlock.condargs = []
            ctx.currentBlock.targets = [finished]
            ctx.currentBlock = morecases
        }
        doGenerateSSA(dfl, ctx)
        ctx.currentBlock.cond = JumpCond.Always
        ctx.currentBlock.condargs = []
        ctx.currentBlock.targets = [finished]
        ctx.currentBlock = finished
        return
    }
    if (node.type == 'struct') {
        const items = new Map<string, Type>()
        for (const c of node.children.slice(1))
            items.set(
                thestr(theast(c).children[0]),
                doGenerateType(theast(theast(c).children[1])).type
            )
        const ct: CompoundType = {
            name: 'struct _main:' + thestr(node.children[0]),
            members: items,
        }
        name2type.set(thestr(node.children[0]), ct)
        return
    }

    console.log(node)
    assert(false, 'todo: handle ' + node.type)
}
// TODO: this should go to typechk/gen
export function dumpSSA(unit: SSAUnit, b: SSABlock[] = null) {
    function dumpSSAParameter(arg: OpArg, op: SSAOp): string {
        if (op.op == Opcode.TargetOp && typeof arg == 'string') return `\x1b[0;33m${arg}\x1b[0m`
        if (typeof arg == 'string') return `\x1b[0;33m'${arg}'\x1b[0m`
        if (typeof arg == 'number') return `\x1b[0;33m${arg}\x1b[0m`
        if (!arg) return `\x1b[0;34mnull\x1b[0m`
        if ('reg' in arg) return `\x1b[31;1mr${arg.reg}\x1b[0m`
        if ('type' in arg)
            return `\x1b[36;1m${
                typeof arg.type == 'number' ? PrimitiveType[arg.type].toLowerCase() : arg.type.name
            }\x1b[0m`
        if ('glob' in arg) return `\x1b[36;1m${arg.glob}\x1b[0m`
        if ('loc' in arg) return `\x1b[36;1m.${arg.loc}\x1b[0m`
        if ('blox' in arg) return `\x1b[30;1m[ ${arg.blox} ]\x1b[0m`
        if ('arg' in arg) return `\x1b[31;1marg${arg.arg}\x1b[0m`
        return '???'
    }

    let i = 0
    const m = new Map<SSABlock, string>()
    m.set(unit.startBlock, 'entry')
    for (const block of unit.blocks) {
        if (!m.has(block)) m.set(block, 'blk.' + i++)
    }
    for (const block of unit.blocks) {
        if (b && !b.includes(block)) continue
        console.log(`\x1b[34;1m${m.get(block)}\x1b[0m`)
        for (const op of block.ops) {
            console.log(
                '    \x1b[32;1m%s\x1b[0m',
                Opcode[op.op],
                ...op.args.map(e => dumpSSAParameter(e, op))
            )
        }
        console.log('  \x1b[31m%s\x1b[0m', JumpCond[block.cond], ...block.condargs)
        const labels = [[], ['target'], ['cons', 'alt']][block.targets.length]
        for (const ti in block.targets) {
            const t = block.targets[ti]
            console.log('     \x1b[35m%s\x1b[0m => \x1b[34;1m%s\x1b[0m', labels[ti], m.get(t))
        }
    }
}
export function generateSSA(file: string): [SSAUnit, Map<string, SSAUnit>] {
    function generateUnit(g: boolean, f: string, body: ast) {
        const blk: SSABlock = {
            ops: [],
            cond: JumpCond.Abort,
            condargs: [],
            targets: [],
        }
        const ctx = {
            moduleName: '_main',
            functionName: f,
            startBlock: blk,
            currentBlock: blk,
            isGlobal: g,
            blocks: new Set([blk]),
            glob: new Set<string>(),
        }

        doGenerateSSA(body, ctx)
        if (g) {
            ctx.currentBlock.cond = JumpCond.Abort
            ctx.currentBlock.ops.push({
                pos: '<compiler generated code>',
                op: Opcode.End,
                args: [],
            })
        } else {
            ctx.currentBlock.cond = JumpCond.Abort
            ctx.currentBlock.ops.push({
                pos: '<compiler generated code>',
                op: Opcode.ReturnVoid,
                args: [],
            })
        }
        return {
            startBlock: blk,
            blocks: ctx.blocks,
        }
    }
    const ast = parseprogram(readFileSync(file).toString())
    if (options.dump_ast) dumpAstNode(ast)
    const root = generateUnit(true, '_init', ast)
    const cu = new Map()
    for (const n of functionGenerationQueue) {
        const name = thestr(n.children[0])
        const body = theast(n.children[1])
        cu.set(name, generateUnit(false, name, body))
        if (theast(n.children[2]).type == 'voiddty') {
            cu.get(name)
        }
    }

    return [root, cu]
}
