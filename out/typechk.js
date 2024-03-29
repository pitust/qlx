"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _middlegen = require('./middlegen');
var _struct = require('./struct');










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
    if (typeof ty == 'object' && 'name' in ty) return 'struct{' + ty.name + '}'
    return '<unknown>'
}
function reportTypeDiff(left, right, fmt, ...args) {
    const tnl = typename(left)
    const tnr = typename(right)
    const p = fmt.includes('%a') ? [] : [`${tnl} is not ${tnr}`]
    console.log(
        '\x1b[31mERROR\x1b[0m:',
        fmt
            .replace(/{}/g, () => args.shift())
            .replace('%a', tnl)
            .replace('%b', tnr),
        ...p
    )
}




const globalRegisterTypeMap = new Map()
function continueBlockCheck(
    block,
    mod,
    func,
    entryTypes,
    vTy,
    gTy,
    gFn
) {
    // localTypes: Map<number, Type>
    // module: string
    // func: string
    // didCheck: boolean
    const check = {
        localTypes: new Map(entryTypes),
        module: mod,
        func,
        didCheck: true,
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
    l: for (const op of block.ops) {
        switch (op.op) {
            case _middlegen.Opcode.End:
                break l
            case _middlegen.Opcode.TypeGlob:
                if (gTy.has(op.args[0])) {
                    if (!sameType(gTy.get(op.args[0]), op.args[1])) {
                        checked = false // typechecking failed
                        reportTypeDiff(
                            gTy.get(op.args[0]),
                            op.args[1],
                            'type of global {}::{} mismatched:',
                            mod,
                            op.args[0]
                        )
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
                        'cannot store value of type %a to {}::{} of type %b',
                        mod,
                        op.args[0]
                    )
                }
                break
            case _middlegen.Opcode.StInitLoc:
                if (!vTy.has(op.args[0])) {
                    vTy.set(op.args[0], immtype(op.args[1], ltypes))
                }
                if (!sameType(vTy.get(op.args[0]), immtype(op.args[1], ltypes))) {
                    checked = false
                    reportTypeDiff(
                        gTy.get(op.args[0]),
                        immtype(op.args[1], ltypes),
                        'cannot store value of type %a to {}::{}::{} of type %b',
                        mod,
                        func,
                        op.args[0]
                    )
                }
                break
            case _middlegen.Opcode.BindArgument:
                if (!vTy.has(op.args[0])) {
                    vTy.set(op.args[0], (op.args[2]).type)
                }
                if (!sameType(vTy.get(op.args[0]), (op.args[2]).type)) {
                    checked = false
                    reportTypeDiff(
                        gTy.get(op.args[0]),
                        immtype(op.args[1], ltypes),
                        'cannot store value of type %a to {}::{} of type %b',
                        mod,
                        op.args[0]
                    )
                }
                break
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
                        'cannot store value of type %a to {}::{} of type %b',
                        mod,
                        op.args[0]
                    )
                }
                break
            case _middlegen.Opcode.StLoc:
                if (!vTy.has(op.args[0])) {
                    checked = false
                    break
                }
                if (!sameType(vTy.get(op.args[0]), immtype(op.args[1], ltypes))) {
                    checked = false
                    reportTypeDiff(
                        vTy.get(op.args[0]),
                        immtype(op.args[1], ltypes),
                        'cannot store value of type %a to {}::{} of type %b',
                        mod,
                        op.args[0]
                    )
                }
                break
            case _middlegen.Opcode.NewObject:
                if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                    console.log(
                        'typechk: NewObject: SSA invalid: output is not a reg: %o',
                        op.args[0]
                    )
                    checked = false
                    return
                }
                ltypes.set(op.args[0].reg, (op.args[1]).type)
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
            case _middlegen.Opcode.LdLoc:
                if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                    console.log('typechk: LdLoc: SSA invalid: output is not a reg: %o', op.args[0])
                    checked = false
                    return
                }
                if (!vTy.has(op.args[1])) {
                    console.log('No such local variable: ' + op.args[1])
                    checked = false
                    return
                }
                ltypes.set(op.args[0].reg, vTy.get(op.args[1]))
                break
            case _middlegen.Opcode.GetProp: {
                const obj = immtype(op.args[1], ltypes)
                if (typeof obj != 'object') {
                    console.log('cannot get property %s on type %s', op.args[2], typename(obj))
                    checked = false
                    break
                }
                ltypes.set((op.args[0]).reg, obj.members.get(`${op.args[2]}`))
                break
            }
            case _middlegen.Opcode.SetProp: {
                const target = ltypes.get((op.args[1]).reg)
                ltypes.set(
                    (op.args[0]).reg,
                    ltypes.get((op.args[1]).reg)
                )
                if (typeof target != 'object') {
                    console.log(
                        'error: expected compund type but you decided not to give me one big sad'
                    )
                    checked = false
                    break
                }
                const prop = `${op.args[2]}`
                const ity = immtype(op.args[3], ltypes)
                if (!target.members.has(prop)) {
                    console.log('error: type %s does not have member %s', target.name, prop)
                    checked = false
                    break
                }
                const pty = target.members.get(prop)
                if (!sameType(ity, pty)) {
                    checked = false
                    reportTypeDiff(
                        pty,
                        ity,
                        `cannot set property {} of type %a to a value of type %b`,
                        prop
                    )
                }
                break
            }
            case _middlegen.Opcode.BinOp:
                if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                    console.log('typechk: LdGlob: SSA invalid: output is not a reg: %o', op.args[0])
                    checked = false
                    return
                }
                const opTypes = {
                    equal: _middlegen.PrimitiveType.Bool,
                    notEqual: _middlegen.PrimitiveType.Bool,
                    lessThan: _middlegen.PrimitiveType.Bool,
                    add: _middlegen.PrimitiveType.Float,
                    sub: _middlegen.PrimitiveType.Float,
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
                // we need to set up the outputs though
                if (op.args[0] == 'read') {
                    const out = op.args[1]
                    ltypes.set(out.reg, _middlegen.PrimitiveType.Float)
                }
                if (op.args[0] == '_lookupblox') {
                    const out = op.args[1]
                    ltypes.set(out.reg, _middlegen.PrimitiveType.Float)
                }
                break
            case _middlegen.Opcode.AsmSetSlot:
            case _middlegen.Opcode.Asm:
                break
            case _middlegen.Opcode.AsmGetSlot:
                const [_to, _slot, nam, kind] = op.args    
                const out = op.args[0]
                if (kind == _middlegen.Opcode.LdGlob) {
                    if (!gTy.has(nam)) {
                        console.log('No such variable: ' + nam)
                        checked = false
                        return
                    }
                    ltypes.set(out.reg, gTy.get(nam))
                } else if (kind == _middlegen.Opcode.LdLoc) {
                    if (!vTy.has(nam)) {
                        console.log('No such local variable: ' + nam)
                        checked = false
                        return
                    }
                    ltypes.set(out.reg, vTy.get(nam))
                }
                break
            case _middlegen.Opcode.Function:
                const target = op.args[0]
                const argc = op.args.length - 2
                const ret = op.args[1]
                const args = op.args.slice(2)
                gFn.set(target, {
                    ret: ret.type,
                    args: args.map(e => e.type),
                })
                break
            case _middlegen.Opcode.ReturnVoid:
                break
            case _middlegen.Opcode.Return:
                if (!sameType(gFn.get(func).ret, immtype(op.args[0], ltypes))) {
                    checked = false
                    reportTypeDiff(
                        immtype(op.args[0], ltypes),
                        gTy.get(op.args[0]),
                        'cannot return value of type %a as the function {}::{} returns type %b',
                        mod,
                        func
                    )
                }
                break
            case _middlegen.Opcode.Call:
                const output = op.args[0]
                const tgd = op.args[1]
                const callargs = op.args.slice(2)
                if (tgd.startsWith('__intrin::') && !gFn.has(tgd)) {
                    // intrinsics are magical: they are autoderived on first use
                    const typespec = [...tgd.split('_').slice(-1)[0]]
                    const ts = typespec.map(
                        e =>
                            ({
                                v: _middlegen.PrimitiveType.Void,
                                i: _middlegen.PrimitiveType.Float,
                                s: _middlegen.PrimitiveType.String,
                            }[e])
                    )
                    gFn.set(tgd, {
                        ret: ts[0],
                        args: ts.slice(1),
                    })
                }
                if (!gFn.has(tgd)) {
                    console.log(`error: ${op.pos}: cannot find function ${tgd}/${callargs.length}`)
                    checked = false
                    return
                }
                const fndata = gFn.get(tgd)
                if (fndata.args.length != callargs.length) {
                    console.log(
                        `error: ${op.pos}: function ${tgd}/${callargs.length} does not match the prototype ${tgd}/${fndata}.`
                    )
                    checked = false
                    return
                }
                for (let i = 0; i < fndata.args.length; i++) {
                    if (!sameType(fndata.args[i], immtype(callargs[i], ltypes))) {
                        console.log(
                            `error: ${op.pos}: function ${tgd}/${callargs.length} cannot be called because parameters are incorrect.`
                        )
                        reportTypeDiff(
                            fndata.args[i],
                            immtype(callargs[i], ltypes),
                            `here: %a vs %b`
                        )
                        checked = false
                        return
                    }
                }
                if (output) ltypes.set(output.reg, fndata.ret)
                break
            default:
                console.log('Bad opcode: ', _middlegen.Opcode[op.op], ...op.args)
                checked = false
                return
        }
    }
    for (const [id, ty] of ltypes) if (typeof ty == 'object') globalRegisterTypeMap.set(id, ty)
    for (const t of block.targets) continueBlockCheck(t, mod, func, ltypes, vTy, gTy, gFn)
}

 function checkAllTypes(units) {
    const gtypes = new Map()
    const gfuncs = new Map()
    const [root, funcs] = units
    globalRegisterTypeMap.clear()
    continueBlockCheck(
        root.startBlock,
        '_main',
        '_init',
        new Map(),
        null,
        gtypes,
        gfuncs
    )
    if (checked) _struct.performStructureExpansion.call(void 0, root.blocks, globalRegisterTypeMap)
    for (const [fnnm, u] of funcs) {
        globalRegisterTypeMap.clear()
        continueBlockCheck(
            u.startBlock,
            '_main',
            fnnm,
            new Map(),
            new Map(),
            gtypes,
            gfuncs
        )
        if (checked) _struct.performStructureExpansion.call(void 0, u.blocks, globalRegisterTypeMap)
    }

    if (!checked) return false
    return true
} exports.checkAllTypes = checkAllTypes;
