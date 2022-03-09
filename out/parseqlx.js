"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _assert = require('assert'); var _assert2 = _interopRequireDefault(_assert);
var _fs = require('fs');
var _plugins = require('./plugins');
var _middlegen = require('./middlegen'); // TODO: this is an import cycle
 
const packages = new Set()

const kw = [
    'struct', 'let', 'fn', 'do', 'end', 'if', 'switch',
    'case', 'default', 'while', 'new', 'print', 'printflush', 'printf',
    'get{', 'set{'
]

class Lexeme {
    constructor( line,  column,  lexeme,  codeline,  range) {;this.line = line;this.column = column;this.lexeme = lexeme;this.codeline = codeline;this.range = range;}
}    
 function lex(s) {
    const stp = s.split('\n')
    let lexemes = []
    let line = 1
    let column = 1
    while (s.length) {
        if (s[0] == '\n') {
            line += 1
            column = 1
            s = s.slice(1)
            continue
        }
        if (s.startsWith('//')) {
            s = s.split('\n').slice(1).join('\n')
            line += 1
            column = 1
            continue
        }
        if (s[0] == ':' && /\s/.test(s[1])) {
            lexemes.push(new Lexeme(line, column, ':', stp[line-1], [column - 1, 1]))
            column += 1
            s = s.slice(1)
            continue
        }
        if (/^(\:?[a-zA-Z_0-9@{}\*\/\+\-=\.!<>]+|"([^\s"]| )*")/.test(s)) {
            const lexeme = /^(\:?[a-zA-Z_0-9@{}\*\/\+\-=\.!<>]+|"([^\s"]| )*")/.exec(s)[0]
            lexemes.push(new Lexeme(line, column, lexeme, stp[line-1], [column - 1, lexeme.length]))
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
} exports.lex = lex;

let code
let currentfile = '<no file>', line = 0, col = 0, codeline = '', range = [0, 0]

 class ast {
    
    
    
    constructor( type,  children) {;this.type = type;this.children = children;
        this.pos = `${currentfile}:${line}:${col}`
        this.codeline = codeline
        this.range = range
    }
} exports.ast = ast;
const $ = {
    fn(name, body, argc, args) {
        return new ast('fnnode', [name, body, '' + argc, args])
    },
    block(nodes) {
        return new ast('blocknode', nodes)
    },
    return(node) {
        return new ast('returnnode', [node])
    },
    call(tgd, args) {
        return new ast('callnode', [tgd, new ast('callargs', args)])
    },
    print(arg) {
        return new ast('printnode', [arg])
    },
    printflush(arg) {
        return new ast('printflushnode', [arg])
    },
    drawflush(arg) {
        return new ast('drawflush', [arg])
    },
    getlink(arg) {
        return new ast('getlinknode', [arg])
    },
    bindArg(name, idx) {
        return new ast('bindarg', [name, '' + idx])
    },
    var(name) {
        return new ast('varnode', [name])
    },
    binop(op, left, right) {
        return new ast('binop', [op, left, right])
    },
    number(n) {
        return new ast('number', ['' + n])
    },
    if(cond, cons, alt) {
        return new ast('if', [cond, cons, alt])
    },
    while(cond, body) {
        return new ast('while', [cond, body])
    },
    mod(pkg, mod) {
        return new ast('mod', [pkg, mod])
    },
    depmod(name) {
        return new ast('depmod', [name])
    }
}

