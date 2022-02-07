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
    LdGlob,
    StGlob,
    Move,
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
    Null,
}
export interface Options {
    ssa: boolean
    stripComments: boolean
    noEnd: boolean
    bindLoads: boolean
    noSafeAbort: boolean
    dumpSsa: boolean
    eliminateBranches: boolean
    reorderBlocks: boolean
    constProp: boolean
    max: boolean
    eliminateDeadCode: boolean
    mergePrint: boolean
    mergeBlocks: boolean
    interleaveSsa: boolean
}
export const options: Options = <Options>{}
export type Type = PrimitiveType
export type OpArg = string | number | { reg: number } | { type: Type } | { glob: string } | { blox: string }
export interface SSAOp {
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
const getreg = (
    i => () =>
        i++
)(1)
function doGenerateExpr(node: ast, ctx: SSAGenCtx): OpArg {
    if (node.type == 'number') {
        return +thestr(node.children[0])
    }
    if (node.type == 'binop') {
        const opc = thestr(node.children[0])
        const lhs = theast(node.children[1])
        const rhs = theast(node.children[2])
        const reg = getreg()
        ctx.currentBlock.ops.push({
            op: Opcode.BinOp,
            args: [{ reg }, opc, doGenerateExpr(lhs, ctx), doGenerateExpr(rhs, ctx)],
        })
        return { reg }
    }
    if (node.type == 'blox') {
        const vname = thestr(node.children[0])
        const reg = getreg()
        ctx.currentBlock.ops.push({
            op: Opcode.TargetOp,
            args: ['_lookupblox', { reg }, vname],
        })
        return { reg }
    }
    if (node.type == 'varnode') {
        const vname = thestr(node.children[0])
        const reg = getreg()
        ctx.currentBlock.ops.push({
            op: ctx.glob.has(vname) ? Opcode.LdGlob : Opcode.LdLoc,
            args: [{ reg }, vname],
        })
        return { reg }
    }

    assert(false, 'TODO: generate expr ' + node.type)
}
function doGenerateType(node: ast): OpArg {
    if (node.type == 'floatty') return { type: PrimitiveType.Float }
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
function doGenerateSSA(node: ast, ctx: SSAGenCtx) {
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
        }
    }
    if (node.type == 'typedlet') {
        ctx.currentBlock.ops.push({
            op: ctx.isGlobal ? Opcode.TypeGlob : Opcode.TypeLoc,
            args: [thestr(node.children[1]), doGenerateType(theast(node.children[0]))],
        })
        ctx.currentBlock.ops.push({
            op: ctx.isGlobal ? Opcode.StGlob : Opcode.StLoc,
            args: [thestr(node.children[1]), doGenerateExpr(theast(node.children[2]), ctx)],
        })
        if (ctx.isGlobal) ctx.glob.add(thestr(node.children[1]))
        return
    }
    if (node.type == 'printnode') {
        if (theast(node.children[0]).type == 'blox') {
            // direct emission
            ctx.currentBlock.ops.push({
                op: Opcode.TargetOp,
                args: ['print.direct', thestr(theast(node.children[0]).children[0])],
            })
            return
        } else {
            // value emission
            ctx.currentBlock.ops.push({
                op: Opcode.TargetOp,
                args: ['print.ref', doGenerateExpr(theast(node.children[0]), ctx)],
            })
            return
        }
    }
    if (node.type == 'printflushnode') {
        ctx.currentBlock.ops.push({
            op: Opcode.TargetOp,
            args: ['print.flush', doGenerateExpr(theast(node.children[0]), ctx)],
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
export function generateSSA(file: string): SSAUnit {
    const blk: SSABlock = {
        ops: [],
        cond: JumpCond.Abort,
        condargs: [],
        targets: [],
    }
    const ctx = {
        moduleName: '_mod',
        functionName: '_init',
        startBlock: blk,
        currentBlock: blk,
        isGlobal: true,
        blocks: new Set([blk]),
        glob: new Set<string>(),
    }

    doGenerateSSA(parseprogram(readFileSync(file).toString()), ctx)
    ctx.currentBlock.cond = JumpCond.Abort
    ctx.currentBlock.ops.push({
        op: Opcode.End,
        args: [],
    })

    return {
        startBlock: blk,
        blocks: ctx.blocks,
    }
}
