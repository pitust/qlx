"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }var _common = require('./common');






 function io(k) {
    return { kind: k, mode: 'io' }
} exports.io = io;
 function i(k) {
    return { kind: k, mode: 'i' }
} exports.i = i;
 function o(k) {
    return { kind: k, mode: 'o' }
} exports.o = o;

 const rk_reg = Symbol.for('reg') ; exports.rk_reg = rk_reg
 const move = Symbol.for('move') ; exports.move = move

let aetherkind = 1
let aflist = [0]

 function resolveMatch(
    operations,
    opkind,
    opargs,
    deep
) {
    let bestscore = Infinity // no choice
    let bestchoices = []
    let al1 = []
    nextchoice: for (const [nam, kind, aclass] of operations) {
        if (kind != opkind) continue
        if (aclass.length != opargs.length)
            _common.ice.call(void 0, `[${nam}] aclass.length (${aclass.length}) != opargs.length (${opargs.length})`)
        const ochoice = [nam, [...opargs]] 
        let choices = [ochoice]
        let score = 1
        let al2 = []
        for (let i = 0; i < aclass.length; i++) {
            const realc = opargs[i]
            const targetc = aclass[i]

            if (targetc.kind == realc.kind) {
                continue
            }
            // in shallow mode, don't try to fixup
            if (deep == 'shallow') continue nextchoice
            // they do not match, try to fixup
            const aether = _nullishCoalesce(aflist.pop(), () => ( aetherkind++))
            if (targetc.mode == 'i') {
                // resolve by prepending a matching move transform
                try {
                    const middle = { kind: targetc.kind, id: aether, type: 'aetheral' }
                    const [tscore, tchoices] = resolveMatch(
                        operations,
                        exports.move,
                        [{ ...middle }, realc],
                        'shallow'
                    )
                    if (targetc.kind != exports.rk_reg) score += 2
                    score += tscore
                    ochoice[1][i] = { ...middle }
                    choices = [...tchoices, ...choices]
                    al2.push(aether)
                    continue
                } catch (e) {
                    if (e != 'shallow recursion prohibited!') throw e
                }
            } else if (targetc.mode == 'o') {
                // resolve by appending a matching move transform
                try {
                    const middle = { kind: targetc.kind, id: aetherkind++, type: 'aetheral' }
                    const [tscore, tchoices] = resolveMatch(
                        operations,
                        exports.move,
                        [realc, { ...middle }],
                        'shallow'
                    )
                    if (targetc.kind != exports.rk_reg) score += 2
                    score += tscore
                    ochoice[1][i] = { ...middle }
                    choices = [...choices, ...tchoices]
                    al2.push(aether)
                    continue
                } catch (e) {
                    if (e != 'shallow recursion prohibited!') throw e
                }
            } else {
                // resolve by prepending then appending a matching move transform
                try {
                    const middle = { kind: targetc.kind, id: aetherkind++, type: 'aetheral' }
                    const [tscore, tchoices] = resolveMatch(
                        operations,
                        exports.move,
                        [realc, { ...middle }],
                        'shallow'
                    )
                    const [tscore2, tchoices2] = resolveMatch(
                        operations,
                        exports.move,
                        [{ ...middle }, realc],
                        'shallow'
                    )
                    if (targetc.kind != exports.rk_reg) score += 4
                    score += tscore + tscore2
                    ochoice[1][i] = { ...middle }
                    choices = [...tchoices2, ...choices, ...tchoices]
                    al2.push(aether)
                    continue
                } catch (e) {
                    if (e != 'shallow recursion prohibited!') throw e
                }
            }
            aflist.push(aether)
            continue nextchoice
        }
        if (score < bestscore) {
            for (const e of al1) aflist.push(e)
            al1 = al2
            bestscore = score
            bestchoices = choices
        } else {
            for (const e of al2) aflist.push(e)
        }
    }
    if (bestscore == Infinity && deep == 'shallow') throw 'shallow recursion prohibited!'
    if (bestscore == Infinity)
        _common.ice.call(void 0, 
            `cannot select "${opkind.description} ${opargs.map(e => e.kind.description).join(' ')}"`
        )
    return [bestscore, bestchoices] 
} exports.resolveMatch = resolveMatch;
 function printMatches(m) {
    for (const mm of m) {
        console.log(
            '\x1b[31m%s\x1b[0m',
            mm[0],
            ...mm[1].map(
                e =>
                    `\x1b[32m${e.kind.description}:\x1b[34m${e.type == 'real' ? '' : 'v'}${
                        e.id
                    }\x1b[0m`
            )
        )
    }
} exports.printMatches = printMatches;
