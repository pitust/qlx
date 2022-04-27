"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _createNamedExportFrom(obj, localName, importedName) { Object.defineProperty(exports, localName, {enumerable: true, get: () => obj[importedName]}); }
var _common = require('./common');












var _isel = require('./isel'); _createNamedExportFrom(_isel, 'rk_reg', 'rk_reg'); _createNamedExportFrom(_isel, 'insn', 'insn'); _createNamedExportFrom(_isel, 'move', 'move'); _createNamedExportFrom(_isel, 'ref', 'ref');


 const add = Symbol.for('add') ; exports.add = add
 const sub = Symbol.for('sub') ; exports.sub = sub
 const freeze = Symbol.for('freeze') ; exports.freeze = freeze
 const syscall = Symbol.for('syscall') ; exports.syscall = syscall
 const syscall2 = Symbol.for('syscall2') ; exports.syscall2 = syscall2
 const br = Symbol.for('br') ; exports.br = br
 const condbr = Symbol.for('condbr') ; exports.condbr = condbr
 const endbr = Symbol.for('endbr') ; exports.endbr = endbr
 const poke8 = Symbol.for('poke8') ; exports.poke8 = poke8

 const rk_dataref = Symbol.for('dataref') ; exports.rk_dataref = rk_dataref
 const rk_stack = Symbol.for('stack') ; exports.rk_stack = rk_stack
 const rk_label = Symbol.for('label') ; exports.rk_label = rk_label
 const rk_imm = Symbol.for('imm') ; exports.rk_imm = rk_imm
 const rk_phyreg = Symbol.for('phyreg') ; exports.rk_phyreg = rk_phyreg
 const rk_flags = Symbol.for('flags') ; exports.rk_flags = rk_flags

 const flags = () => ({ kind: exports.rk_flags, id: 0, type: 'real' }); exports.flags = flags
 const label = idx => ({ kind: exports.rk_label, id: idx, type: 'real' }); exports.label = label
 const stack = slot => ({ kind: exports.rk_stack, id: slot, type: 'real' }); exports.stack = stack
 const imm = imm => ({ kind: exports.rk_imm, id: imm, type: 'real' }); exports.imm = imm
 const reg = regi => ({ kind: _isel.rk_reg, id: regi, type: 'real' }); exports.reg = reg
 const __phyreg = regi => ({ kind: exports.rk_phyreg, id: regi, type: 'real' }); exports.__phyreg = __phyreg
 const vreg = regi => ({ kind: _isel.rk_reg, id: regi, type: 'aetheral' }); exports.vreg = vreg
 const dataref = index => ({
    kind: exports.rk_dataref,
    id: index,
    type: 'real',
}); exports.dataref = dataref

const operations = [
    ['mov^ {1}, {2}', _isel.move, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, exports.rk_dataref)]],
    ['mov^ {1}, {2}', _isel.move, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, exports.rk_imm)]],
    ['mov^ {1}, {2}', _isel.move, [_isel.o.call(void 0, exports.rk_stack), _isel.i.call(void 0, _isel.rk_reg)]],
    ['mov^ {1}, {2}', _isel.move, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, exports.rk_stack)]],
    ['mov^ {1}, {2}', _isel.move, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg)]],
    ['mov^ \x004byte\x00r [{1}], \x005lo8_{2}', exports.poke8, [_isel.i.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg)]],
    ['add^ {1}, {2}', exports.add, [_isel.io.call(void 0, _isel.rk_reg), _isel.i.call(void 0, exports.rk_imm)]],
    ['add^ {1}, {2}', exports.add, [_isel.io.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg)]],
    ['add^ {1}, {2}', exports.add, [_isel.io.call(void 0, exports.rk_stack), _isel.i.call(void 0, exports.rk_imm)]],
    ['add^ {1}, {2}', exports.add, [_isel.io.call(void 0, exports.rk_stack), _isel.i.call(void 0, _isel.rk_reg)]],
    ['sub^ {1}, {2}', exports.sub, [_isel.io.call(void 0, _isel.rk_reg), _isel.i.call(void 0, exports.rk_imm)]],
    ['sub^ {1}, {2}', exports.sub, [_isel.io.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg)]],
    ['sub^ {1}, {2}', exports.sub, [_isel.io.call(void 0, exports.rk_stack), _isel.i.call(void 0, exports.rk_imm)]],
    ['sub^ {1}, {2}', exports.sub, [_isel.io.call(void 0, exports.rk_stack), _isel.i.call(void 0, _isel.rk_reg)]],
    ['; freeze {2} as {1}', exports.freeze, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, exports.rk_phyreg)]],
    ['syscall^', exports.syscall, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg)]],
    ['syscall^ ', exports.syscall2, [_isel.o.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg), _isel.i.call(void 0, _isel.rk_reg)]],

    ['test^ {2}, {2}', _isel.move, [_isel.o.call(void 0, exports.rk_flags), _isel.i.call(void 0, _isel.rk_reg)]],
    ['{1}:', exports.endbr, [_isel.i.call(void 0, exports.rk_label)]],
    ['jmp^ {1}', exports.br, [_isel.i.call(void 0, exports.rk_label)]],
    ['jnz^ {1}', exports.condbr, [_isel.i.call(void 0, exports.rk_label), _isel.i.call(void 0, exports.rk_flags)]],
]

