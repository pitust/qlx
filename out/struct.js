"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _middlegen = require('./middlegen');

 function performStructureExpansion(blocks, types) {
    const mappedRegisters = new Map()
    for (const blk of blocks) {
        const transformed = []
        for (const op of blk.ops) {
            transformed.push(op)
            if (op.op == _middlegen.Opcode.NewObject) {
                // structure expansion deletes object creation operations
                transformed.pop()
                // allocate object registers
                const target = (op.args[0]).reg
                const rm = new Map()
                for (const [nm, ty] of types.get(target).members) {
                    if (typeof ty == 'object') {
                        console.log('error: nested structures are TODO (for structure expansion logic)')
                        process.exit(1)
                    }
                    rm.set(nm, { reg: _middlegen.getreg.call(void 0, ) })
                }
                mappedRegisters.set(target, rm)
            }
            if (op.op == _middlegen.Opcode.LdGlob) {
                // this ldglob needs modding
                transformed.pop()
                // build correct ldglobs
                const dst = (op.args[0]).reg
                const src = `${op.args[1]}:`
                const rm = new Map()
                for (const [nm, ty] of types.get(dst).members) {
                    const mr = _middlegen.getreg.call(void 0, )
                    rm.set(nm, { reg: mr })
                    transformed.push({
                        op: _middlegen.Opcode.LdGlob,
                        args: [{ reg: mr }, src + nm],
                        pos: op.pos,
                        meta: op.meta,
                    })
                }
                mappedRegisters.set(dst, rm)
            }
            if (op.op == _middlegen.Opcode.StGlob) {
                // this ldglob needs modding
                transformed.pop()
                // build correct ldglobs
                const dst = `${op.args[0]}:`
                const src = (op.args[1]).reg
                for (const [nm, ty] of types.get(src).members) {
                    transformed.push({
                        op: _middlegen.Opcode.StGlob,
                        args: [dst + nm, mappedRegisters.get(src).get(nm)],
                        pos: op.pos,
                        meta: op.meta,
                    })
                }
            }
            if (op.op == _middlegen.Opcode.SetProp) {
                // setprop is just renaming shit
                transformed.pop()
                const dst = (op.args[0]).reg
                const src = (op.args[1]).reg
                const prop = `${op.args[2]}`
                const val = op.args[3]
                const intrmd = new Map(mappedRegisters.get(src))
                intrmd.set(prop, val)
                mappedRegisters.set(dst, intrmd)
            }
            if (op.op == _middlegen.Opcode.GetProp) {
                // getprop is literally a move
                transformed.pop()
                const dst = op.args[0]
                const src = (op.args[1]).reg
                const prop = `${op.args[2]}`
                transformed.push({
                    pos: op.pos,
                    meta: op.meta,
                    op: _middlegen.Opcode.Move,
                    args: [dst, mappedRegisters.get(src).get(prop)]
                })
            }
        }
        blk.ops = transformed
    }
} exports.performStructureExpansion = performStructureExpansion;

