"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _createNamedExportFrom(obj, localName, importedName) { Object.defineProperty(exports, localName, {enumerable: true, get: () => obj[importedName]}); }var _common = require('./common');












var _isel = require('./isel'); _createNamedExportFrom(_isel, 'rk_reg', 'rk_reg'); _createNamedExportFrom(_isel, 'insn', 'insn'); _createNamedExportFrom(_isel, 'move', 'move'); _createNamedExportFrom(_isel, 'ref', 'ref');


 const add = Symbol.for('add') ; exports.add = add
 const freeze = Symbol.for('freeze') ; exports.freeze = freeze
 const syscall = Symbol.for('syscall') ; exports.syscall = syscall
 const br = Symbol.for('br') ; exports.br = br
 const condbr = Symbol.for('condbr') ; exports.condbr = condbr
 const endbr = Symbol.for('endbr') ; exports.endbr = endbr

const rk_stack = Symbol.for('stack') 
const rk_label = Symbol.for('label') 
const rk_imm = Symbol.for('imm') 
const rk_phyreg = Symbol.for('phyreg') 
const rk_flags = Symbol.for('flags') 

 const flags = () => ({ kind: rk_flags, id: 0, type: 'real' }); exports.flags = flags
 const label = idx => ({ kind: rk_label, id: idx, type: 'real' }); exports.label = label
 const stack = slot => ({ kind: rk_stack, id: slot, type: 'real' }); exports.stack = stack
 const imm = imm => ({ kind: rk_imm, id: imm, type: 'real' }); exports.imm = imm
 const reg = regi => ({ kind: _isel.rk_reg, id: regi, type: 'real' }); exports.reg = reg
 const phyreg = regi => ({ kind: rk_phyreg, id: regi, type: 'real' }); exports.phyreg = phyreg
 const vreg = regi => ({ kind: _isel.rk_reg, id: regi, type: 'aetheral' }); exports.vreg = vreg

const operations = [
    ['mov^ {1}, {2}', _isel.move, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, rk_imm)]],
    ['mov^ {1}, {2}', _isel.move, [_isel.o.call(void 0, rk_stack), _isel.i.call(void 0, _isel.rk_reg)]],
    ['mov^ {1}, {2}', _isel.move, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, rk_stack)]],
    ['mov^ {1}, {2}', _isel.move, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg)]],
    ['add^ {1}, {2}', exports.add, [_isel.io.call(void 0, _isel.rk_reg), _isel.i.call(void 0, rk_imm)]],
    ['add^ {1}, {2}', exports.add, [_isel.io.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg)]],
    ['add^ {1}, {2}', exports.add, [_isel.io.call(void 0, rk_stack), _isel.i.call(void 0, rk_imm)]],
    ['add^ {1}, {2}', exports.add, [_isel.io.call(void 0, rk_stack), _isel.i.call(void 0, _isel.rk_reg)]],
    ['; freeze {2} as {1}', exports.freeze, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, rk_phyreg)]],
    ['syscall^', exports.syscall, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg)]],

    ['test^ {2}, {2}', _isel.move, [_isel.o.call(void 0, rk_flags), _isel.i.call(void 0, _isel.rk_reg)]],
    ['l_{1}:', exports.endbr, [_isel.i.call(void 0, rk_label)]],
    ['jmp^ {1}', exports.br, [_isel.i.call(void 0, rk_label)]],
    ['jnz^ {1}', exports.condbr, [_isel.i.call(void 0, rk_label), _isel.i.call(void 0, rk_flags)]],
]

const name2type = new Map()
for (const opd of operations) name2type.set(opd[0], opd[1])

const rcount = 6 // 6 regs on x86

// general algorithm:
// we isel everything, then we mostly-k-color extra regs needed, the spillages are put on the stack
// and we repeat until we are done or die (1024 ops passed and we ICE)
//
// we color the stack at the end to collapse it together, to reduce stack use.

