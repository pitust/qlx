import assert from "assert";
import { parseprogram, ast } from "./parseqlx"
import { emit } from './emitter'

const code = parseprogram(`
fn four do
    return + 2 2
end

print call four

printflush getlink 0
`)

interface func {
    emitted: boolean
    needsSaveProlouge: boolean
}

const functions = new Map<string, func>()

function isast(t: ast | string): asserts t is ast {}
function isstr(t: ast | string): asserts t is string {}
function theast(t: ast | string): ast { isast(t); return t; }
function thestr(t: ast | string): string { isstr(t); return t; }

type Type = string
type ICvar = {}
type Varref = { rt: string } | { ct: [Type, ICvar] }

let emitting_to: keyof typeof emit = 'entry'
let ctx = new Map<string, Varref>()

function compilenode(node: ast) {
    if (node.type == 'fnnode') {
        assert(emitting_to == 'entry')
        emitting_to = 'functions'
        emit.functions(`$fn$${thestr(node.children[0])}:`)
        if (functions.get(thestr(node.children[0])).needsSaveProlouge) {
            // save prolouge
            // emit.functions(`    set rt_malloc.arg0 xx`)
            // emit.functions(`    op add rt_malloc.lr @counter 2`)
            // emit.functions(`    jump $fn$$rt_malloc always`)
            assert.fail('todo: saved prolouge')
        }
        
    }
    assert.fail(`todo: compilenode(${node.type})`)
}

for (const elem of code.children) {
    if (theast(elem).type == 'fnnode') {
        functions.set(thestr(theast(elem).children[0]), { emitted: false, needsSaveProlouge: false })
    }
}

for (const elem of code.children) compilenode(theast(elem))