function parsefn() {
    const name = code.shift().lexeme
    let args = []
    if (code[0].lexeme == '{') {
        code.shift()
        while ([...code][0].lexeme != '}') {
            const name = code.shift().lexeme
            _assert2.default.call(void 0, code.shift().lexeme == ':')
            args.push(new ast('arg', [
                name, // name
                parsetype() // type,
            ]))
        }
        code.shift()
    }
    _assert2.default.call(void 0, code.shift().lexeme == '->')
    let rty = parsetype()
    const body = parsedo()
    if (args.length) {
        return $.fn(name, $.block([...args.map((e, i) => $.bindArg(e, i)), body]), args.length, rty)
    }
    return $.fn(name, body, 0, rty)
}
function parsedo() {
    const nodes = []
    while (code[0].lexeme != 'end' && code[0].lexeme != 'else') nodes.push(parseword())
    if (code[0].lexeme != 'else') _assert2.default.call(void 0, code.shift().lexeme == 'end')
    return $.block(nodes)
}
function parsereturn() {
    return $.return(parseword())
}
function parsecall(aa) {
    const n = +aa[1]
    const args = []
    const tgd = aa[0]
    for (let i = 0; i < n; i++) args.push(parseword())
    return $.call(tgd, args)
}
function parseprint() {
    return $.print(parseword())
}
function parseprintf() {
    const w = code.shift().lexeme
    if (w[0] != '"') {
        console.error('Invalid format string in printf')
        process.exit(1)
    }
    const fmt = w.slice(1, -1)
    const segments = fmt.split('{}')
    const ops = [
        $.print(new ast('blox', [`"${segments[0]}"`]))
    ]
    for (let i = 1; i < segments.length; i++) {
        ops.push($.print(parseword()))
        if (segments[i] == '') continue
        ops.push($.print(new ast('blox', [`"${segments[i]}"`])))
    }
    return $.block(ops)
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
function parsebinop(name) {
    return $.binop(name, parseword(), parseword())
}
function parseif() {
    const cond = parseword()
    _assert2.default.call(void 0, code[0].lexeme == 'do')
    // this is needed so that the cond succeeds, as parseword/0 modifies `code` without typescript knowing.
    code = code
    const cons = parseword()
    if (code[0].lexeme == 'else') {
        code.shift()
        const alt = parsedo()
        return $.if(cond, cons, alt)
    }
    return $.if(cond, cons, $.block([]))
}
function parsewhile() {
    const cond = parseword()
    _assert2.default.call(void 0, code[0].lexeme == 'do')
    const cons = parseword()
    return $.while(cond, cons)
}
function parseuse() {
    const pkg = code.shift().lexeme
    if (packages.has(pkg)) return $.depmod(pkg)
    const subpath = pkg.replace(/::/g, '/') + '.qlx'
    let packageDirectories = ['.']
    const PATH_VARS = ['QLX_PATH']
    if (process.env.QLX_PATH_VARS) {
        PATH_VARS.push(...process.env.QLX_PATH_VARS.split(':'))
    }
    for (const path_var of PATH_VARS) {
        if (process.env[path_var])  {
            packageDirectories.push(...process.env[path_var].split(':'))
        }
    }
    const possiblePackageFiles = packageDirectories
        .flatMap(dir => [
            dir,
            dir + '/src',
            dir + '/source',
            dir + '/pkg',
        ])
    const foundPackageFiles = 
        possiblePackageFiles
        .filter(e => _fs.existsSync.call(void 0, e + '/' + subpath))
    if (foundPackageFiles.length == 0) {
        console.log('\x1b[0;31mCannot find package \x1b[33;1m%s\x1b[0m!', pkg)
        process.exit(1)
    }
    if (foundPackageFiles.length != 1) {
        console.log('\x1b[32;1mFound many candidates for package \x1b[33;1m%s\x1b[0m:', pkg)
        for (const pkgfile of foundPackageFiles) {
            console.log('    - \x1b[34;1m%s\x1b[0m', pkgfile)
        }
        process.exit(1)
    }
    const pkgstr = _fs.readFileSync.call(void 0, subpath).toString()
    packages.add(pkg)

    let realcode = code
    const data = parseprogram(pkgstr)
    code = realcode
    
    return $.mod(pkg, data)
}
function parseswitch() {
    const cases = []
    let dfl = $.block([]),
        haddfl = false
    
    const target = parseword()

    loop: while (true) {
        switch (code.shift().lexeme) {
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
function parsetype() {
    const typ = code.shift().lexeme
    if (typ == 'float') return new ast('floatty', [])
    if (typ == 'void') return new ast('voidty', [])
    if (typ == 'str') return new ast('strty', [])
    return new ast('namedty', [typ])
}
function parselet() {
    const c = code.shift().lexeme
    if (code[0].lexeme == ':') {
        code.shift()
        const ty = parsetype()
        _assert2.default.call(void 0, code.shift().lexeme == '=')
        return new ast('typedlet', [ty, c, parseword()])
    }
    _assert2.default.call(void 0, code.shift().lexeme == '=')
    return new ast('let', [c, parseword()])
}
function parseset() {
    const c = code.shift().lexeme
    _assert2.default.call(void 0, code.shift().lexeme == '=')
    return new ast('set', [c, parseword()])
}
function parsestruct() {
    const structname = code.shift().lexeme
    _assert2.default.call(void 0, code.shift().lexeme == 'do')
    const items = []
    while (code[0].lexeme != 'end') {
        const nam = code.shift().lexeme
        _assert2.default.call(void 0, code.shift().lexeme == ':')
        const ty = parsetype()
        items.push(new ast('structitem', [nam, ty]))
    }
    code.shift()
    return new ast('struct', [structname, ...items])
}
function parseget() {
    const target = parseword()
    const tgd = code.shift().lexeme
    _assert2.default.call(void 0, tgd[0] == '.')
    _assert2.default.call(void 0, code.shift().lexeme == '}')
    return new ast('dot', [target, tgd.slice(1)])
}
const map = new Map()
const genuid = (
    id => () =>
        id++
)(/* nice big offset */ 0x414243)

function uid(s) {
    if (s == '__Target') s = _middlegen.options.target
    if (!map.has(s)) {
        map.set(s, genuid())
        _plugins.checkForMixin('@qlx/parse:create-atom', [s, map.get(s)])
    }

    return map.get(s)
}

function parseword() {
    let oldstate = { line, col, codeline, range }
    line = code[0].line
    col = code[0].column
    codeline = code[0].codeline
    range = code[0].range
    const res = (() => {
        if (code[0].lexeme == 'end') {
            console.log('error: end in the top level scope!')
            process.exit(1)
        }
        if (code[0].lexeme == '+') return code.shift(), parsebinop('add')
        if (code[0].lexeme == '-') return code.shift(), parsebinop('sub')
        if (code[0].lexeme == '*') return code.shift(), parsebinop('mul')
        if (code[0].lexeme == '/') return code.shift(), parsebinop('div')
        if (code[0].lexeme == '==') return code.shift(), parsebinop('equal')
        if (code[0].lexeme == '>=') return code.shift(), parsebinop('greaterThanEq')
        if (code[0].lexeme == '!=') return code.shift(), parsebinop('notEqual')
        if (code[0].lexeme[0] == '"') return new ast('blox', [code.shift().lexeme])
        if (/^([a-zA-Z_][a-zA-Z_0-9]*::)*[a-zA-Z_][a-zA-Z_0-9]*\/(0|[1-9][0-9]*)$/.test(code[0].lexeme))
            return parsecall(code.shift().lexeme.split('/'))
        if (code[0].lexeme == 'fn') return code.shift(), parsefn()
        if (code[0].lexeme == 'do') return code.shift(), parsedo()
        if (code[0].lexeme == 'return') return code.shift(), parsereturn()
        if (code[0].lexeme == 'true') return code.shift(), $.number(1)
        if (code[0].lexeme == 'false') return code.shift(), $.number(0)
        if (code[0].lexeme == 'print') return code.shift(), parseprint()
        if (code[0].lexeme == 'printf') return code.shift(), parseprintf()
        if (code[0].lexeme == 'printflush') return code.shift(), parseprintflush()
        if (code[0].lexeme == 'getlink') return code.shift(), parsegetlink()
        if (code[0].lexeme == 'if') return code.shift(), parseif()
        if (code[0].lexeme == 'use') return code.shift(), parseuse()
        if (code[0].lexeme == 'while') return code.shift(), parsewhile()
        if (code[0].lexeme == 'switch') return code.shift(), parseswitch()
        if (code[0].lexeme == 'let') return code.shift(), parselet()
        if (code[0].lexeme == 'get{') return code.shift(), parseget()
        if (code[0].lexeme == 'struct') return code.shift(), parsestruct()
        if (code[0].lexeme == 'draw.line')
            return (
                code.shift(), new ast('drawline', [parseword(), parseword(), parseword(), parseword()])
            )
        if (code[0].lexeme == 'draw.clear')
            return code.shift(), new ast('drawclear', [parseword(), parseword(), parseword()])
        if (code[0].lexeme == 'draw.flush') return code.shift(), parsedrawflush()
        if (code[0].lexeme == 'read') return code.shift(), new ast('memread', [parseword(), parseword()])
        if (code[0].lexeme == 'new') return code.shift(), new ast('new', [code.shift().lexeme])
        if (code[0].lexeme == 'write') return code.shift(), new ast('memwrite', [parseword(), parseword(), parseword()])
        if (code[0].lexeme[0] == '@') return new ast('blox', [code.shift().lexeme.slice(1)])
        if (code[0].lexeme.startsWith('sense.')) return new ast('sense', [code.shift().lexeme.slice(6), parseword()])
        if (code[0].lexeme.startsWith('seton'))
            return code.shift(), new ast('seton', [parseword(), parseword()])
        if (/^([1-9][0-9]*|0)(\.[0-9]*)?$/.test(code[0].lexeme)) return $.number(+code.shift().lexeme)
        if (code[0].lexeme[0] == ':') return $.number(uid(code.shift().lexeme.slice(1)))
        if (code.length > 1 && code[1].lexeme == '=') return parseset()
        if (code[0].lexeme == '__Target') return code.shift(), new ast('blox', [JSON.stringify(_middlegen.options.target)])
        if (kw.includes(code[0].lexeme)) {
            console.log('error: illegal variable name', code[0].lexeme)
            process.exit(1)
        }
        return $.var(code.shift().lexeme)
    })()
    line = oldstate.line
    col = oldstate.col
    codeline = oldstate.codeline
    range = oldstate.range
    return res
}

 function parseprogram(s) {
    // code = s.trim().replace(/\s+/g, ' ').split(' ')
    code = lex(s)
    const out = []
    currentfile = 'input.qlx'
    while (code.length) out.push(parseword())
    return new ast('programnode', out)
} exports.parseprogram = parseprogram;
