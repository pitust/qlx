import assert from 'assert'
import { checkForMixin } from './plugins'

export function lex(s: string): string[] {
    let lexemes: string[] = []
    let line = 1
    let column = 1
    while (s.length) {
        if (s[0] == '\n') {
            line += 1
            column = 1
        }
        if (s.startsWith('//')) {
            s = s.split('\n').slice(1).join('\n')
            line += 1
            column = 1
            continue
        }
        if (/^([a-zA-Z_0-9@{}\*\/\+\-=\.\:]+|"([^\s"]| )*")/.test(s)) {
            const lexeme = /^([a-zA-Z_0-9@{}\*\/\+\-=\.\:]+|"([^\s"]| )*")/.exec(s)![0]
            lexemes.push(lexeme)
            s = s.slice(lexeme.length)
            column += lexeme.length
            continue
        }
        if (/\s/.test(s[0])) {
            s = s.slice(1)
            column += 1
            continue
        }
        console.log('%o', s)
        console.log(`At ${line}:${column}`)
        throw new Error('Failed to lex :(')
    }
    return lexemes
}

let code: string[]

export class ast {
    constructor(public type: string, public children: (string | ast)[]) {}
}
const $ = {
    fn(name: string, body: ast, argc: number): ast {
        return new ast('fnnode', [name, body, '' + argc])
    },
    block(nodes: ast[]) {
        return new ast('blocknode', nodes)
    },
    return(node: ast) {
        return new ast('returnnode', [node])
    },
    call(tgd: string, args: ast[]) {
        return new ast('callnode', [tgd, new ast('callargs', args)])
    },
    print(arg: ast) {
        return new ast('printnode', [arg])
    },
    printflush(arg: ast) {
        return new ast('printflushnode', [arg])
    },
    drawflush(arg: ast) {
        return new ast('drawflush', [arg])
    },
    getlink(arg: ast) {
        return new ast('getlinknode', [arg])
    },
    bindArg(name: string, idx: number) {
        return new ast('bindarg', [name, '' + idx])
    },
    var(name: string) {
        return new ast('varnode', [name])
    },
    binop(op: string, left: ast, right: ast) {
        return new ast('binop', [op, left, right])
    },
    number(n: number) {
        return new ast('number', ['' + n])
    },
    if(cond: ast, cons: ast, alt: ast) {
        return new ast('if', [cond, cons, alt])
    },
    while(cond: ast, body: ast) {
        return new ast('while', [cond, body])
    },
}

function parsefn() {
    const name = code.shift()!
    let args = []
    if (code[0] == '{') {
        code.shift()
        while ([...code][0] != '}') args.push(code.shift()!)
        code.shift()
    }
    const body = parsedo()
    if (args.length) {
        return $.fn(name, $.block([...args.map((e, i) => $.bindArg(e, i)), body]), args.length)
    }
    return $.fn(name, body, 0)
}
function parsedo() {
    const nodes: ast[] = []
    while (code[0] != 'end' && code[0] != 'else') nodes.push(parseword())
    if (code[0] != 'else') assert(code.shift() == 'end')
    return $.block(nodes)
}
function parsereturn() {
    return $.return(parseword())
}
function parsecall(aa: [string, string]) {
    const n = +aa[1]
    const args: ast[] = []
    const tgd = aa[0]
    for (let i = 0; i < n; i++) args.push(parseword())
    return $.call(tgd, args)
}
function parseprint() {
    return $.print(parseword())
}
function parseprintflush() {
    return $.printflush(parseword())
}
function parsedrawflush() {
    return $.drawflush(parseword())
}
function parsegetlink() {
    return $.getlink(parseword())
}
function parsebinop(name: string) {
    return $.binop(name, parseword(), parseword())
}
function parseif() {
    const cond = parseword()
    assert(code[0] == 'do')
    // this is needed so that the cond succeeds, as parseword/0 modifies `code` without typescript knowing.
    code = code
    const cons = parseword()
    if (code[0] == 'else') {
        code.shift()
        const alt = parsedo()
        return $.if(cond, cons, alt)
    }
    return $.if(cond, cons, $.block([]))
}
function parsewhile() {
    const cond = parseword()
    assert(code[0] == 'do')
    // this is needed so that the cond succeeds, as parseword/0 modifies `code` without typescript knowing.
    code = code
    const cons = parseword()
    return $.while(cond, cons)
}
function parseswitch() {
    const cases: ast[] = []
    let dfl: ast = $.block([]),
        haddfl = false
    
    const target = parseword()

    loop: while (true) {
        switch (code.shift()!) {
            case 'case':
                const cond = parseword()
                const body = parseword()
                cases.push(new ast('case', [cond, body]))
                break
            case 'default':
                if (haddfl) {
                    console.log('error: default redeclared!')
                    process.exit(1)
                }
                dfl = parseword()
                haddfl = true
                break
            case 'end':
                break loop
        }
    }

    return new ast('switch', [
        target,
        new ast('cases', cases),
        dfl
    ])
}
function parselet() {
    const c = code.shift()!
    assert(code.shift() == '=')
    return new ast('let', [c, parseword()])
}
const map = new Map<string, number>()
const genuid = (
    id => () =>
        id++
)(/* nice big offset */ 0x4141)
function uid(s: string) {
    if (!map.has(s)) {
        map.set(s, genuid())
        checkForMixin<[string, number], void>('@qlx/parse:create-atom', [s, map.get(s)!])
    }

    return map.get(s)!
}

