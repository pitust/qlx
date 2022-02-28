// vim: ts=4 sts=4 sw=4 et list
import assert from 'assert'
import { readFileSync } from 'fs'
import { ast, parseprogram } from './parseqlx'
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
export { Options } from './options'
import { Options } from './options'
export const options: Options = <Options>{}
export type Type = PrimitiveType
export type OpArg = string | number | { reg: number } | { type: Type } | { glob: string } | { blox: string } | { arg: number }
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
    i => () =>
        i++
)(1)
function doGenerateExpr(node: ast, ctx: SSAGenCtx): OpArg {
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
        
        ctx.currentBlock = fwd
        fwd.ops.push({
            meta,
            pos: node.pos,
            op: Opcode.Call,
            args: [{ reg }, tgd, ...callargs.map(e => doGenerateExpr(theast(e), ctx))],
        })
        ctx.currentBlock = fwd2
        ctx.blocks.add(fwd)
        ctx.blocks.add(fwd2)
        return reg;
    }
    if (node.type == 'binop') {
        const opc = thestr(node.children[0])
        const lhs = theast(node.children[1])
        const rhs = theast(node.children[2])
        const reg = getreg()
        ctx.currentBlock.ops.push({
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
        ctx.currentBlock.ops.push({
            meta,
            pos: node.pos,
            op: Opcode.TargetOp,
            args: ['_lookupblox', { reg }, vname],
        })
        return { reg }
    }
    if (node.type == 'varnode') {
        const vname = thestr(node.children[0])
        const reg = getreg()
        ctx.currentBlock.ops.push({
            meta,
            pos: node.pos,
            op: ctx.glob.has(vname) ? Opcode.LdGlob : Opcode.LdLoc,
            args: [{ reg }, vname],
        })
        return { reg }
    }

    assert(false, 'TODO: generate expr ' + node.type)
}
function doGenerateType(node: ast): OpArg {
    if (node.type == 'floatty') return { type: PrimitiveType.Float }
    if (node.type == 'voidty') return { type: PrimitiveType.Void }
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
        ctx.currentBlock.ops.push({
            meta,
            pos: node.pos,
            op: ctx.isGlobal ? Opcode.TypeGlob : Opcode.TypeLoc,
            args: [thestr(node.children[1]), doGenerateType(theast(node.children[0]))],
        })
        ctx.currentBlock.ops.push({
            meta,
            pos: node.pos,
            op: ctx.isGlobal ? Opcode.StGlob : Opcode.StLoc,
            args: [thestr(node.children[1]), doGenerateExpr(theast(node.children[2]), ctx)],
        })
        if (ctx.isGlobal) ctx.glob.add(thestr(node.children[0]))
        return
    }
    if (node.type == 'let') {
        ctx.currentBlock.ops.push({
            meta,
            pos: node.pos,
            op: ctx.isGlobal ? Opcode.StInitGlob : Opcode.StInitLoc,
            args: [thestr(node.children[0]), doGenerateExpr(theast(node.children[1]), ctx)],
        })
        if (ctx.isGlobal) ctx.glob.add(thestr(node.children[0]))
        return
    }
    if (node.type == 'set') {
        ctx.currentBlock.ops.push({
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
            ctx.currentBlock.ops.push({
                meta,
                pos: node.pos,
                op: Opcode.TargetOp,
                args: ['print.direct', thestr(theast(node.children[0]).children[0])],
            })
            return
        } else {
            // value emission
            ctx.currentBlock.ops.push({
                meta,
                pos: node.pos,
                op: Opcode.TargetOp,
                args: ['print.ref', doGenerateExpr(theast(node.children[0]), ctx)],
            })
            return
        }
    }
    if (node.type == 'printflushnode') {
        ctx.currentBlock.ops.push({
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
        ctx.currentBlock.ops.push({
            meta,
            pos: node.pos,
            op: Opcode.Function,
            args: [name, ret, ...args.map(e => doGenerateType(theast(theast(theast(e).children[0]).children[1])))]
        })
        functionGenerationQueue.add(node)
        return
    }
    if (node.type == 'callnode') {
        doGenerateExpr(node, ctx)
        return
    }
    if (node.type == 'bindarg') {
        const [c0, idx_] = node.children
        const idx = +thestr(idx_)
        const [nm_, typ] = theast(c0).children
        const nm = thestr(nm_)
        ctx.currentBlock.ops.push({
            meta,
            pos: node.pos,
            op: Opcode.BindArgument,
            args: [nm, idx, doGenerateType(theast(typ))]
        })
        return
    }


    console.log(node)
    assert(false, 'todo: handle ' + node.type)
}
export function dumpSSA(unit: SSAUnit, b: SSABlock[] = null) {
    // for now
    // TODO: this should go to typechk/gen
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
            console.log('    \x1b[32;1m%s\x1b[0m', Opcode[op.op], ...op.args)
        }
        console.log('  \x1b[34m%s\x1b[0m', JumpCond[block.cond], ...block.condargs)
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
            blocks: ctx.blocks
        }
    }
    const root = generateUnit(true, '_init', parseprogram(readFileSync(file).toString()))
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
