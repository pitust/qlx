import assert from 'assert'
import { parseprogram, ast } from './parseqlx'
import { emit, gather } from './emitter'
import { inspect } from 'util'
import { readFileSync } from 'fs'

inspect.defaultOptions.depth = Infinity

const code = parseprogram(readFileSync('input.qlx').toString())

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

type Type = string
type ICvar = {}
type Varref = ['global', string] | ['global_temp', string] | ['local', string] | ['func', { argc: number }]

let emitting_to: keyof typeof emit = 'entry'
let ctx = new Map<string, Varref>()
let rv = ''
let ti = 0
function compilenode(node: ast): string {
    if (node.type == 'fnnode') {
        assert(emitting_to == 'entry')
        emitting_to = 'functions'
        emit.functions(`fn.${thestr(node.children[0])}:`)
        rv = thestr(node.children[0])
        if (functions.get(thestr(node.children[0])).needsSaveProlouge) {
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
        return
    }
    if (node.type == 'blocknode') {
        node.children.forEach(e => {
            compilenode(theast(e))
        })
        return
    }
    if (node.type == 'returnnode') {
        emit[emitting_to](`set $returns ${compilenode(theast(node.children[0]))}`)
        emit[emitting_to](`set @counter lr.${rv}`)
        return
    }
    if (node.type == 'bindarg') {
        const name = thestr(node.children[0])
        const idx = +thestr(node.children[1])
        ctx.set(name, ['local', `a.${rv}.${idx}`])
        return
    }
    if (node.type == 'memread') {
        // read result cell1 addr
        const tix = ti++
        emit[emitting_to](`read t.${tix} ${compilenode(theast(node.children[0]))} ${compilenode(theast(node.children[1]))}`)
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
        return
    }
    if (node.type == 'drawline') {
        emit[emitting_to](`draw line ${compilenode(theast(node.children[0]))} ${compilenode(theast(node.children[1]))} ${compilenode(theast(node.children[2]))} ${compilenode(theast(node.children[3]))} 0 0`)
        return
    }
    if (node.type == 'drawclear') {
        emit[emitting_to](`draw clear ${compilenode(theast(node.children[0]))} ${compilenode(theast(node.children[1]))} ${compilenode(theast(node.children[2]))} 0 0 0`)
        return
    }
    if (node.type == 'callnode') {
        const name = thestr(node.children[0])
        const args = theast(node.children[1]).children
        if (!ctx.has(name)) {
            console.log('No such function: %s', name)
            process.exit(1)
        }
        const fn = ctx.get(name)
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
            `op ${thestr(node.children[0])} t.${tix} ${compilenode(theast(node.children[1]))} ${compilenode(
                theast(node.children[2])
            )}`
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
            return `g.${varref[1]}`
        }
        if (varref[0] == 'global_temp') {
            return `${varref[1]}`
        }
        if (varref[0] == 'local') {
            return varref[1]
        }
        assert.fail(`todo: compilenode(varnode { ${node.children[0]} }) -m${varref[0]}`)
    }
    if (node.type == 'number') {
        return `${node.children[0]}`
    }
    if (node.type == 'printnode') {
        emit[emitting_to](`print ${compilenode(theast(node.children[0]))}`)
        return
    }
    if (node.type == 'printflushnode') {
        emit[emitting_to](`printflush ${compilenode(theast(node.children[0]))}`)
        return
    }
    if (node.type == 'drawflush') {
        emit[emitting_to](`drawflush ${compilenode(theast(node.children[0]))}`)
        return
    }
    if (node.type == 'getlinknode') {
        emit[emitting_to](`getlink t.${ti} ${compilenode(theast(node.children[0]))}`)
        return `t.${ti}`
    }
    if (node.type == 'if') {
        const tix = ti
        ti += 2
        emit[emitting_to](`jump t.${tix} notEqual ${compilenode(theast(node.children[0]))} 1`)
        compilenode(theast(node.children[1]))
        emit[emitting_to](`jump t.${tix + 1} always 0 0`)
        emit[emitting_to](`t.${tix}:`)
        compilenode(theast(node.children[2]))
        emit[emitting_to](`t.${tix + 1}:`)
        return
    }
    if (node.type == 'blox') {
        return thestr(node.children[0])
    }
    if (node.type == 'sense') {
        const tix = ti++
        emit[emitting_to](`sensor t.${tix} ${compilenode(theast(node.children[1]))} @${thestr(node.children[0])}`)
        return `t.${tix}`
    }
    if (node.type == 'seton') {
        emit[emitting_to](`control enabled ${compilenode(theast(node.children[0]))} ${compilenode(theast(node.children[1]))}`)
        return
    }
    assert.fail(`todo: compilenode(${node.type})`)
}

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

console.log(gather())