import { OpArg, Opcode, PrimitiveType, SSABlock, SSAUnit, Type } from './middlegen'

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
    return '<unknown>'
}
function reportTypeDiff(left: Type, right: Type, fmt: string, ...args: any[]) {
    const tnl = typename(left)
    const tnr = typename(right)
    const p = fmt.includes('%a') ? [] : [`${tnl} is not ${tnr}`]
    console.log('ERROR:', fmt.replace(/{}/g, () => args.shift()).replace('%a', tnl).replace('%b', tnr), ...p)
}
interface FuncInfo {
    ret: Type
    args: Type[]
}
function continueBlockCheck(
    block: SSABlock, mod: string, func: string, entryTypes: Map<number, Type>,
    vTy: Map<string, Type>, gTy: Map<string, Type>, gFn: Map<string, FuncInfo>
) {
    // localTypes: Map<number, Type>
    // module: string
    // func: string
    // didCheck: boolean
    const check: CachedTypecheck = {
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
    checkedBlocks.get(block)!.add(check)
    if (!checked) return
    const ltypes = new Map(entryTypes.entries())
    for (const op of block.ops) {
        switch (op.op) {
        case Opcode.End:
            return
        case Opcode.TypeGlob:
            if (gTy.has(<string>op.args[0])) {
                if (!sameType(gTy.get(<string>op.args[0]), <Type>op.args[1])) {
                    checked = false // typechecking failed
                    reportTypeDiff(gTy.get(<string>op.args[0]), <Type>op.args[1], 'type of global {}::{} mismatched:', mod, op.args[0])
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
                    'cannot store value of type %a to {}::{} of type %b', mod, op.args[0]
                )
            }
            break
        case Opcode.BindArgument:
            console.log(mod, func)
            if (!vTy.has(<string>op.args[0])) {
                vTy.set(<string>op.args[0], (<{ type: Type }>op.args[2]).type)
            }
            if (!sameType(vTy.get(<string>op.args[0]), (<{ type: Type }>op.args[2]).type)) {
                checked = false
                reportTypeDiff(
                    gTy.get(<string>op.args[0]),
                    immtype(op.args[1], ltypes),
                    'cannot store value of type %a to {}::{} of type %b', mod, op.args[0]
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
                    'cannot store value of type %a to {}::{} of type %b', mod, op.args[0]
                )
            }
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
        case Opcode.BinOp:
            if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                console.log('typechk: LdGlob: SSA invalid: output is not a reg: %o', op.args[0])
                checked = false
                return
            }
            const opTypes = {
                equal: PrimitiveType.Bool,
                notEqual: PrimitiveType.Bool,
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
            break
        case Opcode.Function:
            const target = <string>op.args[0]
            const argc = op.args.length - 2
            const ret = <{ type: Type }>op.args[1]
            const args = <{ type: Type }[]>op.args.slice(2)
            gFn.set(target, {
                ret: ret.type,
                args: args.map(e => e.type)
            })
            break
        case Opcode.ReturnVoid:
            break
        case Opcode.Call:
            const output = <{ reg: number }>op.args[0]
            const tgd = <string>op.args[1]
            const callargs = op.args.slice(2)
            if (!gFn.has(tgd)) {
                console.log(`error: ${op.pos}: cannot find function ${tgd}/${args.length}`)
                checked = false
                return
            }
            const fndata = gFn.get(tgd)
            if (fndata.args.length != callargs.length) {
                console.log(`error: ${op.pos}: function ${tgd}/${args.length} does not match the prototype ${tgd}/${fndata}.`)
                checked = false
                return
            }
            for (let i = 0;i < fndata.args.length;i++) {
                if (!sameType(fndata.args[i], immtype(callargs[i], ltypes))) {
                    console.log(`error: ${op.pos}: function ${tgd}/${args.length} cannot be called because parameters are incorrect.`)
                    checked = false
                    return
                }
            }
            ltypes.set(output.reg, fndata.ret)
            break
        default:
            console.log('Bad opcode: ', Opcode[op.op], ...op.args)
            checked = false
            return
        }
    }
    for (const t of block.targets) continueBlockCheck(t, mod, func, ltypes, vTy, gTy, gFn)
}

export function checkAllTypes(units: [SSAUnit, Map<string, SSAUnit>]) {
    const gtypes = new Map()
    const gfuncs = new Map()
    const [root, funcs] = units
    continueBlockCheck(root.startBlock, '_main', '_init', new Map<number, Type>(), null, gtypes, gfuncs)
    for (const [fnnm, u] of funcs) {
        continueBlockCheck(u.startBlock, '_main', fnnm, new Map<number, Type>(), new Map<string, Type>(), gtypes, gfuncs)
    }
        
    if (!checked) return false
    return true
}