function colorAll(
    matchto
) {
    let idalloc =
        Math.max(
            0,
            ...matchto
                .flatMap(e => e[1])
                .filter(e => e.kind == _isel.rk_reg)
                .map(e => e.id)
        ) + 1
    const precolor = new Map() // map[reg id] => reg, precolored registers for abi and shit
    const earlycolor = new Set() // set[reg id], color those guys first
    const altmatch_id = new Map()

    const stores = new Map()
    const loads = new Map()
    const frozen = new Set()
    let done = true
    let rootm = []
    function tryAltMatch(m) {
        for (const mm of m) {
            for (const v of mm[1].filter(e => e.type != 'real')) {
                if (v.kind != _isel.rk_reg) _common.ice.call(void 0, 'why would you spill !reg')
                done = false
                v.type = 'real'
                if (!altmatch_id.has(v.id)) {
                    altmatch_id.set(v.id, idalloc++)
                }
                v.id = altmatch_id.get(v.id)
                earlycolor.add(v.id)
            }
            for (const v of mm[1].filter(e => e.kind == _isel.rk_reg)) {
                let is_st = false,
                    is_ld = false
                if (name2type.get(mm[0]) == exports.add) {
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
            if (name2type.get(mm[0]) == exports.freeze) {
                if (mm[1][0].kind != _isel.rk_reg) _common.ice.call(void 0, 'cannot freeze non-reg!')
                precolor.set(mm[1][0].id, mm[1][1].id)
            }
            if (
                name2type.get(mm[0]) == _isel.move &&
                mm[1][0].kind == _isel.rk_reg &&
                mm[1][1].kind == rk_stack
            ) {
                frozen.add(mm[1][0].id)
            }
            if (
                name2type.get(mm[0]) == _isel.move &&
                mm[1][0].kind == rk_stack &&
                mm[1][1].kind == _isel.rk_reg
            ) {
                frozen.add(mm[1][1].id)
            }
            rootm.push(mm)
        }
    }
    for (const m of matchto) tryAltMatch(_isel.resolveMatch.call(void 0, operations, ...m, 'deep')[1])

    const usage = rootm.map(() => [])
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
    const graph = new Map()
    const deleted = new Set()
    function node(id) {
        return new Set([...graph.get(id)].filter(e => !deleted.has(e)))
    }
    function* nodes() {
        for (const n of graph.keys())
            if (!deleted.has(n)) yield [n, node(n)] 
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
    const colors = new Map()
    const spill = new Map()
    function color(n) {
        if (!graph.has(n)) _common.ice.call(void 0, `graph does not have node ${n}, cannot color`)
        if (colors.has(n)) _common.ice.call(void 0, `${n} has color, can't recolor lul`)
        let r = 0
        const re = [...node(n)].filter(ee => colors.has(ee)).map(ee => colors.get(ee))
        while (re.includes(r)) r++
        if (r < rcount) colors.set(n, r)
        else spill.set(n, spillpoint++)
    }
    function doFreeze(n, to) {
        if (!graph.has(n)) _common.ice.call(void 0, `graph does not have node ${n}, cannot color`)
        let r = to
        const re = [...node(n)].filter(ee => colors.has(ee)).map(ee => colors.get(ee))
        if (re.includes(r)) _common.ice.call(void 0, 'cannot color graph, frozen register conflict!')
        colors.set(n, r)
    }
    for (const [pcn, pct] of precolor) {
        doFreeze(pcn, pct)
    }
    for (const f of frozen) color(f) // we can't spill regs used for spilling! (but they hopefully live for a short time)
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
            if (arg.kind != _isel.rk_reg) continue
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

 function completeGraphColor(target) {
    const regs = ['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi']
    function expandAssembly(aa) {
        const out = []
        for (const a of aa) {
            let aq = a[0]
            for (let i = 0; i < a[1].length; i++) {
                let tid = a[1][i].id
                let tkind = a[1][i].kind
                let tval = `<${tkind.description}:${tid}>`

                if (tkind == rk_stack) tval = `[\x005rsp\x00r+\x005${tid * 8}\x00r]\x00r`
                if (tkind == _isel.rk_reg) tval = `\x005${regs[tid]}\x00r`
                if (tkind == rk_phyreg) tval = `\x005${regs[tid]}\x00r\x000`
                if (tkind == rk_imm) tval = `\x005${tid}\x00r`
                if (tkind == rk_label) tval = `${tid}`

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
            out.push(aq)
        }
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
    _common.ice.call(void 0, 'cannot expand assembly!')
} exports.completeGraphColor = completeGraphColor;