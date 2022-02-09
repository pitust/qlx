"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// vim: ts=4 sts=4 sw=4 et list
var _assert = require('assert'); var _assert2 = _interopRequireDefault(_assert);
var _fs = require('fs');
var _parseqlx = require('./parseqlx');
function isast(t) {}
function isstr(t) {}
function theast(t) {
    isast(t)
    return t
}
function thestr(t) {
    isstr(t)
    return t
}
var Opcode; (function (Opcode) {
    const BindArgument = 0; Opcode[Opcode["BindArgument"] = BindArgument] = "BindArgument";
    const LdGlob = BindArgument + 1; Opcode[Opcode["LdGlob"] = LdGlob] = "LdGlob";
    const StGlob = LdGlob + 1; Opcode[Opcode["StGlob"] = StGlob] = "StGlob";
    const Move = StGlob + 1; Opcode[Opcode["Move"] = Move] = "Move";
    const Function = Move + 1; Opcode[Opcode["Function"] = Function] = "Function";
    const StInitGlob = Function + 1; Opcode[Opcode["StInitGlob"] = StInitGlob] = "StInitGlob";
    const StInitLoc = StInitGlob + 1; Opcode[Opcode["StInitLoc"] = StInitLoc] = "StInitLoc";
    const TypeLoc = StInitLoc + 1; Opcode[Opcode["TypeLoc"] = TypeLoc] = "TypeLoc";
    const TypeGlob = TypeLoc + 1; Opcode[Opcode["TypeGlob"] = TypeGlob] = "TypeGlob";
    const LdLoc = TypeGlob + 1; Opcode[Opcode["LdLoc"] = LdLoc] = "LdLoc";
    const StLoc = LdLoc + 1; Opcode[Opcode["StLoc"] = StLoc] = "StLoc";
    const Call = StLoc + 1; Opcode[Opcode["Call"] = Call] = "Call";
    const BinOp = Call + 1; Opcode[Opcode["BinOp"] = BinOp] = "BinOp";
    const TargetOp = BinOp + 1; Opcode[Opcode["TargetOp"] = TargetOp] = "TargetOp";
    const End = TargetOp + 1; Opcode[Opcode["End"] = End] = "End";
    const Return = End + 1; Opcode[Opcode["Return"] = Return] = "Return";
    const ReturnVoid = Return + 1; Opcode[Opcode["ReturnVoid"] = ReturnVoid] = "ReturnVoid";
})(Opcode || (exports.Opcode = Opcode = {}));
var JumpCond; (function (JumpCond) {
    const Always = 0; JumpCond[JumpCond["Always"] = Always] = "Always";
    const AlwaysNoMerge = Always + 1; JumpCond[JumpCond["AlwaysNoMerge"] = AlwaysNoMerge] = "AlwaysNoMerge"; // we do not want to merge function call blocks, as they inhibit optimizations.
    const LessThan = AlwaysNoMerge + 1; JumpCond[JumpCond["LessThan"] = LessThan] = "LessThan";
    const GreaterThan = LessThan + 1; JumpCond[JumpCond["GreaterThan"] = GreaterThan] = "GreaterThan";
    const LessEqual = GreaterThan + 1; JumpCond[JumpCond["LessEqual"] = LessEqual] = "LessEqual";
    const GreaterEqual = LessEqual + 1; JumpCond[JumpCond["GreaterEqual"] = GreaterEqual] = "GreaterEqual";
    const Equal = GreaterEqual + 1; JumpCond[JumpCond["Equal"] = Equal] = "Equal";
    const NotEqual = Equal + 1; JumpCond[JumpCond["NotEqual"] = NotEqual] = "NotEqual";
    const TestBoolean = NotEqual + 1; JumpCond[JumpCond["TestBoolean"] = TestBoolean] = "TestBoolean";
    const Abort = TestBoolean + 1; JumpCond[JumpCond["Abort"] = Abort] = "Abort";
})(JumpCond || (exports.JumpCond = JumpCond = {}));
var PrimitiveType; (function (PrimitiveType) {
    const Bool = 0; PrimitiveType[PrimitiveType["Bool"] = Bool] = "Bool";
    const Float = Bool + 1; PrimitiveType[PrimitiveType["Float"] = Float] = "Float";
    const String = Float + 1; PrimitiveType[PrimitiveType["String"] = String] = "String";
    const Void = String + 1; PrimitiveType[PrimitiveType["Void"] = Void] = "Void";
})(PrimitiveType || (exports.PrimitiveType = PrimitiveType = {}));
















 const options = {}; exports.options = options


































const getreg = (
    i => () =>
        i++
)(1)
function doGenerateExpr(node, ctx) {
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
        const fwd = ssablk()
        const fwd2 = ssablk()
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
            args: [{ reg }, tgd, ...callargs.map(e => doGenerateExpr(e, ctx))],
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

    _assert2.default.call(void 0, false, 'TODO: generate expr ' + node.type)
}
function doGenerateType(node) {
    if (node.type == 'floatty') return { type: PrimitiveType.Float }
    if (node.type == 'voidty') return { type: PrimitiveType.Void }
    _assert2.default.call(void 0, false, 'TODO: type ' + node.type)
}
function ssablk() {
    return {
        ops: [],
        cond: JumpCond.Abort,
        condargs: [],
        targets: [],
    }
}
const functionGenerationQueue = new Set()
function doGenerateSSA(node, ctx) {
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
        const condblk = ssablk()
        const body = ssablk()
        const fwd = ssablk()
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
            const body = ssablk()
            const fwd = ssablk()
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
            const cons = ssablk()
            const alt = ssablk()
            const fwd = ssablk()
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
        const args = []
        const argc = +thestr(node.children[2])
        const ret = doGenerateType(theast(node.children[3]))
        if (argc) args.push(...blk.children.slice(0, argc))
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
            args: [nm, idx, doGenerateType(typ)]
        })
        return
    }


    console.log(node)
    _assert2.default.call(void 0, false, 'todo: handle ' + node.type)
}
 function dumpSSA(unit, b = null) {
    // for now
    // TODO: this should go to typechk/gen
    let i = 0
    const m = new Map()
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
} exports.dumpSSA = dumpSSA;
 function generateSSA(file) {
    function generateUnit(g, f, body) {
        const blk = {
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
            glob: new Set(),
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
    const root = generateUnit(true, '_init', _parseqlx.parseprogram.call(void 0, _fs.readFileSync.call(void 0, file).toString()))
    const cu = new Map()
    for (const n of functionGenerationQueue) {
        const name = thestr(n.children[0])
        const body = theast(n.children[1])
        cu.set(name, generateUnit(false, name, body))
        if (theast(n.children[2]).name == 'voiddty') {
            cu.get(name)
        }
    }
    
    return [root, cu]
} exports.generateSSA = generateSSA;
