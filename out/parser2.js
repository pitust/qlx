"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }
var _middlegen = require('./middlegen');

var TokenType; (function (TokenType) {
    // basics
    const STRING = 0; TokenType[TokenType["STRING"] = STRING] = "STRING";
    const NUMBER = STRING + 1; TokenType[TokenType["NUMBER"] = NUMBER] = "NUMBER";
    const IDENTIFIER = NUMBER + 1; TokenType[TokenType["IDENTIFIER"] = IDENTIFIER] = "IDENTIFIER";

    // keywords
    const FN = IDENTIFIER + 1; TokenType[TokenType["FN"] = FN] = "FN";
    const IF = FN + 1; TokenType[TokenType["IF"] = IF] = "IF";
    const ELSE = IF + 1; TokenType[TokenType["ELSE"] = ELSE] = "ELSE";
    const WHILE = ELSE + 1; TokenType[TokenType["WHILE"] = WHILE] = "WHILE";
    const LET = WHILE + 1; TokenType[TokenType["LET"] = LET] = "LET";
    const DO = LET + 1; TokenType[TokenType["DO"] = DO] = "DO";
    const RETURN = DO + 1; TokenType[TokenType["RETURN"] = RETURN] = "RETURN";
    const SWITCH = RETURN + 1; TokenType[TokenType["SWITCH"] = SWITCH] = "SWITCH";
    const CASE = SWITCH + 1; TokenType[TokenType["CASE"] = CASE] = "CASE";
    const DEFAULT = CASE + 1; TokenType[TokenType["DEFAULT"] = DEFAULT] = "DEFAULT";
    const STRUCT = DEFAULT + 1; TokenType[TokenType["STRUCT"] = STRUCT] = "STRUCT";
    const ASM = STRUCT + 1; TokenType[TokenType["ASM"] = ASM] = "ASM";

    // operators
    const EQUAL = ASM + 1; TokenType[TokenType["EQUAL"] = EQUAL] = "EQUAL"; // ==
    const GREATER = EQUAL + 1; TokenType[TokenType["GREATER"] = GREATER] = "GREATER"; // >
    const LESS = GREATER + 1; TokenType[TokenType["LESS"] = LESS] = "LESS"; // <
    const GEQUAL = LESS + 1; TokenType[TokenType["GEQUAL"] = GEQUAL] = "GEQUAL"; // >=
    const LEQUAL = GEQUAL + 1; TokenType[TokenType["LEQUAL"] = LEQUAL] = "LEQUAL"; // <=
    const NEQUAL = LEQUAL + 1; TokenType[TokenType["NEQUAL"] = NEQUAL] = "NEQUAL"; // !=
    const ASSIGN = NEQUAL + 1; TokenType[TokenType["ASSIGN"] = ASSIGN] = "ASSIGN"; // =
    const PLUS = ASSIGN + 1; TokenType[TokenType["PLUS"] = PLUS] = "PLUS"; // +
    const MINUS = PLUS + 1; TokenType[TokenType["MINUS"] = MINUS] = "MINUS"; // -
    const STAR = MINUS + 1; TokenType[TokenType["STAR"] = STAR] = "STAR"; // *
    const SLASH = STAR + 1; TokenType[TokenType["SLASH"] = SLASH] = "SLASH"; // /
    const PERCENT = SLASH + 1; TokenType[TokenType["PERCENT"] = PERCENT] = "PERCENT"; // %
    const CARET = PERCENT + 1; TokenType[TokenType["CARET"] = CARET] = "CARET"; // ^
    const AMPERSAND = CARET + 1; TokenType[TokenType["AMPERSAND"] = AMPERSAND] = "AMPERSAND"; // &
    const DOBULE_AMPERSAND = AMPERSAND + 1; TokenType[TokenType["DOBULE_AMPERSAND"] = DOBULE_AMPERSAND] = "DOBULE_AMPERSAND"; // &&
    const PIPE = DOBULE_AMPERSAND + 1; TokenType[TokenType["PIPE"] = PIPE] = "PIPE"; // |
    const DOUBLE_PIPE = PIPE + 1; TokenType[TokenType["DOUBLE_PIPE"] = DOUBLE_PIPE] = "DOUBLE_PIPE"; // ||
    const SHL = DOUBLE_PIPE + 1; TokenType[TokenType["SHL"] = SHL] = "SHL"; // <<
    const SHR = SHL + 1; TokenType[TokenType["SHR"] = SHR] = "SHR"; // >>
    const TILDA = SHR + 1; TokenType[TokenType["TILDA"] = TILDA] = "TILDA"; // ~

    // symbols
    const COMMA = TILDA + 1; TokenType[TokenType["COMMA"] = COMMA] = "COMMA"; // ,
    const SEMI = COMMA + 1; TokenType[TokenType["SEMI"] = SEMI] = "SEMI"; // ;
    const EQARROW = SEMI + 1; TokenType[TokenType["EQARROW"] = EQARROW] = "EQARROW"; // =>
    const COLON = EQARROW + 1; TokenType[TokenType["COLON"] = COLON] = "COLON"; // :
    const DASHARROW = COLON + 1; TokenType[TokenType["DASHARROW"] = DASHARROW] = "DASHARROW"; // ->

    // brackets
    const OPEN_PAREN = DASHARROW + 1; TokenType[TokenType["OPEN_PAREN"] = OPEN_PAREN] = "OPEN_PAREN"; // (
    const CLOSE_PAREN = OPEN_PAREN + 1; TokenType[TokenType["CLOSE_PAREN"] = CLOSE_PAREN] = "CLOSE_PAREN"; // )
    const OPEN_CURLY = CLOSE_PAREN + 1; TokenType[TokenType["OPEN_CURLY"] = OPEN_CURLY] = "OPEN_CURLY"; // {
    const CLOSE_CURLY = OPEN_CURLY + 1; TokenType[TokenType["CLOSE_CURLY"] = CLOSE_CURLY] = "CLOSE_CURLY"; // }
    const OPEN_ANGLED = CLOSE_CURLY + 1; TokenType[TokenType["OPEN_ANGLED"] = OPEN_ANGLED] = "OPEN_ANGLED"; // <
    const CLOSE_ANGLED = OPEN_ANGLED + 1; TokenType[TokenType["CLOSE_ANGLED"] = CLOSE_ANGLED] = "CLOSE_ANGLED"; // >
    const OPEN_SQUARE = CLOSE_ANGLED + 1; TokenType[TokenType["OPEN_SQUARE"] = OPEN_SQUARE] = "OPEN_SQUARE"; // [
    const CLOSE_SQUARE = OPEN_SQUARE + 1; TokenType[TokenType["CLOSE_SQUARE"] = CLOSE_SQUARE] = "CLOSE_SQUARE"; // ]

    // type names
    const FLOAT = CLOSE_SQUARE + 1; TokenType[TokenType["FLOAT"] = FLOAT] = "FLOAT";
    const HANDLE = FLOAT + 1; TokenType[TokenType["HANDLE"] = HANDLE] = "HANDLE";
    const VOID = HANDLE + 1; TokenType[TokenType["VOID"] = VOID] = "VOID";

    const EOF = VOID + 1; TokenType[TokenType["EOF"] = EOF] = "EOF";
})(TokenType || (TokenType = {}));
class Token {
    constructor(
         file,
         line,
         col,
         end,
         type,
         inner,
         linesrc
    ) {;this.file = file;this.line = line;this.col = col;this.end = end;this.type = type;this.inner = inner;this.linesrc = linesrc;}
}

