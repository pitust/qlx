import { i, o, io, move, resolveMatch, printMatches, insn, ref, refclass, refkind } from './isel'

const add = Symbol.for('add') as insn

const rk_reg = Symbol.for('reg') as refkind
const rk_stack = Symbol.for('stack') as refkind
const rk_imm = Symbol.for('imm') as refkind

const stack = slot => ({ kind: rk_stack, id: slot, type: 'real' })
const imm = imm => ({ kind: rk_imm, id: imm, type: 'real' })
const reg = regi => ({ kind: rk_reg, id: regi, type: 'real' })

const operations: opdef[] = [
    ['mov {1}, {2}',       move, [o(rk_reg),    i(rk_imm)]],
    ['mov [rsp+{1}], {2}', move, [o(rk_stack),  i(rk_reg)]],
    ['mov {1}, [rsp+{2}]', move, [o(rk_reg),    i(rk_stack)]],
    ['add {1}, {2}',       add,  [io(rk_reg),   i(rk_imm)]],
    ['add {1}, {2}',       add,  [io(rk_reg),   i(rk_reg)]],
    ['add [rsp+{1}], {2}', add,  [io(rk_stack), i(rk_imm)]],
    ['add [rsp+{1}], {2}', add,  [io(rk_stack), i(rk_reg)]],
]


const name2type = new Map<string, insn>()
for (const opd of operations) name2type.set(opd[0], opd[1])

const rcount = 1 // 3 regs for testing stuff

// general algorithm:
// we isel everything, then we mostly-k-color extra regs needed, the spillages are put on the stack 
// and we repeat until we are done or die (1024 ops passed and we ICE)
//
// we color the stack at the end to collapse it together, to reduce stack use.