const name2type = new Map()
for (const opd of operations) name2type.set(opd[0], opd[1])

const rcount = 14 // 14 regs on x86

// general algorithm:
// we isel everything, then we mostly-k-color extra regs needed, the spillages are put on the stack
// and we repeat until we are done or die (1024 ops passed and we ICE)
//
// we color the stack at the end to collapse it together, to reduce stack use.

function colorAll(
    matchto
) {
    let idalloc = Math.max(
        0,
        ...matchto
            .flatMap(e => e[1])
            .filter(e => e.kind == _isel.rk_reg)
            .map(e => e.id)
    )
    const precolor = new Map() // map[reg id] => reg, precolored registers for abi and shit
    const earlycolor = new Set() // set[reg id], color those guys first
    const altmatch_id = new Map()
    const stores = new Map()
    const loads = new Map()
    const frozen = new Set()
    const hints = new Map()
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
            if (name2type.get(mm[0]) == exports.freeze) {
                if (mm[1][0].kind != _isel.rk_reg) _common.ice.call(void 0, 'cannot freeze non-reg!')
                precolor.set(mm[1][0].id, mm[1][1].id)
            }
            if (
                name2type.get(mm[0]) == _isel.move &&
                mm[1][0].kind == _isel.rk_reg &&
                mm[1][1].kind == exports.rk_stack
            ) {
                frozen.add(mm[1][0].id)
            }
            if (
                name2type.get(mm[0]) == _isel.move &&
                mm[1][0].kind == exports.rk_stack &&
                mm[1][1].kind == _isel.rk_reg
            ) {
                frozen.add(mm[1][1].id)
            }
            rootm.push(mm)
        }
    }
    for (const m of matchto) tryAltMatch(_isel.resolveMatch.call(void 0, operations, ...m, 'deep')[1])
    for (let i = 0; i < rootm.length; i++) {
        const mm = rootm[i]
        if (name2type.get(mm[0]) == exports.freeze) continue
        for (const v of mm[1].filter(e => e.kind == _isel.rk_reg)) {
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
        if (name2type.get(mm[0]) == _isel.move && mm[1][0].kind == _isel.rk_reg && mm[1][1].kind == _isel.rk_reg) {
            hints.set(mm[1][0].id, mm[1][1].id)
            hints.set(mm[1][1].id, mm[1][0].id)
        }
    }
    const usage = rootm.map(() => [])
    for (const [id, fml] of stores) {
        for (let load of loads.get(id).slice().reverse()) {
            if (name2type.get(rootm[load][0]) == _isel.move && !usage[load].includes(id)) load--
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
    const graph = new Map()
    const deleted = new Set()
    function node(id) {
        return new Set([...graph.get(id)].filter(e => !deleted.has(e)))
    }
    function* nodes() {
        for (const n of graph.keys())
            if (!deleted.has(n)) yield [n, node(n)] 
    }
    if (process.env.PRINT_USAGE_TABLES == 'yes') {
        console.log('##############')
        let i = 0
        for (const u of usage) {
            process.stdout.write(`${u.join(' | ').padStart(20)} | `)
            _isel.printMatches.call(void 0, [[name2type.get(rootm[i][0]).description, rootm[i++][1]]])
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
    const colors = new Map()
    const spill = new Map()
    function color(n) {
        if (!graph.has(n)) _common.ice.call(void 0, `graph does not have node ${n}, cannot color`)
        if (colors.has(n)) {
            console.trace()
            _common.ice.call(void 0, `${n} has color, can't recolor lul`)
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
    function doFreeze(n, to) {
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
            _common.ice.call(void 0, 
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
            if (arg.kind != _isel.rk_reg) continue
            if (colors.has(arg.id)) {
                arg.id = colors.get(arg.id)
            } else if (spill.has(arg.id)) {
                arg.kind = exports.rk_stack
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
 function phyreg(name) {
    return exports.__phyreg.call(void 0, regnames.indexOf(name))
} exports.phyreg = phyreg;
 function completeGraphColor(target, strings) {
    function expandAssembly(aa) {
        let price = 0
        const out = [
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
                name2type.get(a[0]) == _isel.move &&
                a[1][0].kind == _isel.rk_reg &&
                a[1][1].kind == _isel.rk_reg &&
                a[1][0].id == a[1][1].id
            ) {
                continue
            }
            for (let i = 0; i < a[1].length; i++) {
                let tid = a[1][i].id
                let tkind = a[1][i].kind
                let tval = `<${tkind.description}:${tid}>`

                if (tkind == exports.rk_stack) tval = `[\x005rsp\x00r+\x005${tid * 8}\x00r]\x00r`
                if (tkind == _isel.rk_reg) tval = `\x005${regnames[tid]}\x00r`
                if (tkind == exports.rk_phyreg) tval = `\x005${regnames[tid]}\x00r\x000`
                if (tkind == exports.rk_imm) tval = `\x005${tid}\x00r`
                if (tkind == exports.rk_label) tval = `\x003l_${tid}\x00r`
                if (tkind == exports.rk_dataref) tval = `\x004_gs${tid}\x00r`

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
            if (aq.includes('    ') && name2type.get(a[0]) != exports.freeze) {
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
    _common.ice.call(void 0, 'cannot expand assembly!')
} exports.completeGraphColor = completeGraphColor;