function lex(file, s) {
    const ts = []

    let line = 0,
        col = 0

    const PREFIX_SET = {
        '=>': TokenType.EQARROW,
        ':': TokenType.COLON,
        '->': TokenType.DASHARROW,
        '==': TokenType.EQUAL,
        '>=': TokenType.GEQUAL,
        '<=': TokenType.LEQUAL,
        '!=': TokenType.NEQUAL,
        ',': TokenType.COMMA,
        '=': TokenType.ASSIGN,
        ';': TokenType.SEMI,
        '+': TokenType.PLUS,
        '-': TokenType.MINUS,
        '*': TokenType.STAR,
        '/': TokenType.SLASH,
        '(': TokenType.OPEN_PAREN,
        ')': TokenType.CLOSE_PAREN,
        '{': TokenType.OPEN_CURLY,
        '}': TokenType.CLOSE_CURLY,
        '<': TokenType.OPEN_ANGLED,
        '>': TokenType.CLOSE_ANGLED,
        '[': TokenType.OPEN_SQUARE,
        ']': TokenType.CLOSE_SQUARE,
    }
    const REGEX_MATCHERS = new Map([
        [/^0x[0-9a-f]+\b/, match => [TokenType.NUMBER , (+match).toString()]],
        [/^([1-9][0-9]*|0)\b/, match => [TokenType.NUMBER , (+match).toString()]],
        [/^[a-zA-Z_$][a-zA-Z_$0-9]*\b/, match => [TokenType.IDENTIFIER, match]],
        [/^"([^"\\]|\\"|\\n)+"/, match => [TokenType.STRING, JSON.parse(match)]],
    ])

    const KEYWORDS = {
        fn: TokenType.FN,
        if: TokenType.IF,
        else: TokenType.ELSE,
        while: TokenType.WHILE,
        let: TokenType.LET,
        do: TokenType.DO,
        switch: TokenType.SWITCH,
        case: TokenType.CASE,
        default: TokenType.DEFAULT,
        struct: TokenType.STRUCT,
        return: TokenType.RETURN,
        float: TokenType.FLOAT,
        handle: TokenType.HANDLE,
        void: TokenType.VOID,
        asm: TokenType.ASM,
    }

    const lines = s.split('\n')
    scanning: while (s.length) {
        if (/\s/.test(s[0])) {
            if (s[0] == '\n') {
                line++
                col = 0
            } else {
                col++
            }
            s = s.slice(1)
            continue
        }
        if (s.startsWith('//')) {
            s = s.split('\n').slice(1).join('\n')
            line++
            col = 0
            continue scanning
        }
        for (const [prefix, tt] of Object.entries(PREFIX_SET)) {
            if (s.startsWith(prefix)) {
                const token = new Token(file, line+1, col+1, col + prefix.length+1, tt, prefix, lines[line])
                s = s.slice(prefix.length)
                col += prefix.length
                ts.push(token)
                continue scanning
            }
        }

        for (const [regex, target] of REGEX_MATCHERS) {
            const result = regex.exec(s)
            if (!result) continue
            const match = result[0]
            let [tt, str] = target(match)
            if (tt == TokenType.IDENTIFIER && match in KEYWORDS) {
                tt = KEYWORDS[match]
            }
            const token = new Token(file, line+1, col+1, col + match.length+1, tt, str, lines[line])
            col += match.length
            s = s.slice(match.length)
            ts.push(token)
            continue scanning
        }

        throw new Error(`at ${file}:${line}:${col}: bad char ${s[0]}`)
    }

    return ts
}










