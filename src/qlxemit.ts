import assert from 'assert'
import { parseprogram, ast } from './parseqlx'
import { emit, gather } from './emitter'
import { inspect } from 'util'
import { readFileSync, writeFileSync } from 'fs'
import { checkForMixin } from './plugins'

inspect.defaultOptions.depth = Infinity

export interface ICompilerContext {
    emit: (s: string) => void
    gettemp: () => string
    ctx: Map<string, Varref>
}
export interface ICompilerCallContext extends ICompilerContext {
    args: ast[]
}

interface func {
    emitted: boolean
    needsSaveProlouge: boolean
}

const functions = new Map<string, func>()

function isast(t: ast | string): asserts t is ast {}
function isstr(t: ast | string): asserts t is string {}
function theast(t: ast | string): ast {
    isast(t)
    return t
}
function thestr(t: ast | string): string {
    isstr(t)
    return t
}

export type Varref =
    | ['global', string]
    | ['global_temp', string]
    | ['local', string]
    | ['func', { argc: number }]

let emitting_to: keyof typeof emit = 'entry'
let ctx = new Map<string, Varref>()
let rv = ''
let ti = 0
function weightavg(...toavg: [number, number][]) {
    let tsum = 0
    let sum = 0
    for (const [t, v] of toavg) {
        sum += t * v
        tsum += t
    }
    return sum / tsum
}

