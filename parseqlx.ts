const code = `fn four do
return + 2 2
end

print call0 four

printflush getlink 0`
    .replace(/\s+/g, ' ')
    .split(' ')

class ast {
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
        return new ast('return', [node])
    }
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

function parseword() {
    if (code[0] == 'fn') return code.shift(), parsefn()
    if (code[0] == 'do') return code.shift(), parsedo()
    if (code[0] == 'return') return code.shift(), parsereturn()
    if (/^code[0-9]+$/.test(code[0])) return parsecall(+code.shift().slice(4))
    if (code[0] == 'print') return code.shift(), parseprint()
    if (code[0] == 'printflush') return code.shift(), parseprintflush()
    if (code[0] == 'getlink') return code.shift(), parsegetlink()
    return $.var(code.shift())
}