function pos() {
    return ts => [ts, ts[0]]
}
function lookahead(ty) {
    return ts => (ts[0].type == ty ? [ts, ts[0]] : null)
}
function expect(ty) {
    return ts => (ts[0].type == ty ? [ts.slice(1), ts[0]] : null)
}
function expid(s) {
    return ts => (ts[0].type == TokenType.IDENTIFIER && ts[0].inner == s ? [ts.slice(1), ts[0]] : null)
}

function executeParser(ts, parser) {
    if (parser === null) return [ts, null]
    if (typeof parser == 'string') {
        if (!ts.length) return null
        parser = TokenType[parser]
        if (ts[0].type == parser) {
            return [ts.slice(1), ts[0].inner ]
        }
        return null
    }
    if (typeof parser == 'number') {
        if (!ts.length) {
            return null
        }
        if (ts[0].type == parser) {
            return [ts.slice(1), ts[0].inner ]
        }
        return null
    }
    if (typeof parser == 'object') {
        const res = {} 
        for (const [fld, subparser] of Object.entries(parser)) {
            const resl = executeParser(ts, subparser)
            if (!resl) return null
            ts = resl[0]
            res[fld] = resl[1]
        }
        return [ts, res]
    }
    return parser(ts)
}
function map(target, translate) {
    return ts => {
        const res = executeParser(ts, target)
        if (res) return [res[0], translate(res[1])]
        return null
    }
}
function repeat(canEmpty, parse) {
    return repeatDelim(canEmpty, parse, null)
}
function repeatDelim(canEmpty, parse, delim) {
    return ts => {
        const res = []
        const r1 = executeParser(ts, parse)
        if (!r1 && canEmpty) return [ts, []] 
        if (!r1) return null
        res.push(r1[1])
        ts = r1[0]
        while (true) {
            const rn = executeParser(ts, delim)
            if (!rn) break
            ts = rn[0]

            const rn2 = executeParser(ts, parse)
            if (!rn2) break
            ts = rn2[0]
            res.push(rn2[1])
        }
        return [ts, res] 
    }
}
function defer(tgd) {
    let inner = null
    function target(ts) {
        if (inner === null) throw new Error('deferred instantiation of ' + tgd + ' never set')
        return executeParser(ts, inner)
    }
    target.register = (newinner) => {
        inner = newinner
    }
    return target
}


 class ast {
    
    
    
    constructor(tk,  type,  children) {;this.type = type;this.children = children;
        this.pos = `${tk.file}:${tk.line}:${tk.col}`
        this.codeline = tk.linesrc
        this.range = [tk.col, tk.end]
    }
} exports.ast = ast;

