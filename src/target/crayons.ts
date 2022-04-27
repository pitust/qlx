import { allocateColors } from './colors'
import { ice } from './common'
import {
    rk_reg,
    i,
    o,
    io,
    move,
    resolveMatch,
    insn,
    ref,
    opdef,
    refkind,
    printMatches,
} from './isel'

export { rk_reg, insn, move, ref } from './isel'
export const add = Symbol.for('add') as insn
export const sub = Symbol.for('sub') as insn
export const freeze = Symbol.for('freeze') as insn
export const syscall = Symbol.for('syscall') as insn
export const syscall2 = Symbol.for('syscall2') as insn
export const br = Symbol.for('br') as insn
export const condbr = Symbol.for('condbr') as insn
export const endbr = Symbol.for('endbr') as insn
export const poke8 = Symbol.for('poke8') as insn

export const rk_dataref = Symbol.for('dataref') as refkind
export const rk_stack = Symbol.for('stack') as refkind
export const rk_label = Symbol.for('label') as refkind
export const rk_imm = Symbol.for('imm') as refkind
export const rk_phyreg = Symbol.for('phyreg') as refkind
export const rk_flags = Symbol.for('flags') as refkind

export const flags: () => ref = () => ({ kind: rk_flags, id: 0, type: 'real' })
export const label: (idx: number) => ref = idx => ({ kind: rk_label, id: idx, type: 'real' })
export const stack: (slot: number) => ref = slot => ({ kind: rk_stack, id: slot, type: 'real' })
export const imm: (imm: number) => ref = imm => ({ kind: rk_imm, id: imm, type: 'real' })
export const reg: (regi: number) => ref = regi => ({ kind: rk_reg, id: regi, type: 'real' })
export const __phyreg: (regi: number) => ref = regi => ({ kind: rk_phyreg, id: regi, type: 'real' })
export const vreg: (regi: number) => ref = regi => ({ kind: rk_reg, id: regi, type: 'aetheral' })
export const dataref: (index: number) => ref = index => ({
    kind: rk_dataref,
    id: index,
    type: 'real',
})

const operations: opdef[] = [
    ['mov^ {1}, {2}', move, [o(rk_reg), i(rk_dataref)]],
    ['mov^ {1}, {2}', move, [o(rk_reg), i(rk_imm)]],
    ['mov^ {1}, {2}', move, [o(rk_stack), i(rk_reg)]],
    ['mov^ {1}, {2}', move, [o(rk_reg), i(rk_stack)]],
    ['mov^ {1}, {2}', move, [o(rk_reg), i(rk_reg)]],
    ['mov^ \x004byte\x00r [{1}], \x005lo8_{2}', poke8, [i(rk_reg), i(rk_reg)]],
    ['add^ {1}, {2}', add, [io(rk_reg), i(rk_imm)]],
    ['add^ {1}, {2}', add, [io(rk_reg), i(rk_reg)]],
    ['add^ {1}, {2}', add, [io(rk_stack), i(rk_imm)]],
    ['add^ {1}, {2}', add, [io(rk_stack), i(rk_reg)]],
    ['sub^ {1}, {2}', sub, [io(rk_reg), i(rk_imm)]],
    ['sub^ {1}, {2}', sub, [io(rk_reg), i(rk_reg)]],
    ['sub^ {1}, {2}', sub, [io(rk_stack), i(rk_imm)]],
    ['sub^ {1}, {2}', sub, [io(rk_stack), i(rk_reg)]],
    ['; freeze {2} as {1}', freeze, [o(rk_reg), i(rk_phyreg)]],
    ['syscall^', syscall, [o(rk_reg), i(rk_reg), i(rk_reg)]],
    ['syscall^ ', syscall2, [o(rk_reg), i(rk_reg), i(rk_reg), i(rk_reg), i(rk_reg)]],

    ['test^ {2}, {2}', move, [o(rk_flags), i(rk_reg)]],
    ['{1}:', endbr, [i(rk_label)]],
    ['jmp^ {1}', br, [i(rk_label)]],
    ['jnz^ {1}', condbr, [i(rk_label), i(rk_flags)]],
]

const name2type = new Map<string, insn>()
for (const opd of operations) name2type.set(opd[0], opd[1])

const rcount = 14 // 14 regs on x86

// general algorithm:
// we isel everything, then we mostly-k-color extra regs needed, the spillages are put on the stack
// and we repeat until we are done or die (1024 ops passed and we ICE)
//
// we color the stack at the end to collapse it together, to reduce stack use.