function parseword(): ast {
    if (code[0] == 'end') {
        console.log('error: end in the top level scope!')
        process.exit(1)
    }
    if (code[0] == '+') return code.shift(), parsebinop('add')
    if (code[0] == '-') return code.shift(), parsebinop('sub')
    if (code[0] == '*') return code.shift(), parsebinop('mul')
    if (code[0] == '/') return code.shift(), parsebinop('div')
    if (code[0] == '==') return code.shift(), parsebinop('equal')
    if (code[0][0] == '"') return new ast('blox', [code.shift()!])
    if (/^[a-zA-Z_][a-zA-Z_0-9]*\/(0|[1-9][0-9]*)$/.test(code[0]))
        return parsecall(<[string, string]>code.shift()!.split('/'))
    if (code[0] == 'fn') return code.shift(), parsefn()
    if (code[0] == 'do') return code.shift(), parsedo()
    if (code[0] == 'return') return code.shift(), parsereturn()
    if (code[0] == 'true') return code.shift(), new ast('blox', ['1'])
    if (code[0] == 'false') return code.shift(), new ast('blox', ['0'])
    if (code[0] == 'print') return code.shift(), parseprint()
    if (code[0] == 'printflush') return code.shift(), parseprintflush()
    if (code[0] == 'getlink') return code.shift(), parsegetlink()
    if (code[0] == 'if') return code.shift(), parseif()
    if (code[0] == 'while') return code.shift(), parsewhile()
    if (code[0] == 'switch') return code.shift(), parseswitch()
    if (code[0] == 'let') return code.shift(), parselet()
    if (code[0] == 'draw.line')
        return (
            code.shift(), new ast('drawline', [parseword(), parseword(), parseword(), parseword()])
        )
    if (code[0] == 'draw.clear')
        return code.shift(), new ast('drawclear', [parseword(), parseword(), parseword()])
    if (code[0] == 'draw.flush') return code.shift(), parsedrawflush()
    if (code[0] == 'read') return code.shift(), new ast('memread', [parseword(), parseword()])
    if (code[0][0] == '@') return new ast('blox', [code.shift()!.slice(1)])
    if (code[0].startsWith('sense.')) return new ast('sense', [code.shift()!.slice(6), parseword()])
    if (code[0].startsWith('seton'))
        return code.shift(), new ast('seton', [parseword(), parseword()])
    if (/^[0-9]+$/.test(code[0])) return $.number(+code.shift()!)
    if (code[0][0] == ':') return $.number(uid(code.shift()!.slice(1)))
    return $.var(code.shift()!)
}

export function parseprogram(s: string): ast {
    // code = s.trim().replace(/\s+/g, ' ').split(' ')
    code = lex(s)
    const out: ast[] = []
    while (code.length) out.push(parseword())
    return new ast('programnode', out)
}
