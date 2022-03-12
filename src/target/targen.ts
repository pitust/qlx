export function ice(n: string): never {
    console.log('ICE: %s', n)
    process.exit(1)
}

export type name = symbol & { tag: 'name' }
export abstract class Program {
    abstract move(tgd: name, value: name): void
    abstract binop(tgd: name, left: name, op: 'add' | 'lt' | 'eq', right: name): void
    abstract unop(tgd: name, op: 'invert', arg: name): void
    abstract imm(n: number): name
    abstract stri(n: string): name
    abstract name(n: string): name
    abstract name2(n: string): name
    abstract label(tgd: string): void
    abstract br(tgd: string): void
    abstract bz(tgd: string, cond: name): void
    abstract bnz(tgd: string, ncond: name): void
    abstract generate(): string

    // notes
    abstract line(pos: string, source: string): void

    // platform hooks
    abstract platformHookEnd(): void
    abstract platformHookPrintValue(p: name): void
    abstract platformHookPrintString(p: string): void
}

const hlcolors = {
    kw: '\x00r\x003',
    imm: '\x00r\x002',
    ident: '\x00r\x004',
    operator: '\x00r\x001',
    number: '\x00r\x005',
}

const kw = [
    'fn',
    'do',
    'return',
    'true',
    'false',
    'printflush',
    'printf',
    'print',
    'getlink',
    'if',
    'else',
    'end',
    'use',
    'while',
    'switch',
    'case',
    'default',
    'let',
    'read',
    'seton',
    'get{',
    'set{',
    '}',
]
const kwregex = new RegExp('(?<=\\s|^)(' + kw.join('|') + ')(?=\\s|$)', 'g')
function highlight(k: string, hotrange = [0, 0]) {
    k = k
        .replaceAll(/"[^"]*"/g, re => '%s%' + re + '%S%')
        .replaceAll(kwregex, kw => '%k%' + kw + '%r%')
        .replaceAll(/(?<=\s|^)\.?[a-zA-Z_][a-zA-Z_0-9]*(?=\s|$)/g, id => '%i%' + id + '%r%')
        .replaceAll(/(?<=\s|^)[a-zA-Z_][a-zA-Z_0-9]*\/[0-9]+(?=\s|$)/g, id => '%i%' + id + '%r%')
        .replaceAll(/(?<=\s|^)[0-9]+(\.[0-9]*)?(?=\s|$)/g, id => '%n%' + id + '%r%')
        .replaceAll(/(?<!%.%)[\:\*\/\+\-=\.!<>]/g, id => '%o%' + id + '%r%')
        .replaceAll(/(?<=\s|^)@[a-zA-Z_][a-zA-Z_0-9]*(?=\s|$)/g, id => '%@%' + id + '%r%')
        .replaceAll('%n%', hlcolors.number)
        .replaceAll('%i%', hlcolors.ident)
        .replaceAll('%@%', hlcolors.imm)
        .replaceAll('%k%', hlcolors.kw)
        .replaceAll('%o%', hlcolors.operator)
        .replaceAll('%r%', nostyle)
        .replaceAll('%s%', '\x01!+')
        .replaceAll('%S%', '\x01!-')

    // injector...
    let pos = 0
    let state = false
    let output = ''
    let mode = ''
    let is_str = false
    for (let i = 0; i < k.length; i++) {
        if (k[i] == '\x01' && k[i + 1] == '!') {
            if (k[i + 2] == '+') is_str = true
            if (k[i + 2] == '-') is_str = false
            i += 2
            mode = '3'
            if (is_str) output += hlcolors.imm
            else output += nostyle
            continue
        }
        if (k[i] == '\x00') {
            if (!is_str) output += k.slice(i, i + 2)
            i++
            if (!is_str) mode = k[i]
            if (state && k[i] == 'r') output += '\x00+'
            continue
        }
        if (pos >= hotrange[0] && pos < hotrange[0] + hotrange[1] && !state) {
            state = true
            output += '\x00r\x00+'
            if (mode) output += '\x00' + mode
        }
        if (pos >= hotrange[0] + hotrange[1] && state) {
            output += '\x00-\x00r'
            state = false
            if (mode) output += '\x00' + mode
        }
        if (k[i] == '{' && k[i + 1] == '}' && is_str) {
            output += hlcolors.ident + '{}' + hlcolors.imm
            pos += 2
            i++
            continue
        }
        pos += 1
        output += k[i]
    }
    return output
}
const ri = '\x005'
const opc = '\x00+\x002'
const cond = '\x003'
const label = '\x00r\x003'
const glob = '\x00+\x002'
const nostyle = '\x00r'
const comment = '\x00r\x000'
const fmt = {
    assign: '\x00a',
    cflow: '\x00b',
    unit: '\x00c',
    blockio: '\x00d',
    rawio: '\x00e',
}
const selector = '\x00f'
class MindustryProgram extends Program {
    _code: string[] = []
    currentline: string = ''
    nameLookup = new Map<name, string>()
    lookup(n: name): string {
        return this.nameLookup.get(n)
    }
    emit(s: string, line: boolean = true) {
        if (line) s += `\x00%` + this.currentline
        this._code.push(s)
    }
    line(pos: string, source: string): void {
        this.currentline = `${comment}# ${pos.padEnd(24)} | ${highlight(source)}`
    }

