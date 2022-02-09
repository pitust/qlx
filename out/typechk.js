"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _middlegen = require('./middlegen');










const checkedBlocks = new WeakMap()
let checked = true

function sameType(t1, t2) {
    return t1 == t2
}
function immtype(opa, lty) {
    if (typeof opa == 'number') return _middlegen.PrimitiveType.Float
    if (typeof opa == 'string') return _middlegen.PrimitiveType.String
    if ('reg' in opa) return lty.get(opa['reg'])
    console.log('ERROR: reflection is TODO!')
    checked = false
    return _middlegen.PrimitiveType.Null
}
function typename(ty) {
    if (ty == _middlegen.PrimitiveType.Null) return 'null'
    if (ty == _middlegen.PrimitiveType.Float) return 'float'
    if (ty == _middlegen.PrimitiveType.String) return 'string'
    return '<unknown>'
}
function reportTypeDiff(left, right, fmt, ...args) {
    const tnl = typename(left)
    const tnr = typename(right)
    const p = fmt.includes('%a') ? [] : [`${tnl} is not ${tnr}`]
    console.log('ERROR:', fmt.replace(/{}/g, () => args.shift()).replace('%a', tnl).replace('%b', tnr), ...p)
}
function continueBlockCheck(
    block, mod, func, entryTypes,
    vTy, gTy
) {
    // localTypes: Map<number, Type>
    // module: string
    // func: string
    // didCheck: boolean
    const check = {
        localTypes: new Map(entryTypes),
        module: mod,
        func,
        didCheck: true
    }

    if (checkedBlocks.has(block)) {
        next_check: for (const check of checkedBlocks.get(block)) {
            if (check.localTypes.size != entryTypes.size) continue
            for (const [lid, ty] of [...check.localTypes.entries()]) {
                if (!entryTypes.has(lid) || !sameType(entryTypes.get(lid), ty)) continue next_check
            }
            if (check.module != mod)
            // block is already checked!
            console.log('block is in cache!')
            return
        }
    } else {
        checkedBlocks.set(block, new Set())
    }
    checkedBlocks.get(block).add(check)
    if (!checked) return
    const ltypes = new Map(entryTypes.entries())
    for (const op of block.ops) {
        switch (op.op) {
        case _middlegen.Opcode.End:
            return
        case _middlegen.Opcode.TypeGlob:
            if (gTy.has(op.args[0])) {
                if (!sameType(gTy.get(op.args[0]), op.args[1])) {
                    checked = false // typechecking failed
                    reportTypeDiff(gTy.get(op.args[0]), op.args[1], 'type of global {}::{} mismatched:', mod, op.args[0])
                }
            } else {
                gTy.set(op.args[0], (op.args[1]).type)
            }
            break
        case _middlegen.Opcode.StInitGlob:
            if (!gTy.has(op.args[0])) {
                gTy.set(op.args[0], immtype(op.args[1], ltypes))
            }
            if (!sameType(gTy.get(op.args[0]), immtype(op.args[1], ltypes))) {
                checked = false
                reportTypeDiff(
                    gTy.get(op.args[0]),
                    immtype(op.args[1], ltypes),
                    'cannot store value of type %a to {}::{} of type %b', mod, op.args[0]
                )
            }
        case _middlegen.Opcode.StGlob:
            if (!gTy.has(op.args[0])) {
                checked = false
                break
            }
            if (!sameType(gTy.get(op.args[0]), immtype(op.args[1], ltypes))) {
                checked = false
                reportTypeDiff(
                    gTy.get(op.args[0]),
                    immtype(op.args[1], ltypes),
                    'cannot store value of type %a to {}::{} of type %b', mod, op.args[0]
                )
            }
            break
        case _middlegen.Opcode.LdGlob:
            if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                console.log('typechk: LdGlob: SSA invalid: output is not a reg: %o', op.args[0])
                checked = false
                return
            }
            if (!gTy.has(op.args[1])) {
                console.log('No such variable: ' + op.args[1])
                checked = false
                return
            }
            ltypes.set(op.args[0].reg, gTy.get(op.args[1]))
            break
        case _middlegen.Opcode.BinOp:
            if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                console.log('typechk: LdGlob: SSA invalid: output is not a reg: %o', op.args[0])
                checked = false
                return
            }
            const opTypes = {
                notEqual: _middlegen.PrimitiveType.Bool,
                add: _middlegen.PrimitiveType.Float,
            }
            if (!(op.args[1] in opTypes)) {
                console.log('Bad binop:', op.args[1])
                checked = false
                return
            }
            ltypes.set(op.args[0].reg, opTypes[op.args[1]])
            break
        case _middlegen.Opcode.TargetOp:
            // target ops are assumed to be fine
            break
        default:
            console.log('Bad opcode: ', _middlegen.Opcode[op.op], ...op.args)
            checked = false
            return
        }
    }
    for (const t of block.targets) continueBlockCheck(t, mod, func, ltypes, vTy, gTy)
}

 function checkAllTypes(unit) {
    continueBlockCheck(unit.startBlock, '_main', '_init', new Map(), new Map(), new Map())
    if (!checked) return false
    return true
} exports.checkAllTypes = checkAllTypes;
