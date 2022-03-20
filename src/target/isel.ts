import { ice } from './common'
export type refkind = symbol & { __tag: 'refkind' }
export type insn = symbol & { __tag: 'insn' }
export type ref = { kind: refkind; id: number; type: 'real' | 'aetheral' }
export type refclass = { kind: refkind; mode: 'io' | 'i' | 'o' }
export type opdef = [string, insn, refclass[]]

export function io(k: refkind): refclass {
    return { kind: k, mode: 'io' }
}
export function i(k: refkind): refclass {
    return { kind: k, mode: 'i' }
}
export function o(k: refkind): refclass {
    return { kind: k, mode: 'o' }
}

export const rk_reg = Symbol.for('reg') as refkind
export const move = Symbol.for('move') as insn

let aetherkind = 1
let aflist = [0]

export function resolveMatch(
    operations: opdef[],
    opkind: insn,
    opargs: ref[],
    deep: 'deep' | 'shallow'
) {
    let bestscore = Infinity // no choice
    let bestchoices = []
    let al1 = []
    nextchoice: for (const [nam, kind, aclass] of operations) {
        if (kind != opkind) continue
        if (aclass.length != opargs.length)
            ice(`[${nam}] aclass.length (${aclass.length}) != opargs.length (${opargs.length})`)
        const ochoice = [nam, [...opargs]] as [string, ref[]]
        let choices = [ochoice]
        let score = 1
        let al2 = []
        for (let i = 0; i < aclass.length; i++) {
            const realc: ref = opargs[i]
            const targetc: refclass = aclass[i]

            if (targetc.kind == realc.kind) {
                continue
            }
            // in shallow mode, don't try to fixup
            if (deep == 'shallow') continue nextchoice
            // they do not match, try to fixup
            const aether = aflist.pop() ?? aetherkind++
            if (targetc.mode == 'i') {
                // resolve by prepending a matching move transform
                try {
                    const middle: ref = { kind: targetc.kind, id: aether, type: 'aetheral' }
                    const [tscore, tchoices] = resolveMatch(
                        operations,
                        move,
                        [{ ...middle }, realc],
                        'shallow'
                    )
                    if (targetc.kind != rk_reg) score += 2
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
                    const middle: ref = { kind: targetc.kind, id: aetherkind++, type: 'aetheral' }
                    const [tscore, tchoices] = resolveMatch(
                        operations,
                        move,
                        [realc, { ...middle }],
                        'shallow'
                    )
                    if (targetc.kind != rk_reg) score += 2
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
                    const middle: ref = { kind: targetc.kind, id: aetherkind++, type: 'aetheral' }
                    const [tscore, tchoices] = resolveMatch(
                        operations,
                        move,
                        [realc, { ...middle }],
                        'shallow'
                    )
                    const [tscore2, tchoices2] = resolveMatch(
                        operations,
                        move,
                        [{ ...middle }, realc],
                        'shallow'
                    )
                    if (targetc.kind != rk_reg) score += 4
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
        ice(
            `cannot select "${opkind.description} ${opargs.map(e => e.kind.description).join(' ')}"`
        )
    return [bestscore, bestchoices] as const
}
export function printMatches(m: [string, ref[]][]) {
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
}
