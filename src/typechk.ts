import { CompoundType, OpArg, Opcode, PrimitiveType, SSABlock, SSAUnit, Type } from './middlegen'
import { performStructureExpansion } from './struct'

interface CachedTypecheck {
    localTypes: Map<number, Type>
    module: string
    func: string
    didCheck: boolean
}

type CheckCache = Set<CachedTypecheck>

const checkedBlocks = new WeakMap<SSABlock, CheckCache>()
let checked = true

function sameType(t1: Type, t2: Type) {
    return t1 == t2
}
function immtype(opa: OpArg, lty: Map<number, Type>) {
    if (typeof opa == 'number') return PrimitiveType.Float
    if (typeof opa == 'string') return PrimitiveType.String
    if ('reg' in opa) return lty.get(opa['reg'])!
    console.log('ERROR: reflection is TODO!')
    checked = false
    return PrimitiveType.Null
}
function typename(ty: Type) {
    if (ty == PrimitiveType.Null) return 'null'
    if (ty == PrimitiveType.Float) return 'float'
    if (ty == PrimitiveType.String) return 'string'
    if (typeof ty == 'object' && 'name' in ty) return 'struct{' + ty.name + '}'
    return '<unknown>'
}
function reportTypeDiff(left: Type, right: Type, fmt: string, ...args: any[]) {
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
interface FuncInfo {
    ret: Type
    args: Type[]
}
const globalRegisterTypeMap = new Map<number, CompoundType>()
function continueBlockCheck(
    block: SSABlock,
    mod: string,
    func: string,
    entryTypes: Map<number, Type>,
    vTy: Map<string, Type>,
    gTy: Map<string, Type>,
    gFn: Map<string, FuncInfo>
) {
    // localTypes: Map<number, Type>
    // module: string
    // func: string
    // didCheck: boolean
    const check: CachedTypecheck = {
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
    checkedBlocks.get(block)!.add(check)
    if (!checked) return
    const ltypes = new Map(entryTypes.entries())
    l: for (const op of block.ops) {
        switch (op.op) {
            case Opcode.End:
                break l
            case Opcode.TypeGlob:
                if (gTy.has(<string>op.args[0])) {
                    if (!sameType(gTy.get(<string>op.args[0]), <Type>op.args[1])) {
                        checked = false // typechecking failed
                        reportTypeDiff(
                            gTy.get(<string>op.args[0]),
                            <Type>op.args[1],
                            'type of global {}::{} mismatched:',
                            mod,
                            op.args[0]
                        )
                    }
                } else {
                    gTy.set(<string>op.args[0], (<{ type: Type }>op.args[1]).type)
                }
                break
            case Opcode.StInitGlob:
                if (!gTy.has(<string>op.args[0])) {
                    gTy.set(<string>op.args[0], immtype(op.args[1], ltypes))
                }
                if (!sameType(gTy.get(<string>op.args[0]), immtype(op.args[1], ltypes))) {
                    checked = false
                    reportTypeDiff(
                        gTy.get(<string>op.args[0]),
                        immtype(op.args[1], ltypes),
                        'cannot store value of type %a to {}::{} of type %b',
                        mod,
                        op.args[0]
                    )
                }
                break
            case Opcode.StInitLoc:
                if (!vTy.has(<string>op.args[0])) {
                    vTy.set(<string>op.args[0], immtype(op.args[1], ltypes))
                }
                if (!sameType(vTy.get(<string>op.args[0]), immtype(op.args[1], ltypes))) {
                    checked = false
                    reportTypeDiff(
                        gTy.get(<string>op.args[0]),
                        immtype(op.args[1], ltypes),
                        'cannot store value of type %a to {}::{}::{} of type %b',
                        mod,
                        func,
                        op.args[0]
                    )
                }
                break
            case Opcode.BindArgument:
                if (!vTy.has(<string>op.args[0])) {
                    vTy.set(<string>op.args[0], (<{ type: Type }>op.args[2]).type)
                }
                if (!sameType(vTy.get(<string>op.args[0]), (<{ type: Type }>op.args[2]).type)) {
                    checked = false
                    reportTypeDiff(
                        gTy.get(<string>op.args[0]),
                        immtype(op.args[1], ltypes),
                        'cannot store value of type %a to {}::{} of type %b',
                        mod,
                        op.args[0]
                    )
                }
                break
            case Opcode.StGlob:
                if (!gTy.has(<string>op.args[0])) {
                    checked = false
                    break
                }
                if (!sameType(gTy.get(<string>op.args[0]), immtype(op.args[1], ltypes))) {
                    checked = false
                    reportTypeDiff(
                        gTy.get(<string>op.args[0]),
                        immtype(op.args[1], ltypes),
                        'cannot store value of type %a to {}::{} of type %b',
                        mod,
                        op.args[0]
                    )
                }
                break
            case Opcode.StLoc:
                if (!vTy.has(<string>op.args[0])) {
                    checked = false
                    break
                }
                if (!sameType(vTy.get(<string>op.args[0]), immtype(op.args[1], ltypes))) {
                    checked = false
                    reportTypeDiff(
                        vTy.get(<string>op.args[0]),
                        immtype(op.args[1], ltypes),
                        'cannot store value of type %a to {}::{} of type %b',
                        mod,
                        op.args[0]
                    )
                }
                break
            case Opcode.NewObject:
                if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                    console.log(
                        'typechk: NewObject: SSA invalid: output is not a reg: %o',
                        op.args[0]
                    )
                    checked = false
                    return
                }
                ltypes.set(op.args[0].reg, (<{ type: Type }>op.args[1]).type)
                break
            case Opcode.LdGlob:
                if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                    console.log('typechk: LdGlob: SSA invalid: output is not a reg: %o', op.args[0])
                    checked = false
                    return
                }
                if (!gTy.has(<string>op.args[1])) {
                    console.log('No such variable: ' + <string>op.args[1])
                    checked = false
                    return
                }
                ltypes.set(op.args[0].reg, gTy.get(<string>op.args[1]))
                break
            case Opcode.LdLoc:
                if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                    console.log('typechk: LdLoc: SSA invalid: output is not a reg: %o', op.args[0])
                    checked = false
                    return
                }
                if (!vTy.has(<string>op.args[1])) {
                    console.log('No such local variable: ' + <string>op.args[1])
                    checked = false
                    return
                }
                ltypes.set(op.args[0].reg, vTy.get(<string>op.args[1]))
                break
            case Opcode.GetProp: {
                const obj = immtype(op.args[1], ltypes)
                if (typeof obj != 'object') {
                    console.log('cannot get property %s on type %s', op.args[2], typename(obj))
                    checked = false
                    break
                }
                ltypes.set((<{ reg: number }>op.args[0]).reg, obj.members.get(`${op.args[2]}`))
                break
            }
            case Opcode.SetProp: {
                const target = ltypes.get((<{ reg: number }>op.args[1]).reg)
                ltypes.set(
                    (<{ reg: number }>op.args[0]).reg,
                    ltypes.get((<{ reg: number }>op.args[1]).reg)
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
            case Opcode.BinOp:
                if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                    console.log('typechk: LdGlob: SSA invalid: output is not a reg: %o', op.args[0])
                    checked = false
                    return
                }
                const opTypes = {
                    equal: PrimitiveType.Bool,
                    notEqual: PrimitiveType.Bool,
                    lessThan: PrimitiveType.Bool,
                    add: PrimitiveType.Float,
                    sub: PrimitiveType.Float,
                }
                if (!(<string>op.args[1] in opTypes)) {
                    console.log('Bad binop:', op.args[1])
                    checked = false
                    return
                }
                ltypes.set(op.args[0].reg, opTypes[<string>op.args[1]])
                break
            case Opcode.TargetOp:
                // target ops are assumed to be fine
                // we need to set up the outputs though
                if (op.args[0] == 'read') {
                    const out = <{ reg: number }>op.args[1]
                    ltypes.set(out.reg, PrimitiveType.Float)
                }
                if (op.args[0] == '_lookupblox') {
                    const out = <{ reg: number }>op.args[1]
                    ltypes.set(out.reg, PrimitiveType.Float)
                }
                break
            case Opcode.AsmSetSlot:
            case Opcode.Asm:
                break
            case Opcode.AsmGetSlot:
                const [_to, _slot, nam, kind] = op.args    
                const out = <{ reg: number }>op.args[0]
                if (kind == Opcode.LdGlob) {
                    if (!gTy.has(<string>nam)) {
                        console.log('No such variable: ' + <string>nam)
                        checked = false
                        return
                    }
                    ltypes.set(out.reg, gTy.get(<string>nam))
                } else if (kind == Opcode.LdLoc) {
                    if (!vTy.has(<string>nam)) {
                        console.log('No such local variable: ' + <string>nam)
                        checked = false
                        return
                    }
                    ltypes.set(out.reg, vTy.get(<string>nam))
                }
                break
            case Opcode.Function:
                const target = <string>op.args[0]
                const argc = op.args.length - 2
                const ret = <{ type: Type }>op.args[1]
                const args = <{ type: Type }[]>op.args.slice(2)
                gFn.set(target, {
                    ret: ret.type,
                    args: args.map(e => e.type),
                })
                break
            case Opcode.ReturnVoid:
                break
            case Opcode.Return:
                if (!sameType(gFn.get(func).ret, immtype(op.args[0], ltypes))) {
                    checked = false
                    reportTypeDiff(
                        immtype(op.args[0], ltypes),
                        gTy.get(<string>op.args[0]),
                        'cannot return value of type %a as the function {}::{} returns type %b',
                        mod,
                        func
                    )
                }
                break
            case Opcode.Call:
                const output = <{ reg: number }>op.args[0]
                const tgd = <string>op.args[1]
                const callargs = op.args.slice(2)
                if (tgd.startsWith('__intrin::') && !gFn.has(tgd)) {
                    // intrinsics are magical: they are autoderived on first use
                    const typespec = [...tgd.split('_').slice(-1)[0]]
                    const ts = typespec.map(
                        e =>
                            ({
                                v: PrimitiveType.Void,
                                i: PrimitiveType.Float,
                                s: PrimitiveType.String,
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
                console.log('Bad opcode: ', Opcode[op.op], ...op.args)
                checked = false
                return
        }
    }
    for (const [id, ty] of ltypes) if (typeof ty == 'object') globalRegisterTypeMap.set(id, ty)
    for (const t of block.targets) continueBlockCheck(t, mod, func, ltypes, vTy, gTy, gFn)
}

export function checkAllTypes(units: [SSAUnit, Map<string, SSAUnit>]) {
    const gtypes = new Map()
    const gfuncs = new Map()
    const [root, funcs] = units
    globalRegisterTypeMap.clear()
    continueBlockCheck(
        root.startBlock,
        '_main',
        '_init',
        new Map<number, Type>(),
        null,
        gtypes,
        gfuncs
    )
    if (checked) performStructureExpansion(root.blocks, globalRegisterTypeMap)
    for (const [fnnm, u] of funcs) {
        globalRegisterTypeMap.clear()
        continueBlockCheck(
            u.startBlock,
            '_main',
            fnnm,
            new Map<number, Type>(),
            new Map<string, Type>(),
            gtypes,
            gfuncs
        )
        if (checked) performStructureExpansion(u.blocks, globalRegisterTypeMap)
    }

    if (!checked) return false
    return true
}