const matchto_og: [insn, ref[]][] = [
    [move, [reg(99), imm(2)]],    // s1 := 2
    [add,  [stack(0), reg(99)]],  // s0 := s0 + s1
]
function colorAll(matchto: [insn, ref[]][]): { done: false, res: [insn, ref[]][] } | { done: true, res: [string, ref[]] } {
    let idalloc = Math.max(0, ...matchto.flatMap(e => e[1]).filter(e => e.kind == rk_reg).map(e => e.id)) + 1
    const precolored = new Map<number, number>() // map[reg id] => reg, precolored registers for abi and shit
    const earlycolor = new Set<number>() // set[reg id], color those guys first
    const altmatch_id = new Map<number, number>()
    
    const newregs = new Set<number>()
    const stores = new Map<number, number[]>()
    const loads = new Map<number, number[]>()
    const frozen = new Set<number>()
    let done = true
    let rootm: [string, ref[]][] = []
    export function tryAltMatch(m: [string, ref[]][]) {
        for (const mm of m) {
            for (const v of mm[1].filter(e=>e.type != 'real')) {
                if (v.kind != rk_reg) ice('why would you spill !reg')
                done = false
                v.type = 'real'
                if (!altmatch_id.has(v.id)) {
                    altmatch_id.set(v.id, idalloc++)
                }
                v.id = altmatch_id.get(v.id)
                earlycolor.add(v.id)
            }
            for (const v of mm[1].filter(e=>e.kind == rk_reg)) {
                let is_st = false, is_ld = false
                if (name2type.get(mm[0]) == add) {
                    if (mm[1][0] == v) is_st = true
                    is_ld = true
                } else {
                    is_st = mm[1][0] == v
                    is_ld = mm[1][0] != v
                }
                if (!stores.has(v.id)) {
                    stores.set(v.id, [])
                    loads.set(v.id, [])
                }
                if (is_st) stores.get(v.id).push(rootm.length)
                if (is_ld) loads.get(v.id).push(rootm.length)
            }
            if (name2type.get(mm[0]) == move && mm[1][0].kind == rk_reg && mm[1][1].kind == rk_stack) {
                frozen.add(mm[1][0].id)
            }
            if (name2type.get(mm[0]) == move && mm[1][0].kind == rk_stack && mm[1][1].kind == rk_reg) {
                frozen.add(mm[1][1].id)
            }
            rootm.push(mm)
        }
    }
    for (const m of matchto) tryAltMatch(resolveMatch(operations, ...m, 'deep')[1])
    
    const usage: number[][] = rootm.map(() => [])
    for (const [id] of loads) {
        for (let idx of loads.get(id)) {
            while (idx > 0 && !stores.get(id).includes(idx) && !usage[idx].includes(id)) {
                usage[idx].push(id)
                idx--
            }
        }
        for (let idx of stores.get(id)) {
            if (!usage[idx].includes(id)) usage[idx].push(id)
        }
    }
    const graph = new Map<number, Set<number>>()
    const deleted = new Set<number>()
    function node(id: number) {
        return new Set([...graph.get(id)].filter(e=>!deleted.has(e)))
    }
    function* nodes() {
        for (const n of graph.keys()) if (!deleted.has(n)) yield [n, node(n)]
    }
    for (const quantum of usage) {
        for (const u1 of quantum) {
            if (!graph.has(u1)) graph.set(u1, new Set())
            for (const u2 of quantum) if (u1 != u2) {
                if (!graph.has(u2)) graph.set(u2, new Set())
                graph.get(u1).add(u2)
                graph.get(u2).add(u1)
            }
        }
    }
    
    let spillpoint = 1
    const colors = new Map<number, number>()
    const spill = new Map<number, number>()
    function color(n: number) {
        if (!graph.has(n)) ice(`graph does not have node ${n}, cannot color`)
        let r = 0
        const re = [...node(n)].filter(ee => colors.has(ee)).map(ee => colors.get(ee))
        while (re.includes(r)) r++
        if (r < rcount) colors.set(n, r)
        else spill.set(n, spillpoint++)
        // console.log('color %o -> %o', n, r >= rcount ? 'spilled' : r)
    }
    for (const f of frozen) color(f) // we can't spill regs used for spilling! (but they hopefully live for a short time)
    function kcolor() {
        if (graph.size == deleted.size) return
        for (const [n, e] of nodes()) {
            if (colors.has(n)) continue
            if (spill.has(n)) continue
            
            if (e.length < /*k*/ rcount) {
                deleted.add(n)
                kcolor()
                deleted.delete(n)
                color(n)
                return
            }
        }
        for (const [n, e] of nodes()) {
            if (colors.has(n)) continue
            if (spill.has(n)) continue
            
            deleted.add(n)
            kcolor()
            deleted.delete(n)
            color(n)
            return
        }
    }
    kcolor()
    for (let [opcls, args] of rootm) {
        for (const arg of args) {
            if (arg.kind != rk_reg) continue
            if (colors.has(arg.id)) {
                arg.id = colors.get(arg.id)
            }
            if (spill.has(arg.id)) {
                arg.kind = rk_stack
                arg.id = spill.get(arg.id)
            }
        } 
    }
    if (done) return { done: true, res: rootm }
    return { done: false, res: rootm.map(e => [name2type.get(e[0]), e[1]]) }
}

const regs = ['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi']
function expandAssembly(aa: [string, ref[]][]) {
    for (const a of aa) {
        let aq = a[0]
        for (let i = 0;i < a[1].length;i++) {
            let tid: number = a[1][i].id
            if (a[1][i].kind == rk_stack) tid *= 8 // stack is *8 because yes.
            let tval = `${tid}`
            if (a[1][i].kind == rk_reg) tval = regs[tid]
            aq = aq.replaceAll(`{${i+1}}`, tval)
        }
        console.log(aq)
    }
}
let mt2 = matchto_og
for (let i = 0;i < 128;i++) {
    const res = colorAll(mt2)
    if (res.done) {
        expandAssembly(res.res)
        break
    } else {
        mt2 = res.res
    }
}