const Node = (
    type,
    ...src
) => {
    const obj = {}
    const remap = []
    let iter = 0
    for (const i in src) {
        const target = src[i]
        if (typeof target == 'string' || target instanceof ast) {
            const target2 = target  // wtf typescript
            remap.push(iter)
            obj[iter++] = map({}, () => target2)
        } else if (target instanceof Array) {
            obj[iter++] = target[0] 
        } else {
            const target2 = target 
            const res = target2()
            remap.push(iter)
            obj[iter++] = res
        }
    }
    return map(
        {
            p1: pos(),
            inside: obj,
            p2: pos(),
        },
        ({ p1, inside, p2 }) =>
            new ast(
                p1,
                type,
                remap.map(i => inside[i])
            )
    )
}
function oneof(...opt) {
    return ts => {
        for (const opto of opt) {
            const sel = executeParser(ts, opto)
            if (sel) return sel
        }
        return null
    }
}

const noopsemi = Node('noop', [TokenType.SEMI])

const stmt = defer('stmt')
const expr = defer('expr')
const lval = defer('lval')
const typ = defer('type')
const asminsn = defer('asminsn')
const asmop = defer('asmop')
const asmioop = defer('asmopnotid')

asmop.register(
    oneof(
        Node('asm.id', () => TokenType.IDENTIFIER),
        Node('asm.num', () => TokenType.NUMBER),
        asmioop
    )
)
const trueio = oneof(
    Node('asm.in', [TokenType.OPEN_PAREN], () => expr, [TokenType.CLOSE_PAREN]),
    Node('asm.out', [TokenType.ASSIGN], [TokenType.OPEN_PAREN], () => lval, [TokenType.CLOSE_PAREN]),
)
asmioop.register(ts => _middlegen.options.frontend_qlxasm ? null : executeParser(ts, trueio))
asminsn.register(
    oneof(
        Node(
            'asm.set',
            [expid('set')],
            () => TokenType.IDENTIFIER,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.SEMI]
        ),
        Node(
            'asm.op.sym',
            () => TokenType.IDENTIFIER,
            [TokenType.ASSIGN],
            () => asmop,
            () =>
                oneof(
                    Node('asm.op.add', [TokenType.PLUS]),
                    Node('asm.op.sub', [TokenType.MINUS]),
                    Node('asm.op.mul', [TokenType.STAR]),
                    Node('asm.op.div', [TokenType.SLASH]),
                    Node('asm.op.mod', [TokenType.PERCENT]),
                    Node('asm.op.xor', [TokenType.CARET]),
                    Node('asm.op.eq', [TokenType.EQUAL]),
                    Node('asm.op.neq', [TokenType.NEQUAL]),
                    Node('asm.op.land', [TokenType.DOBULE_AMPERSAND]),
                    Node('asm.op.lt', [TokenType.LESS]),
                    Node('asm.op.le', [TokenType.LEQUAL]),
                    Node('asm.op.gt', [TokenType.GREATER]),
                    Node('asm.op.ge', [TokenType.GEQUAL]),
                    Node('asm.op.shl', [TokenType.SHL]),
                    Node('asm.op.shr', [TokenType.SHR]),
                    Node('asm.op.or', [TokenType.PIPE]),
                    Node('asm.op.or', [TokenType.DOUBLE_PIPE]),
                    Node('asm.op.band', [TokenType.AMPERSAND]),
                    Node('asm.op.xor', [TokenType.CARET])
                ),
            () => asmop,
            [TokenType.SEMI]
        ),
        Node(
            'asm.op.func',
            () => TokenType.IDENTIFIER,
            [TokenType.ASSIGN],
            () =>
                oneof(
                    Node('asm.op.add', [expid('add')]),
                    Node('asm.op.sub', [expid('sub')]),
                    Node('asm.op.mul', [expid('mul')]),
                    Node('asm.op.div', [expid('div')]),
                    Node('asm.op.idiv', [expid('idiv')]),
                    Node('asm.op.mod', [expid('mod')]),
                    Node('asm.op.xor', [expid('xor')]),
                    Node('asm.op.eq', [expid('eq')]),
                    Node('asm.op.neq', [expid('neq')]),
                    Node('asm.op.land', [expid('land')]),
                    Node('asm.op.lt', [expid('lt')]),
                    Node('asm.op.le', [expid('le')]),
                    Node('asm.op.stricteq', [expid('stricteq')]),
                    Node('asm.op.gt', [expid('gt')]),
                    Node('asm.op.ge', [expid('ge')]),
                    Node('asm.op.shl', [expid('shl')]),
                    Node('asm.op.shr', [expid('shr')]),
                    Node('asm.op.or', [expid('or')]),
                    Node('asm.op.or', [expid('or')]),
                    Node('asm.op.band', [expid('band')]),
                    Node('asm.op.xor', [expid('xor')]),
                    Node('asm.op.min', [expid('min')]),
                    Node('asm.op.max', [expid('max')]),
                    Node('asm.op.angle', [expid('angle')]),
                    Node('asm.op.angle', [expid('atan2')]),
                    Node('asm.op.len', [expid('len')]),
                    Node('asm.op.simplex', [expid('noise')]),
                    Node('asm.op.simplex', [expid('simplex2d')]),
                    Node('asm.op.read', [expid('read')])
                ),
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN]
        ),
        Node(
            'asm.op.flip',
            () => TokenType.IDENTIFIER,
            [TokenType.ASSIGN],
            [TokenType.TILDA],
            () => asmop,
            [TokenType.SEMI]
        ),
        Node(
            'asm.op.abs',
            () => TokenType.IDENTIFIER,
            [TokenType.ASSIGN],
            [TokenType.PIPE],
            () => asmop,
            [TokenType.PIPE],
            [TokenType.SEMI]
        ),
        Node(
            'asm.op.1func',
            () => TokenType.IDENTIFIER,
            [TokenType.ASSIGN],
            () =>
                oneof(
                    Node('asm.op.flip', [expid('flip')]),
                    Node('asm.op.abs', [expid('abs')]),
                    Node('asm.op.ln', [expid('ln')]),
                    Node('asm.op.log10', [expid('log10')]),
                    Node('asm.op.floor', [expid('floor')]),
                    Node('asm.op.ceil', [expid('ceil')]),
                    Node('asm.op.sqrt', [expid('sqrt')]),
                    Node('asm.op.rand', [expid('rand')]),
                    Node('asm.op.sin', [expid('sin')]),
                    Node('asm.op.cos', [expid('cos')]),
                    Node('asm.op.tan', [expid('tan')]),
                    Node('asm.op.asin', [expid('asin')]),
                    Node('asm.op.acos', [expid('acos')]),
                    Node('asm.op.atan', [expid('atan')])
                ),
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node('asm.end', [expid('end')], [TokenType.SEMI]),
        Node(
            'asm.condjump',
            () =>
                oneof(
                    Node('asm.jump.eq', [expid('beq')]),
                    Node('asm.jump.ne', [expid('bne')]),
                    Node('asm.jump.lt', [expid('blt')]),
                    Node('asm.jump.gt', [expid('bgt')]),
                    Node('asm.jump.le', [expid('ble')]),
                    Node('asm.jump.ge', [expid('bge')]),
                    Node('asm.jump.stricteq', [expid('bstricteq')])
                ),
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.EQARROW],
            () => TokenType.IDENTIFIER,
            [TokenType.SEMI]
        ),
        Node('asm.jump', [expid('b')], () => TokenType.IDENTIFIER, [TokenType.SEMI]),
        Node('asm.label', () => TokenType.IDENTIFIER, [TokenType.COLON]),
        Node(
            'asm.write',
            [expid('write')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.ASSIGN],
            () => asmop,
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.clear',
            [expid('drawClear')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.color',
            [expid('drawColor')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.packedcolor',
            [expid('drawPackedColor')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.stroke',
            [expid('drawStroke')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.line',
            [expid('drawLine')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.rect',
            [expid('drawRectangle')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.linerect',
            [expid('drawRectangleOutline')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.poly',
            [expid('drawPolygon')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.linepoly',
            [expid('drawPolygonOutline')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.triangle',
            [expid('drawTriangle')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.draw.image',
            [expid('drawImage')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.COMMA],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.print',
            [expid('print')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.printflush',
            [expid('printFlush')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.drawflush',
            [expid('drawFlush')],
            [TokenType.OPEN_PAREN],
            () => asmop,
            [TokenType.CLOSE_PAREN],
            [TokenType.SEMI]
        ),
        Node(
            'asm.getlink',
            () => asmop,
            [TokenType.ASSIGN],
            [expid('link')],
            [TokenType.OPEN_SQUARE],
            () => asmop,
            [TokenType.CLOSE_SQUARE],
            [TokenType.SEMI]
        ),
        Node(
            'asm.read',
            () => asmop,
            [TokenType.ASSIGN],
            () => asmop,
            [TokenType.OPEN_SQUARE],
            () => asmop,
            [TokenType.CLOSE_SQUARE],
            [TokenType.SEMI]
        ),
        Node(
            'asm.write',
            () => asmop,
            [TokenType.OPEN_SQUARE],
            () => asmop,
            [TokenType.CLOSE_SQUARE],
            [TokenType.ASSIGN],
            () => asmop,
            [TokenType.SEMI]
        ),
        Node(
            'asm.setout',
            () => asmioop,
            [TokenType.ASSIGN],
            () => asmop,
            [TokenType.SEMI]
        ),
        Node(
            'asm.set',
            () => TokenType.IDENTIFIER,
            [TokenType.ASSIGN],
            () => asmop,
            [TokenType.SEMI]
        )
    )
)
typ.register(
    oneof(
        Node(
            'template',
            () => TokenType.IDENTIFIER,
            [TokenType.OPEN_SQUARE],
            () => repeatDelim(true, typ, TokenType.COMMA),
            [TokenType.CLOSE_SQUARE]
        ),
        Node('voidty', () => TokenType.VOID),
        Node('handlety', () => TokenType.HANDLE),
        Node('floatty', () => TokenType.FLOAT),
        Node('idtype', () => TokenType.IDENTIFIER)
    )
)
stmt.register(
    oneof(
        Node('printnode', [expid('print')], () => expr, [TokenType.SEMI]),
        Node(
            'if',
            [TokenType.IF],
            [TokenType.OPEN_PAREN],
            () => expr,
            [TokenType.CLOSE_PAREN],
            () => stmt,
            () =>
                oneof(
                    map(
                        {
                            else: TokenType.ELSE,
                            stmt,
                        },
                        x => x.stmt
                    ),
                    Node('block2', () => map({}, () => []))
                )
        ),
        Node(
            'while',
            [TokenType.WHILE],
            [TokenType.OPEN_PAREN],
            () => expr,
            [TokenType.CLOSE_PAREN],
            () => stmt
        ),
        Node('returnnode', [TokenType.RETURN], () => expr, [TokenType.SEMI]),
        Node('block2', [TokenType.OPEN_CURLY], () => repeat(true, stmt), [TokenType.CLOSE_CURLY]),
        Node('drop', () => expr, [TokenType.SEMI]),
        Node(
            'vardef',
            [TokenType.LET],
            () => TokenType.IDENTIFIER,
            () =>
                oneof(
                    typ,
                    map({ pos: pos() }, x => new ast(x.pos, 'idtype', ['_']))
                ),
            [TokenType.ASSIGN],
            () => expr,
            [TokenType.SEMI]
        ),
        Node('asm', [TokenType.ASM], [TokenType.OPEN_CURLY], () => repeat(true, asminsn), () => Node('endmarker'), [TokenType.CLOSE_CURLY]),
        noopsemi
    )
    // statements
)
{
    let parent_expr = oneof(
        // number, string
        Node('number', () => TokenType.NUMBER),
        Node('strlit', () => TokenType.STRING),
        // function calls
        Node(
            'callnode',
            () => TokenType.IDENTIFIER,
            [TokenType.OPEN_PAREN],
            () =>
                map(
                    {
                        p1: pos(),
                        items: repeatDelim(true, expr, TokenType.COMMA),
                    },
                    x => new ast(x.p1, 'callargs', x.items)
                ),
            [TokenType.CLOSE_PAREN]
        ),
        lval
    )
    lval.register(oneof(Node('varnode', () => TokenType.IDENTIFIER)))
    parent_expr = oneof(
        Node(
            'assign',
            () => parent_expr,
            [TokenType.ASSIGN],
            () => expr
        ),
        parent_expr
    )

    expr.register(parent_expr)
}
// name, body, '' + argc, args
 const proc = Node(
    'fn2',
    [TokenType.FN],
    () => TokenType.IDENTIFIER,
    [TokenType.OPEN_PAREN],
    () =>
        repeatDelim(
            true,
            Node(
                'arg',
                () => TokenType.IDENTIFIER,
                [TokenType.COLON],
                () => typ
            ),
            TokenType.COMMA
        ),
    [TokenType.CLOSE_PAREN],
    () =>
        oneof(
            map(
                {
                    _: TokenType.DASHARROW,
                    ty: typ,
                },
                x => x.ty
            ),
            map({ p: pos() }, x => new ast(x.p, 'voidtype', []))
        ),
    () =>
        oneof(
            Node('block2', [TokenType.OPEN_CURLY], () => repeat(true, stmt), [TokenType.CLOSE_CURLY]),
            Node('block2', () =>
                map({ pos: pos(), _: TokenType.ASSIGN, expr, __: TokenType.SEMI }, x => [
                    new ast(x.pos, 'returnnode', [x.expr]),
                ])
            )
        )
); exports.proc = proc
 const struc = oneof(
    Node(
        'tstruct',
        [TokenType.STRUCT],
        () => TokenType.IDENTIFIER,
        [TokenType.OPEN_SQUARE],
        () =>
            repeatDelim(
                true,
                Node('targ', () => TokenType.IDENTIFIER),
                TokenType.COMMA
            ),
        [TokenType.CLOSE_SQUARE],
        [TokenType.OPEN_CURLY],
        () =>
            repeat(
                true,
                Node(
                    'structitem',
                    () => TokenType.IDENTIFIER,
                    [TokenType.COLON],
                    () => typ,
                    [oneof(lookahead(TokenType.CLOSE_CURLY), TokenType.COMMA, TokenType.SEMI)]
                )
            ),
        [TokenType.CLOSE_CURLY]
    ),
    Node(
        'struct',
        [TokenType.STRUCT],
        () => TokenType.IDENTIFIER,
        [TokenType.OPEN_CURLY],
        () =>
            repeat(
                true,
                Node(
                    'structitem',
                    () => TokenType.IDENTIFIER,
                    [TokenType.COLON],
                    () => typ,
                    [oneof(lookahead(TokenType.CLOSE_CURLY), TokenType.COMMA, TokenType.SEMI)]
                )
            ),
        [TokenType.CLOSE_CURLY]
    )
); exports.struc = struc

const asmroot = Node('asm', () => repeat(true, asminsn), () => Node('endmarker'), [TokenType.EOF])
const root = Node('root', () => repeat(true, oneof(stmt, exports.proc, exports.struc)), [TokenType.EOF])

 function parse(n, s) {
    const ls = lex(n, s)
    ls.push(
        new Token(
            ls.slice(-1)[0].file,
            ls.slice(-1)[0].line,
            ls.slice(-1)[0].col,
            ls.slice(-1)[0].end,
            TokenType.EOF,
            '',
            '// end of file //'
        )
    )
    const [, tree] =
        _nullishCoalesce(executeParser(ls, root), () => (
        (() => {
            console.log('parse failed!')
            process.exit(1)
        })()))
    return tree
} exports.parse = parse;
 function parseasm(n, s) {
    const ls = lex(n, s)
    ls.push(
        new Token(
            ls.slice(-1)[0].file,
            ls.slice(-1)[0].line,
            ls.slice(-1)[0].col,
            ls.slice(-1)[0].end,
            TokenType.EOF,
            '',
            '// end of file //'
        )
    )
    const [, tree] =
        _nullishCoalesce(executeParser(ls, asmroot), () => (
        (() => {
            console.log('parse failed!')
            process.exit(1)
        })()))
    return tree
} exports.parseasm = parseasm;
