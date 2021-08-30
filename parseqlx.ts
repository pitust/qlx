let code: string[]

export class ast {
    constructor(public type: string, public children: (string | ast)[]) {}
}

const $ = {
    fn(name: string, body: ast): ast {
        return new ast('fnnode', [name, body])
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
    var(name: string) {
        return new ast('varnode', [name])
    },
}

function parsefn() {
    const name = code.shift()
    const body = parseword()
    return $.fn(name, body)
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

function parseword(): ast {
    if (code[0] == 'fn') return code.shift(), parsefn()
    if (code[0] == 'do') return code.shift(), parsedo()
    if (code[0] == 'return') return code.shift(), parsereturn()
    if (/^call[0-9]+$/.test(code[0])) return parsecall(+code.shift().slice(4))
    if (code[0] == 'print') return code.shift(), parseprint()
    if (code[0] == 'printflush') return code.shift(), parseprintflush()
    if (code[0] == 'getlink') return code.shift(), parsegetlink()
    return $.var(code.shift())
}

export function parseprogram(s: string): ast {
    code = s.trim().replace(/\s+/g, ' ').split(' ')
    const out: ast[] = []
    while (code.length) out.push(parseword())
    return new ast('programnode', out)
}
