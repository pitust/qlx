import { i, o, io, move, resolveMatch, printMatches, insn, ref, refclass, refkind } from './isel'

const add = Symbol.for('add') as insn

const rk_reg = Symbol.for('reg') as refkind
const rk_stack = Symbol.for('stack') as refkind
const rk_imm = Symbol.for('imm') as refkind
const stack = slot => ({ kind: rk_stack, id: slot, type: 'real' })
const imm = imm => ({ kind: rk_imm, id: imm, type: 'real' })
const reg = regi => ({ kind: rk_reg, id: regi, type: 'real' })

const operations: opdef[] = [
    ['li', move, [o(rk_reg), i(rk_imm)]],
    ['st', move, [o(rk_stack), i(rk_reg)]],
    ['ld', move, [o(rk_reg), i(rk_stack)]],
    ['add', add, [io(rk_reg), i(rk_reg)]],
]

const matchto: [insn, ref[]][] = [
    [add, [stack(0), imm(1)]],    // s0 := s0 + 1
]

for (const m of matchto) printMatches(resolveMatch(operations, ...m, 'deep')[1])



