"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _assert = require('assert'); var _assert2 = _interopRequireDefault(_assert);
var _parseqlx = require('./parseqlx');
var _emitter = require('./emitter');
var _util = require('util');
var _fs = require('fs');
var _plugins = require('./plugins');

_util.inspect.defaultOptions.depth = Infinity

let cmod = '__main'
let cfn = '__init'

const bleedctx = new Map()

















let functions = new Map()

function isast(t) {}
function isstr(t) {}
function theast(t) {
    isast(t)
    return t
}
function thestr(t) {
    isstr(t)
    return t
}







let emitting_to = 'entry'
let ctx = new Map()
let ti = 0
function weightavg(...toavg) {
    let tsum = 0
    let sum = 0
    for (const [t, v] of toavg) {
        sum += t * v
        tsum += t
    }
    return sum / tsum
}

function compilenode(node) {
    if (node.type == 'fnnode') {
        _assert2.default.call(void 0, emitting_to == 'entry')
        emitting_to = 'functions'
        _emitter.emit.functions(`fn.${cmod}::${thestr(node.children[0])}:`)
        cfn = thestr(node.children[0])
        if (functions.get(thestr(node.children[0])).needsSaveProlouge) {
            // save prolouge
            // emit.functions(`    set rt_malloc.arg0 xx`)
            // emit.functions(`    op add rt_malloc.lr @counter 2`)
            // emit.functions(`    jump $fn$$rt_malloc always`)
            _assert2.default.fail('todo: save prolouge')
        }
        compilenode(theast(node.children[1]))
        emitting_to = 'entry'
        for (let [k, v] of [...ctx.entries()]) {
            if (v[0] == 'local') ctx.delete(k)
        }
        ctx.set(thestr(node.children[0]), ['func', { argc: +thestr(node.children[2]) }])
        cfn = '__init'
        return 'lol nope!'
    }
    if (node.type == 'blocknode') {
        node.children.forEach(e => {
            compilenode(theast(e))
        })
        return 'lol nope!'
    }
    if (node.type == 'returnnode') {
        _emitter.emit[emitting_to](`set $returns ${compilenode(theast(node.children[0]))}`)
        _emitter.emit[emitting_to](`set @counter lr.${cmod}::${cfn}`)
        return 'lol nope!'
    }
    if (node.type == 'bindarg') {
        const name = thestr(node.children[0])
        const idx = +thestr(node.children[1])
        ctx.set(name, ['local', `a.${cmod}::${cfn}.${idx}`])
        return 'lol nope!'
    }
    if (node.type == 'memread') {
        // read result cell1 addr
        const tix = ti++
        _emitter.emit[emitting_to](
            `read t.${tix} ${compilenode(theast(node.children[0]))} ${compilenode(
                theast(node.children[1])
            )}`
        )
        return `t.${tix}`
    }
    if (node.type == 'typedlet') {
        const name = thestr(node.children[1])
        let init = compilenode(theast(node.children[2]))
        if (!'tgl'.includes(init[0])) {
            _emitter.emit[emitting_to](`set l.${cmod}.${cfn}::${name} ${init}`)
            init = `l.${cmod}.${cfn}::${name}`
        }
        if (ctx.has(name)) {
            _emitter.emit[emitting_to](`set ${ctx.get(name)[1]} ${init}`)
            return 'lol nope!'
        }
        if (emitting_to == 'entry') {
            ctx.set(name, ['global_temp', init])
        } else {
            ctx.set(name, ['local', init])
        }
        return 'lol nope!'
    }
    if (node.type == 'let') {
        const name = thestr(node.children[0])
        let init = compilenode(theast(node.children[1]))
        if (!'tgl'.includes(init[0])) {
            _emitter.emit[emitting_to](`set l.${cmod}.${cfn}::${name} ${init}`)
            init = `l.${cmod}.${cfn}::${name}`
        }
        if (ctx.has(name)) {
            _emitter.emit[emitting_to](`set ${ctx.get(name)[1]} ${init}`)
            return 'lol nope!'
        }
        if (emitting_to == 'entry') {
            ctx.set(name, ['global_temp', init])
        } else {
            ctx.set(name, ['local', init])
        }
        return 'lol nope!'
    }
    if (node.type == 'drawline') {
        _emitter.emit[emitting_to](
            `draw line ${compilenode(theast(node.children[0]))} ${compilenode(
                theast(node.children[1])
            )} ${compilenode(theast(node.children[2]))} ${compilenode(
                theast(node.children[3])
            )} 0 0`
        )
        return 'lol nope!'
    }
    if (node.type == 'drawclear') {
        _emitter.emit[emitting_to](
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
            let m = _plugins.checkForMixin(
                `@qlx/emit:late-intrinsics:${name}/${args.length}`,
                {
                    args: args.map(e => theast(e)),
                    emit: s => _emitter.emit[emitting_to](s),
                    ctx,
                    current_fn: cfn,
                    current_mod: cmod,
                    gettemp: () => `t.${ti++}`,
                }
            )
            if (m) return m
        }
        if (!ctx.has(name)) {
            console.log('No such function: %s', name)
            process.exit(1)
        }
        const fn = ctx.get(name)
        _assert2.default.call(void 0, fn[0] == 'func')
        if (fn[1].argc != args.length) {
            console.log(`argc mismatch: found ${args.length}, expected ${fn[1].argc}`)
            process.exit(1)
        }

        const resolvedname = name.includes('::') ? name : `${cmod}::${name}`

        for (let idx in args) {
            _emitter.emit[emitting_to](`set a.${resolvedname}.${idx} ${compilenode(theast(args[idx]))}`)
        }
        _emitter.emit[emitting_to](`op add lr.${resolvedname} @counter 1`)
        _emitter.emit[emitting_to](`jump fn.${resolvedname} always 0 0`)
        return `$returns`
    }
    if (node.type == 'binop') {
        const tix = ti++
        _emitter.emit[emitting_to](
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
        const varref = ctx.get(thestr(node.children[0]))
        if (varref[0] == 'global') {
            return `g.${cmod}::${varref[1]}`
        }
        if (varref[0] == 'global_temp') {
            return `${varref[1]}`
        }
        if (varref[0] == 'local') {
            return varref[1]
        }
        _assert2.default.fail(`todo: compilenode(varnode { ${node.children[0]} }) -m${varref[0]}`)
    }
    if (node.type == 'number') {
        return `${node.children[0]}`
    }
    if (node.type == 'printnode') {
        _emitter.emit[emitting_to](`print ${compilenode(theast(node.children[0]))}`)
        return 'lol nope!'
    }
    if (node.type == 'printflushnode') {
        _emitter.emit[emitting_to](`printflush ${compilenode(theast(node.children[0]))}`)
        return 'lol nope!'
    }
    if (node.type == 'drawflush') {
        _emitter.emit[emitting_to](`drawflush ${compilenode(theast(node.children[0]))}`)
        return 'lol nope!'
    }
    if (node.type == 'getlinknode') {
        _emitter.emit[emitting_to](`getlink t.${ti} ${compilenode(theast(node.children[0]))}`)
        return `t.${ti++}`
    }
    if (node.type == 'if') {
        const tix = ti
        ti += 2
        _emitter.emit[emitting_to](`jump t.${tix} equal ${compilenode(theast(node.children[0]))} 0`)
        compilenode(theast(node.children[1]))
        if (
            theast(node.children[2]).type == 'blocknode' &&
            theast(node.children[2]).children.length == 0
        ) {
            _emitter.emit[emitting_to](`t.${tix}:`)
        } else {
            _emitter.emit[emitting_to](`jump t.${tix + 1} always 0 0`)
            _emitter.emit[emitting_to](`t.${tix}:`)
            compilenode(theast(node.children[2]))
            _emitter.emit[emitting_to](`t.${tix + 1}:`)
        }
        return 'lol nope!'
    }
    if (node.type == 'while') {
        const tix = ti
        ti += 2
        _emitter.emit[emitting_to](`t.${tix}:`)
        _emitter.emit[emitting_to](`jump t.${tix + 1} equal ${compilenode(theast(node.children[0]))} 0`)
        compilenode(theast(node.children[1]))
        _emitter.emit[emitting_to](`jump t.${tix} always 0 0`)
        _emitter.emit[emitting_to](`t.${tix + 1}:`)
        return 'lol nope!'
    }
    if (node.type == 'blox') {
        return thestr(node.children[0])
    }
    if (node.type == 'sense') {
        const tix = ti++
        _emitter.emit[emitting_to](
            `sensor t.${tix} ${compilenode(theast(node.children[1]))} @${thestr(node.children[0])}`
        )
        return `t.${tix}`
    }
    if (node.type == 'seton') {
        _emitter.emit[emitting_to](
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

        let numeric_min = null,
            numeric_max = null,
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
            _assert2.default.fail('todo: jump tables')
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

                _emitter.emit[emitting_to](`jump ${label} equal ${value} ${cnso}`)
            }

            const endl = `t.${ti++}`

            compilenode(dfl)
            _emitter.emit[emitting_to](`jump ${endl} always 0 0`)

            for (const cip in cases) {
                const ci = +cip
                const c = cases[ci]

                const label = pcifc_labels[ci]

                _emitter.emit[emitting_to](`${label}:`)
                compilenode(theast(theast(c).children[1]))
                _emitter.emit[emitting_to](`jump ${endl} always 0 0`)
            }

            _emitter.emit[emitting_to](`${endl}:`)
        }
        return 'lol nope!'
    }
    if (node.type == 'programnode') {
        for (const elem of node.children) {
            if (theast(elem).type == 'fnnode') {
                functions.set(thestr(theast(elem).children[0]), {
                    emitted: false,
                    needsSaveProlouge: false,
                })
            }
        }

        for (const elem of node.children) compilenode(theast(elem))

        return 'lol nope!'
    }
    if (node.type == 'mod') {
        let oldmod = cmod
        const name = thestr(node.children[0])
        const body = theast(node.children[1])

        cmod = name
        const oldfns = functions
        const oldctx = ctx
        functions = new Map()
        ctx = new Map()

        compilenode(body)

        const newctx = ctx
        const newfns = functions

        ctx = oldctx
        functions = oldfns

        for (const [k, v] of newctx) {
            ctx.set(name + '::' + k, v)
        }
        for (const [k, v] of newfns) {
            functions.set(name + '::' + k, v)
        }

        cmod = oldmod
        return 'lol nope!'
    }
    _assert2.default.fail(`todo: compilenode(${node.type})`)
}

 function compileCode(inp, writeCode) {
    const code = _parseqlx.parseprogram.call(void 0, _fs.readFileSync.call(void 0, inp).toString())

    compilenode(code)

    if (_emitter.outputs.functions.length != 0) _emitter.emit[emitting_to]('jump 0 always')

    writeCode(_emitter.gather.call(void 0, ))
} exports.compileCode = compileCode;