function compilenode(node: ast): string {
    if (node.type == 'fnnode') {
        assert(emitting_to == 'entry')
        emitting_to = 'functions'
        emit.functions(`fn.${thestr(node.children[0])}:`)
        rv = thestr(node.children[0])
        if (functions.get(thestr(node.children[0]))!.needsSaveProlouge) {
            // save prolouge
            // emit.functions(`    set rt_malloc.arg0 xx`)
            // emit.functions(`    op add rt_malloc.lr @counter 2`)
            // emit.functions(`    jump $fn$$rt_malloc always`)
            assert.fail('todo: save prolouge')
        }
        compilenode(theast(node.children[1]))
        emitting_to = 'entry'
        for (let [k, v] of [...ctx.entries()]) {
            if (v[0] == 'local') ctx.delete(k)
        }
        ctx.set(thestr(node.children[0]), ['func', { argc: +thestr(node.children[2]) }])
        return 'lol nope!'
    }
    if (node.type == 'blocknode') {
        node.children.forEach(e => {
            compilenode(theast(e))
        })
        return 'lol nope!'
    }
    if (node.type == 'returnnode') {
        emit[emitting_to](`set $returns ${compilenode(theast(node.children[0]))}`)
        emit[emitting_to](`set @counter lr.${rv}`)
        return 'lol nope!'
    }
    if (node.type == 'bindarg') {
        const name = thestr(node.children[0])
        const idx = +thestr(node.children[1])
        ctx.set(name, ['local', `a.${rv}.${idx}`])
        return 'lol nope!'
    }
    if (node.type == 'memread') {
        // read result cell1 addr
        const tix = ti++
        emit[emitting_to](
            `read t.${tix} ${compilenode(theast(node.children[0]))} ${compilenode(
                theast(node.children[1])
            )}`
        )
        return `t.${tix}`
    }
    if (node.type == 'let') {
        const name = thestr(node.children[0])
        let init = compilenode(theast(node.children[1]))
        if (init == '$returns') {
            emit[emitting_to](`set l.${name} ${init}`)
        }
        if (emitting_to == 'entry') {
            ctx.set(name, ['global_temp', init])
        } else {
            ctx.set(name, ['local', init])
        }
        return 'lol nope!'
    }
    if (node.type == 'drawline') {
        emit[emitting_to](
            `draw line ${compilenode(theast(node.children[0]))} ${compilenode(
                theast(node.children[1])
            )} ${compilenode(theast(node.children[2]))} ${compilenode(
                theast(node.children[3])
            )} 0 0`
        )
        return 'lol nope!'
    }
    if (node.type == 'drawclear') {
        emit[emitting_to](
            `draw clear ${compilenode(theast(node.children[0]))} ${compilenode(
                theast(node.children[1])
            )} ${compilenode(theast(node.children[2]))} 0 0 0`
        )
        return 'lol nope!'
    }
    if (node.type == 'callnode') {
        const name = thestr(node.children[0])
        const args = theast(node.children[1]).children
        {
            let m = checkForMixin<ICompilerCallContext, string>(
                `@qlx/emit:late-intrinsics:${name}/${args.length}`,
                {
                    args: args.map(e => theast(e)),
                    emit: (s) => emit[emitting_to](s),
                    ctx,
                    gettemp: () => `t.${ti++}`
                }
            )
            if (m) return m
        }
        if (!ctx.has(name)) {
            console.log('No such function: %s', name)
            process.exit(1)
        }
        const fn = ctx.get(name)!
        assert(fn[0] == 'func')
        if (fn[1].argc != args.length) {
            console.log(`argc mismatch: found ${args.length}, expected ${fn[1].argc}`)
            process.exit(1)
        }
        for (let idx in args) {
            emit[emitting_to](`set a.${name}.${idx} ${compilenode(theast(args[idx]))}`)
        }
        emit[emitting_to](`op add lr.${name} @counter 1`)
        emit[emitting_to](`jump fn.${name} always 0 0`)
        return `$returns`
    }
    if (node.type == 'binop') {
        const tix = ti++
        emit[emitting_to](
            `op ${thestr(node.children[0])} t.${tix} ${compilenode(
                theast(node.children[1])
            )} ${compilenode(theast(node.children[2]))}`
        )
        return `t.${tix}`
    }
    if (node.type == 'varnode') {
        if (node.children[0] == 'null') return 'null'
        if (!ctx.has(thestr(node.children[0]))) {
            console.log('missing var:', thestr(node.children[0]))
            process.exit(1)
        }
        const varref = ctx.get(thestr(node.children[0]))!
        if (varref[0] == 'global') {
            return `g.${varref[1]}`
        }
        if (varref[0] == 'global_temp') {
            return `${varref[1]}`
        }
        if (varref[0] == 'local') {
            return <string>varref[1]!
        }
        assert.fail(`todo: compilenode(varnode { ${node.children[0]} }) -m${varref[0]}`)
    }
    if (node.type == 'number') {
        return `${node.children[0]}`
    }
    if (node.type == 'printnode') {
        emit[emitting_to](`print ${compilenode(theast(node.children[0]))}`)
        return 'lol nope!'
    }
    if (node.type == 'printflushnode') {
        emit[emitting_to](`printflush ${compilenode(theast(node.children[0]))}`)
        return 'lol nope!'
    }
    if (node.type == 'drawflush') {
        emit[emitting_to](`drawflush ${compilenode(theast(node.children[0]))}`)
        return 'lol nope!'
    }
    if (node.type == 'getlinknode') {
        emit[emitting_to](`getlink t.${ti} ${compilenode(theast(node.children[0]))}`)
        return `t.${ti++}`
    }
    if (node.type == 'if') {
        const tix = ti
        ti += 2
        emit[emitting_to](`jump t.${tix} equal ${compilenode(theast(node.children[0]))} 0`)
        compilenode(theast(node.children[1]))
        if (
            theast(node.children[2]).type == 'blocknode' &&
            theast(node.children[2]).children.length == 0
        ) {
            emit[emitting_to](`t.${tix}:`)
        } else {
            emit[emitting_to](`jump t.${tix + 1} always 0 0`)
            emit[emitting_to](`t.${tix}:`)
            compilenode(theast(node.children[2]))
            emit[emitting_to](`t.${tix + 1}:`)
        }
        return 'lol nope!'
    }
    if (node.type == 'while') {
        const tix = ti
        ti += 2
        emit[emitting_to](`t.${tix}:`)
        emit[emitting_to](`jump t.${tix + 1} equal ${compilenode(theast(node.children[0]))} 0`)
        compilenode(theast(node.children[1]))
        emit[emitting_to](`jump t.${tix} always 0 0`)
        emit[emitting_to](`t.${tix + 1}:`)
        return 'lol nope!'
    }
    if (node.type == 'blox') {
        return thestr(node.children[0])
    }
    if (node.type == 'sense') {
        const tix = ti++
        emit[emitting_to](
            `sensor t.${tix} ${compilenode(theast(node.children[1]))} @${thestr(node.children[0])}`
        )
        return `t.${tix}`
    }
    if (node.type == 'seton') {
        emit[emitting_to](
            `control enabled ${compilenode(theast(node.children[0]))} ${compilenode(
                theast(node.children[1])
            )}`
        )
        return 'lol nope!'
    }
    if (node.type == 'switch') {
        const switchon = theast(node.children[0])
        const cases = theast(node.children[1]).children
        const dfl = theast(node.children[2])

        const cnso = compilenode(switchon)

        let numeric_min: number | null = null,
            numeric_max: number | null = null,
            nc = 0,
            nnc = 1
        for (const c of cases) {
            if (theast(theast(c).children[0]).type == 'number') {
                const value = +thestr(theast(theast(c).children[0]).children[0])
                nc++
                if (numeric_min === null) numeric_min = value
                if (numeric_max !== null) numeric_max = value

                numeric_min = Math.min(numeric_min, value)
                numeric_max = Math.max(numeric_max, value)
            } else {
                nnc += 1
            }
        }
        // here we need to ask ourselves: what is better?
        //  - jumptables have a high code size and fixed cost
        //  - ifchains have no fixed cost, but a nc/2 case cost

        // jumptables
        //   jump lt value min
        //   jump gt value max
        //   op sub t_1 value {min-1}
        //   op add @counter @counter value
        //   _here go jumps_
        const jt_cost = weightavg([nc, 5], [nnc, 1.5 + nnc / 2]) // weightavg(nc: 5, nnc: 1.5 + nnc / 2)
        const ifc_cost = (nc + nnc) / 2 // nc + nnc / 2

        // we favor jump tables as for (likely more common) cases they are much faster
        if (jt_cost < ifc_cost) {
            // jump tables
            assert.fail('todo: jump tables')
        } else {
            // ifchains
            const pcifc_labels = []
            const pcifc_values = []

            // todo: ifchains emit cleaner code when evaluating constants AOT, however that can be inefficent
            for (const c of cases) {
                const [cond, _block] = theast(c).children
                pcifc_labels.push(`t.${ti++}`)
                pcifc_values.push(compilenode(theast(cond)))
            }

            for (const cip in cases) {
                const ci = +cip

                const label = pcifc_labels[ci]
                const value = pcifc_values[ci]

                emit[emitting_to](`jump ${label} equal ${value} ${cnso}`)
            }

            const endl = `t.${ti++}`

            compilenode(dfl)
            emit[emitting_to](`jump ${endl} always 0 0`)

            for (const cip in cases) {
                const ci = +cip
                const c = cases[ci]

                const label = pcifc_labels[ci]

                emit[emitting_to](`${label}:`)
                compilenode(theast(theast(c).children[1]))
                emit[emitting_to](`jump ${endl} always 0 0`)
            }

            emit[emitting_to](`${endl}:`)
        }
        return 'lol nope!'
    }
    assert.fail(`todo: compilenode(${node.type})`)
}

export function compileCode(inp: string, out?: string) {
    const code = parseprogram(readFileSync(inp).toString())

    for (const elem of code.children) {
        if (theast(elem).type == 'fnnode') {
            functions.set(thestr(theast(elem).children[0]), {
                emitted: false,
                needsSaveProlouge: false,
            })
        }
    }

    for (const elem of code.children) compilenode(theast(elem))

    emit[emitting_to]('end')

    if (out) {
        let d = checkForMixin<null, string>('@qlx/cli:generate-mapfile', null)
        if (d) {
            writeFileSync(out + '.map', d)
        }
    }

    if (out) writeFileSync(out, gather())
    else console.log(gather())
}
