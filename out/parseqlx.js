"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }var _assert = require('assert'); var _assert2 = _interopRequireDefault(_assert);
var _fs = require('fs');
var _plugins = require('./plugins');

const packages = new Set()

 function lex(s) {
    let lexemes = []
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
        if (s[0] == ':') {
            lexemes.push(':')
            column += 1
            s = s.slice(1)
            continue
        }
        if (/^(\:?[a-zA-Z_0-9@{}\*\/\+\-=\.!<>]+|"([^\s"]| )*")/.test(s)) {
            const lexeme = /^(\:?[a-zA-Z_0-9@{}\*\/\+\-=\.!<>]+|"([^\s"]| )*")/.exec(s)[0]
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
} exports.lex = lex;

let code

 class ast {
    constructor( type,  children) {;this.type = type;this.children = children;}
} exports.ast = ast;
const $ = {
    fn(name, body, argc) {
        return new ast('fnnode', [name, body, '' + argc])
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
    const name = code.shift()
    let args = []
    if (code[0] == '{') {
        code.shift()
        while ([...code][0] != '}') args.push(code.shift())
        code.shift()
    }
    const body = parsedo()
    if (args.length) {
        return $.fn(name, $.block([...args.map((e, i) => $.bindArg(e, i)), body]), args.length)
    }
    return $.fn(name, body, 0)
}
function parsedo() {
    const nodes = []
    while (code[0] != 'end' && code[0] != 'else') nodes.push(parseword())
    if (code[0] != 'else') _assert2.default.call(void 0, code.shift() == 'end')
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
    const w = code.shift()
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
    _assert2.default.call(void 0, code[0] == 'do')
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
    _assert2.default.call(void 0, code[0] == 'do')
    // this is needed so that the cond succeeds, as parseword/0 modifies `code` without typescript knowing.
    code = code
    const cons = parseword()
    return $.while(cond, cons)
}
function parseuse() {
    const pkg = code.shift()
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
        switch (code.shift()) {
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
    const typ = code.shift()
    if (typ == 'float') return new ast('floatty', [])
    if (typ == 'str') return new ast('strty', [])
    return new ast('namedty', [typ])
}
function parselet() {
    const c = code.shift()
    if (code[0] == ':') {
        code.shift()
        const ty = parsetype()
        _assert2.default.call(void 0, code.shift() == '=')
        return new ast('typedlet', [ty, c, parseword()])
    }
    _assert2.default.call(void 0, code.shift() == '=')
    return new ast('let', [c, parseword()])
}
function parseset() {
    const c = code.shift()
    _assert2.default.call(void 0, code.shift() == '=')
    return new ast('set', [c, parseword()])
}
const map = new Map()
const genuid = (
    id => () =>
        id++
)(/* nice big offset */ 0x414243)

function uid(s) {
    if (!map.has(s)) {
        map.set(s, genuid())
        _plugins.checkForMixin('@qlx/parse:create-atom', [s, map.get(s)])
    }

    return map.get(s)
}

function parseword() {
    if (code[0] == 'end') {
        console.log('error: end in the top level scope!')
        process.exit(1)
    }
    if (code[0] == '+') return code.shift(), parsebinop('add')
    if (code[0] == '-') return code.shift(), parsebinop('sub')
    if (code[0] == '*') return code.shift(), parsebinop('mul')
    if (code[0] == '/') return code.shift(), parsebinop('div')
    if (code[0] == '==') return code.shift(), parsebinop('equal')
    if (code[0] == '>=') return code.shift(), parsebinop('greaterThanEq')
    if (code[0] == '!=') return code.shift(), parsebinop('notEqual')
    if (code[0][0] == '"') return new ast('blox', [code.shift()])
    if (/^([a-zA-Z_][a-zA-Z_0-9]*::)*[a-zA-Z_][a-zA-Z_0-9]*\/(0|[1-9][0-9]*)$/.test(code[0]))
        return parsecall(code.shift().split('/'))
    if (code[0] == 'fn') return code.shift(), parsefn()
    if (code[0] == 'do') return code.shift(), parsedo()
    if (code[0] == 'return') return code.shift(), parsereturn()
    if (code[0] == 'true') return code.shift(), new ast('blox', ['1'])
    if (code[0] == 'false') return code.shift(), new ast('blox', ['0'])
    if (code[0] == 'print') return code.shift(), parseprint()
    if (code[0] == 'printf') return code.shift(), parseprintf()
    if (code[0] == 'printflush') return code.shift(), parseprintflush()
    if (code[0] == 'getlink') return code.shift(), parsegetlink()
    if (code[0] == 'if') return code.shift(), parseif()
    if (code[0] == 'use') return code.shift(), parseuse()
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
    if (code[0][0] == '@') return new ast('blox', [code.shift().slice(1)])
    if (code[0].startsWith('sense.')) return new ast('sense', [code.shift().slice(6), parseword()])
    if (code[0].startsWith('seton'))
        return code.shift(), new ast('seton', [parseword(), parseword()])
    if (/^([1-9][0-9]*|0)(\.[0-9]*)?$/.test(code[0])) return $.number(+code.shift())
    if (code[0][0] == ':') return $.number(uid(code.shift().slice(1)))
    if (code[1] == '=') return parseset()
    return $.var(code.shift())
}

 function parseprogram(s) {
    // code = s.trim().replace(/\s+/g, ' ').split(' ')
    code = lex(s)
    const out = []
    while (code.length) out.push(parseword())
    return new ast('programnode', out)
} exports.parseprogram = parseprogram;
