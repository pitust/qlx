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

let emitting_to: keyof typeof emit = 'entry'

function compilenode(node: ast) {
    if (node.type == 'fnnode') {
        assert(emitting_to == 'entry')
        emitting_to = 'functions'
        // emit.functions()
    }
    assert.fail(`todo: compilenode(${node.type})`)
}

for (const elem of code.children) {
    if (theast(elem).type == 'fnnode') {
        functions.set(thestr(theast(elem).children[0]), { emitted: false })
    }
}

for (const elem of code.children) compilenode(elem)