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
function continueBlockCheck(
    block: SSABlock, mod: string, func: string, entryTypes: Map<number, Type>,
    vTy: Map<string, Type>, gTy: Map<string, Type>
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
        case Opcode.BinOp:
            if (typeof op.args[0] != 'object' || !('reg' in op.args[0])) {
                console.log('typechk: LdGlob: SSA invalid: output is not a reg: %o', op.args[0])
                checked = false
                return
            }
            const opTypes = {
                notEqual: PrimitiveType.Bool,
                add: PrimitiveType.Float,
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
        default:
            console.log('Bad opcode: ', Opcode[op.op], ...op.args)
            checked = false
            return
        }
    }
    for (const t of block.targets) continueBlockCheck(t, mod, func, ltypes, vTy, gTy)
}

export function checkAllTypes(unit: SSAUnit) {
    continueBlockCheck(unit.startBlock, '_main', '_init', new Map<number, Type>(), new Map(), new Map())
    if (!checked) return false
    return true
}
