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
    StInitGlob,
    StInitLoc,
    TypeLoc,
    TypeGlob,
    LdLoc,
    AliasLoc,
    StLoc,
    Call,
    MathOp,
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
    Abort,
}
export enum PrimitiveType {
    Float,
    String,
    Null,
}
export type Type = PrimitiveType
export type OpArg = string | number | { reg: number } | { type: Type }
export interface SSAOp {
    op: Opcode
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
}
function doGenerateExpr(node: ast, ctx: SSAGenCtx): OpArg {
    if (node.type == 'number') {
        return +thestr(node.children[0])
    }
    assert(false, 'TODO: generate expr ' + node.type)
}
function doGenerateType(node: ast): OpArg {
    if (node.type == 'floatty') return { type: PrimitiveType.Float }
    assert(false, 'TODO: type ' + node.type)
}
function doGenerateSSA(node: ast, ctx: SSAGenCtx) {
    if (node.type == 'programnode') {
        for (const c of node.children) {
            doGenerateSSA(theast(c), ctx)
        }
        return
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
        return
    }
    assert(false, 'todo: handle ' + node.type)
}
export function dumpSSA(unit: SSAUnit) {
    // for now
    // TODO: this should go to typechk/gen
    let i = 0
    const m = new Map<SSABlock, string>()
    m.set(unit.startBlock, 'entry')
    for (const block of unit.blocks) {
        if (!m.has(block)) m.set(block, 'blk.' + i++)
        console.log(`\x1b[34m${m.get(block)}\x1b[0m`)
        for (const op of block.ops) {
            console.log('    \x1b[32;1m%s\x1b[0m', Opcode[op.op], ...op.args)
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
