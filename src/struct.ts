import { OpArg, SSAOp, Opcode, PrimitiveType, SSABlock, SSAUnit, Type, getreg } from './middlegen'

export function performStructureExpansion(blocks: Set<SSABlock>, types: Map<number, CompoundType>) {
    const mappedRegisters = new Map<number, Map<string, OpArg>>()
    for (const blk of blocks) {
        const transformed: SSAOp[] = []
        for (const op of blk.ops) {
            transformed.push(op)
            if (op.op == Opcode.NewObject) {
                // structure expansion deletes object creation operations
                transformed.pop()
                // allocate object registers
                const target = (<{ reg: number }>op.args[0]).reg
                const rm = new Map<string, OpArg>()
                for (const [nm, ty] of types.get(target).members) {
                    if (typeof ty == 'object') {
                        console.log('error: nested structures are TODO (for structure expansion logic)')
                        process.exit(1)
                    }
                    rm.set(nm, { reg: getreg() })
                }
                mappedRegisters.set(target, rm)
            }
            if (op.op == Opcode.LdGlob) {
                // this ldglob needs modding
                transformed.pop()
                // build correct ldglobs
                const dst = (<{ reg: number }>op.args[0]).reg
                const src = `${op.args[1]}:`
                const rm = new Map<string, OpArg>()
                for (const [nm, ty] of types.get(dst).members) {
                    const mr = getreg()
                    rm.set(nm, { reg: mr })
                    transformed.push({
                        op: Opcode.LdGlob,
                        args: [{ reg: mr }, src + nm],
                        pos: op.pos,
                        meta: op.meta,
                    })
                }
                mappedRegisters.set(dst, rm)
            }
            if (op.op == Opcode.StGlob) {
                // this ldglob needs modding
                transformed.pop()
                // build correct ldglobs
                const dst = `${op.args[0]}:`
                const src = (<{ reg: number }>op.args[1]).reg
                for (const [nm, ty] of types.get(src).members) {
                    transformed.push({
                        op: Opcode.StGlob,
                        args: [dst + nm, mappedRegisters.get(src).get(nm)],
                        pos: op.pos,
                        meta: op.meta,
                    })
                }
            }
            if (op.op == Opcode.SetProp) {
                // setprop is just renaming shit
                transformed.pop()
                const dst = (<{ reg: number }>op.args[0]).reg
                const src = (<{ reg: number }>op.args[1]).reg
                const prop = `${op.args[2]}`
                const val = op.args[3]
                const intrmd = new Map(mappedRegisters.get(src))
                intrmd.set(prop, val)
                mappedRegisters.set(dst, intrmd)
            }
            if (op.op == Opcode.GetProp) {
                // getprop is literally a move
                transformed.pop()
                const dst = op.args[0]
                const src = (<{ reg: number }>op.args[1]).reg
                const prop = `${op.args[2]}`
                transformed.push({
                    pos: op.pos,
                    meta: op.meta,
                    op: Opcode.Move,
                    args: [dst, mappedRegisters.get(src).get(prop)]
                })
            }
        }
        blk.ops = transformed
    }
}

