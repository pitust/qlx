let code: string[]

export class ast {
    constructor(public type: string, public children: (string | ast)[]) {}
}

const $ = {
    fn(name: string, body: ast, argc: number): ast {
        return new ast('fnnode', [name, body, ''+argc])
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
    getlink(arg: ast) {
        return new ast('getlinknode', [arg])
    },
    bindArg(name: string, idx: number) {
        return new ast('bindarg', [name, ''+idx])
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
}

function parsefn() {
    const name = code.shift()
    let args = []
    if (code[0] == '{') {
        code.shift()
        while ([...code][0] != '}') args.push(code.shift())
        code.shift()
    }
    const body = parseword()
    if (args.length) {
        return $.fn(name, $.block([
            ...args.map((e, i) => $.bindArg(e, i)),
            body
        ]), args.length)
    }
    return $.fn(name, body, 0)
}
function parsedo() {
    const nodes: ast[] = []
    while (code[0] != 'end') nodes.push(parseword())
    code.shift()
    return $.block(nodes)
}
function parsereturn() {
    return $.return(parseword())
}
function parsecall(n: number) {
    const args: ast[] = []
    const tgd = code.shift()
    for (let i = 0; i < n; i++) args.push(parseword())
    return $.call(tgd, args)
}
function parseprint() {
    return $.print(parseword())
}
function parseprintflush() {
    return $.printflush(parseword())
}
function parsegetlink() {
    return $.getlink(parseword())
}
function parsebinop(name: string) {
    return $.binop(name, parseword(), parseword())
}

function parseword(): ast {
    if (code[0] == 'fn') return code.shift(), parsefn()
    if (code[0] == 'do') return code.shift(), parsedo()
    if (code[0] == 'return') return code.shift(), parsereturn()
    if (/^call[0-9]+$/.test(code[0])) return parsecall(+code.shift().slice(4))
    if (code[0] == 'print') return code.shift(), parseprint()
    if (code[0] == 'printflush') return code.shift(), parseprintflush()
    if (code[0] == 'getlink') return code.shift(), parsegetlink()
    if (code[0] == '+') return code.shift(), parsebinop('add')
    if (/^[0-9]+$/.test(code[0])) return $.number(+code.shift())
    return $.var(code.shift())
}

export function parseprogram(s: string): ast {
    code = s.trim().replace(/\s+/g, ' ').split(' ')
    const out: ast[] = []
    while (code.length) out.push(parseword())
    return new ast('programnode', out)
}