function colorAll(
    matchto: [insn, ref[]][]
): { done: false; res: [insn, ref[]][] } | { done: true; res: [string, ref[]][] } {
    let idalloc = Math.max(
        0,
        ...matchto
            .flatMap(e => e[1])
            .filter(e => e.kind == rk_reg)
            .map(e => e.id)
    )
    const precolor = new Map<number, number>() // map[reg id] => reg, precolored registers for abi and shit
    const earlycolor = new Set<number>() // set[reg id], color those guys first
    const altmatch_id = new Map<number, number>()
    const stores = new Map<number, number[]>()
    const loads = new Map<number, number[]>()
    const frozen = new Set<number>()
    const hints = new Map<number, number>()
    let done = true
    let rootm: [string, ref[]][] = []
    function tryAltMatch(m: [string, ref[]][]) {
        for (const mm of m) {
            for (const v of mm[1].filter(e => e.type != 'real')) {
                if (v.kind != rk_reg) ice('why would you spill !reg')
                done = false
                v.type = 'real'
                if (!altmatch_id.has(v.id)) {
                    altmatch_id.set(v.id, idalloc++)
                }
                v.id = altmatch_id.get(v.id)
                earlycolor.add(v.id)
            }
            if (name2type.get(mm[0]) == freeze) {
                if (mm[1][0].kind != rk_reg) ice('cannot freeze non-reg!')
                precolor.set(mm[1][0].id, mm[1][1].id)
            }
            if (
                name2type.get(mm[0]) == move &&
                mm[1][0].kind == rk_reg &&
                mm[1][1].kind == rk_stack
            ) {
                frozen.add(mm[1][0].id)
            }
            if (
                name2type.get(mm[0]) == move &&
                mm[1][0].kind == rk_stack &&
                mm[1][1].kind == rk_reg
            ) {
                frozen.add(mm[1][1].id)
            }
            rootm.push(mm)
        }
    }
    for (const m of matchto) tryAltMatch(resolveMatch(operations, ...m, 'deep')[1])
    for (let i = 0; i < rootm.length; i++) {
        const mm = rootm[i]
        if (name2type.get(mm[0]) == freeze) continue
        for (const v of mm[1].filter(e => e.kind == rk_reg)) {
            let is_st = false,
                is_ld = false

            const argi = mm[1].indexOf(v)
            const mode = operations.find(e => e[0] == mm[0])[2][argi].mode
            if (mode == 'i' || mode == 'io') is_ld = true
            if (mode == 'o' || mode == 'io') is_st = true
            if (!stores.has(v.id)) {
                stores.set(v.id, [])
                loads.set(v.id, [])
            }
            if (is_st) stores.get(v.id).push(i)
            if (is_ld) loads.get(v.id).push(i)
        }
        if (name2type.get(mm[0]) == move && mm[1][0].kind == rk_reg && mm[1][1].kind == rk_reg) {
            hints.set(mm[1][0].id, mm[1][1].id)
            hints.set(mm[1][1].id, mm[1][0].id)
        }
    }
    const usage: number[][] = rootm.map(() => [])
    for (const [id, fml] of stores) {
        for (let load of loads.get(id).slice().reverse()) {
            if (name2type.get(rootm[load][0]) == move && !usage[load].includes(id)) load--
            while (true) {
                if (usage[load].includes(id)) break
                if (fml.includes(load)) break
                // if (load == 0) ice('no store') // FIXME: ices with gen2 and poke8
                usage[load].push(id)
                if (load == 0) break
                load--
            }
        }
        for (const str of fml) if (!usage[str].includes(id)) usage[str].push(id)
    }
    const graph = new Map<number, Set<number>>()
    const deleted = new Set<number>()
    function node(id: number) {
        return new Set([...graph.get(id)].filter(e => !deleted.has(e)))
    }
    function* nodes() {
        for (const n of graph.keys())
            if (!deleted.has(n)) yield [n, node(n)] as [number, Set<number>]
    }
    if (process.env.PRINT_USAGE_TABLES == 'yes') {
        console.log('##############')
        let i = 0
        for (const u of usage) {
            process.stdout.write(`${u.join(' | ').padStart(20)} | `)
            printMatches([[name2type.get(rootm[i][0]).description, rootm[i++][1]]])
        }
    }
    for (const quantum of usage) {
        for (const u1 of quantum) {
            if (!graph.has(u1)) graph.set(u1, new Set())
            for (const u2 of quantum)
                if (u1 != u2) {
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
        if (colors.has(n)) {
            console.trace()
            ice(`${n} has color, can't recolor lul`)
        }
        let r = 1
        const re = [...node(n)].filter(ee => colors.has(ee)).map(ee => colors.get(ee))
        if (colors.has(hints.get(n)))
            if (!re.includes(colors.get(hints.get(n)))) r = colors.get(hints.get(n))
        while (re.includes(r)) r++
        if (r == rcount && !re.includes(0)) r = 0
        if (r < rcount) colors.set(n, r)
        else spill.set(n, spillpoint++)
    }
    function doFreeze(n: number, to: number) {
        if (!graph.has(n)) {
            // if they are not in the graph, then they have no siblings.
            // if they have no siblings, they cannot possibly conflict with, like, anything
            // if they can't conflict with anything, you can just give them what they want
            colors.set(n, to)
            return
        }
        let r = to
        const re = [...node(n)].filter(ee => colors.has(ee)).map(ee => colors.get(ee))
        if (re.includes(r))
            ice(
                `graph precoloring failed: frozen register conflict: ${n} needs to become ${to}, but it is used`
            )
        colors.set(n, r)
    }
    for (const [pcn, pct] of precolor) {
        doFreeze(pcn, pct)
    }
    for (const f of frozen) if (!precolor.has(f)) color(f) // we can't spill regs used for spilling! (but they hopefully live for a short time)
    function kcolor() {
        if (graph.size == deleted.size) return
        for (const [n, e] of nodes()) {
            if (colors.has(n)) continue
            if (spill.has(n)) continue

            if (e.size < /*k*/ rcount) {
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
            } else if (spill.has(arg.id)) {
                arg.kind = rk_stack
                arg.id = spill.get(arg.id)
            }
        }
    }

    if (done) return { done: true, res: rootm }
    return { done: false, res: rootm.map(e => [name2type.get(e[0]), e[1]]) }
}

const regnames = [
    'rax',
    'rbx',
    'rcx',
    'rdx',
    'rsi',
    'rdi',
    'r8',
    'r9',
    'r10',
    'r11',
    'r12',
    'r13',
    'r14',
    'r15',
]
export function phyreg(name: string) {
    return __phyreg(regnames.indexOf(name))
}
export function completeGraphColor(target: [insn, ref[]][], strings: string[]) {
    function expandAssembly(aa: [string, ref[]][]) {
        let price = 0
        const out: string[] = [
            `%define lo8_rax al`,
            `%define lo8_rbx bl`,
            `%define lo8_rcx cl`,
            `%define lo8_rdx dl`,
            `%define lo8_rsi sil`,
            `%define lo8_rdi dil`,
            `%define lo8_r8 r8l`,
            `%define lo8_r9 r9l`,
            `%define lo8_r10 r10l`,
            `%define lo8_r11 r11l`,
            `%define lo8_r12 r12l`,
            `%define lo8_r13 r13l`,
            `%define lo8_r14 r14l`,
            `%define lo8_r15 r15l`,
        ].map(e => `\x004${e}\x00r`)
        for (const a of aa) {
            let aq = a[0]
            if (
                name2type.get(a[0]) == move &&
                a[1][0].kind == rk_reg &&
                a[1][1].kind == rk_reg &&
                a[1][0].id == a[1][1].id
            ) {
                continue
            }
            for (let i = 0; i < a[1].length; i++) {
                let tid: number = a[1][i].id
                let tkind: refkind = a[1][i].kind
                let tval = `<${tkind.description}:${tid}>`

                if (tkind == rk_stack) tval = `[\x005rsp\x00r+\x005${tid * 8}\x00r]\x00r`
                if (tkind == rk_reg) tval = `\x005${regnames[tid]}\x00r`
                if (tkind == rk_phyreg) tval = `\x005${regnames[tid]}\x00r\x000`
                if (tkind == rk_imm) tval = `\x005${tid}\x00r`
                if (tkind == rk_label) tval = `\x003l_${tid}\x00r`
                if (tkind == rk_dataref) tval = `\x004_gs${tid}\x00r`

                aq = aq.replaceAll(`{${i + 1}}`, tval)
            }
            if (!aq.endsWith(':')) aq = '    ' + aq
            else aq = '^\x003' + aq
            {
                const [pre, ...frag] = aq.split('^')
                aq = `\x00+\x002${pre}\x00r${frag.join('^')}`
            }
            {
                const [pre, ...frag] = aq.split(';')
                aq = `\x00+\x002${pre}\x00r\x000${frag.map(e => ';' + e).join('')}`
            }
            if (aq.includes('    ') && name2type.get(a[0]) != freeze) {
                price++
            }
            out.push(aq)
        }
        out.push(`\x003section .data\x00r`)
        for (let i = 0; i < strings.length; i++) {
            out.push(
                `\x004_gs${i}\x00r: \x003db\x00r \x005${JSON.stringify(
                    strings[i]
                )}\x00r,\x005 0\x00r`
            )
        }
        if (process.env.PRINT_PRICE == 'yes') console.log(`price=${price}`)
        return out
    }
    let current = target
    for (let i = 0; i < 16; i++) {
        const res = colorAll(current)
        if (res.done) {
            return expandAssembly(res.res)
        } else if (res.done == false) {
            // the above is an inference hint to typescript, because it wouldnt check for types
            current = res.res
        }
    }
    ice('cannot expand assembly!')
}