    move(tgd: name, value: name): void {
        this.emit(`    ${fmt.assign}set${nostyle} ${this.lookup(tgd)} ${this.lookup(value)}`)
    }
    binop(tgd: name, left: name, op: 'add' | 'lt' | 'eq', right: name): void {
        const binopLookup = {
            add: 'add',
            lt: 'lessThan',
            eq: 'equal',
        } as const
        this.emit(
            `    ${fmt.assign}op ${selector}${binopLookup[op]}${nostyle} ${this.lookup(
                tgd
            )} ${this.lookup(left)} ${this.lookup(right)}`
        )
    }
    unop(tgd: name, op: 'invert', arg: name): void {
        ice('Program: unop')
    }
    imm(n: number): name {
        const sym = Symbol(`${n}`) as name
        this.nameLookup.set(sym, `${ri}${n}${nostyle}`)
        return sym
    }
    stri(n: string): name {
        ice('todo: Program: stri()')
    }
    name(n: string): name {
        const sym = Symbol(`${n}`) as name
        this.nameLookup.set(sym, `${glob}g${n}${nostyle}`)
        return sym
    }
    name2(n: string): name {
        const sym = Symbol(`${n}`) as name
        this.nameLookup.set(sym, `${ri}t${n}${nostyle}`)
        return sym
    }
    label(tgd: string) {
        this.emit(`${label}${tgd}${nostyle}:`, false)
    }
    br(tgd: string) {
        this.emit(`    ${fmt.cflow}jump ${label}${tgd} ${selector}always${nostyle}`)
    }
    bz(tgd: string, cond: name) {
        this.emit(
            `    ${fmt.cflow}jump ${label}${tgd} ${selector}equal ${ri}0${nostyle} ${this.lookup(
                cond
            )}`
        )
    }
    bnz(tgd: string, ncond: name) {
        this.emit(
            `    ${fmt.cflow}jump ${label}${tgd} ${selector}notEqual ${ri}0${nostyle} ${this.lookup(
                ncond
            )}`
        )
    }

    platformHookEnd(): void {
        this.emit(`    ${fmt.cflow}end${nostyle}`)
    }
    platformHookPrintValue(p: name): void {
        this.emit(`    ${fmt.rawio}print${nostyle} ${this.lookup(p)}`)
    }
    platformHookPrintString(p: string): void {
        this.emit(`    ${fmt.rawio}print ${ri}${JSON.stringify(p)}${nostyle}`)
    }

    generate(): string {
        const colormap = {
            r: '\x1b[0m',
            '+': '\x1b[1m',
            '-': '\x1b[2m',
            '0': '\x1b[30m',
            '1': '\x1b[31m',
            '2': '\x1b[32m',
            '3': '\x1b[33m',
            '4': '\x1b[34m',
            '5': '\x1b[35m',
            '6': '\x1b[36m',
            '7': '\x1b[37m',
            a: '\x1b[0;35m', // assign
            b: '\x1b[0;34m', // cflow
            // unit: '\x00c',
            // blockio: '\x00d',
            e: '\x1b[0;31m', // rawio
            f: '\x1b[0;36m', // selector
        }
        const code = this._code
        const maxlen = Math.max(
            ...code.map(e => e.split('\x00%')[0].replaceAll(/\0(.)/g, '').length)
        )

        return code
            .map(line => {
                const [pre, post] = line.split('\x00%')
                if (!post) return pre
                return pre + ' '.repeat(maxlen - pre.replaceAll(/\0(.)/g, '').length + 5) + post
            })
            .join('\n')
            .replaceAll(/\0(.)/g, (_, mode) => {
                if (process.env.QLXCOLOR == 'on') {
                    if (mode in colormap) return colormap[mode]
                    return '{' + mode + '}'
                } else if (process.env.QLXCOLOR == 'debug') {
                    return '{' + mode + '}'
                } else {
                    return ''
                }
            })
    }
}

export function createProgram(): Program {
    return new MindustryProgram()
}
