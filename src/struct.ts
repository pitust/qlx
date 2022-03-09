import { OpArg, SSAOp, Opcode, PrimitiveType, SSABlock, SSAUnit, Type, getreg } from './middlegen'

export function performStructureExpansion(blocks: Set<SSABlock>, types: Map<number, CompoundType>) {
    const mappedRegisters = new Map<number, Map<string, OpArg>>()
    for (const blk of blocks) {
        let argumentIndex = 0
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
            } else if (op.op == Opcode.LdGlob || op.op == Opcode.LdLoc) {
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
                        op: op.op,
                        args: [{ reg: mr }, src + nm],
                        pos: op.pos,
                        meta: op.meta,
                    })
                }
                mappedRegisters.set(dst, rm)
            } else if (op.op == Opcode.StGlob) {
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
            } else if (op.op == Opcode.SetProp) {
                // setprop is just renaming shit
                transformed.pop()
                const dst = (<{ reg: number }>op.args[0]).reg
                const src = (<{ reg: number }>op.args[1]).reg
                const prop = `${op.args[2]}`
                const val = op.args[3]
                const intrmd = new Map(mappedRegisters.get(src))
                intrmd.set(prop, val)
                mappedRegisters.set(dst, intrmd)
            } else if (op.op == Opcode.GetProp) {
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
            } else if (op.op == Opcode.BindArgument) {
                transformed.pop()
                const name = `${op.args[0]}`
                const type = (<{ type: Type }>op.args[2]).type
                
                if (typeof type == 'object') {
                    for (const [nm, ty] of type.members) {
                        transformed.push({
                            pos: op.pos,
                            meta: op.meta,
                            op: Opcode.BindArgument,
                            args: [name + ':' + nm, argumentIndex++, { type: ty }]
                        })
                    }
                } else {
                    transformed.push({
                        pos: op.pos,
                        meta: op.meta,
                        op: Opcode.BindArgument,
                        args: [name, argumentIndex++, { type }]
                    })
                }
            } else if (op.op == Opcode.Call) {
                const args = op.args.slice(2)
                const newargs: OpArg[] = op.args.slice(0, 2)
                for (const arg of args) {
                    if (typeof arg == 'object' && 'reg' in arg && types.has(arg.reg)) {
                        for (const [,mr] of mappedRegisters.get(arg.reg)) {
                            newargs.push(mr)
                        }
                    } else {
                        newargs.push(arg)
                    }
                }
                op.args = newargs
            }
        }
        blk.ops = transformed
    }
}

