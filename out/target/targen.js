"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function ice(n) {
    console.log('ICE: %s', n)
    process.exit(1)
} exports.ice = ice;


 class Program {
    



















} exports.Program = Program;

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
function highlight(k, hotrange = [0, 0]) {
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
class MindustryProgram extends Program {constructor(...args) { super(...args); MindustryProgram.prototype.__init.call(this);MindustryProgram.prototype.__init2.call(this);MindustryProgram.prototype.__init3.call(this); }
    __init() {this._code = []}
    __init2() {this.currentline = ''}
    __init3() {this.nameLookup = new Map()}
    lookup(n) {
        return this.nameLookup.get(n)
    }
    emit(s, line = true) {
        if (line) s += `\x00%` + this.currentline
        this._code.push(s)
    }
    line(pos, source) {
        this.currentline = `${comment}# ${pos.padEnd(24)} | ${highlight(source)}`
    }

    move(tgd, value) {
        this.emit(`    ${fmt.assign}set${nostyle} ${this.lookup(tgd)} ${this.lookup(value)}`)
    }
    binop(tgd, left, op, right) {
        const binopLookup = {
            add: 'add',
            lt: 'lessThan',
            eq: 'equal',
        } 
        this.emit(
            `    ${fmt.assign}op ${selector}${binopLookup[op]}${nostyle} ${this.lookup(
                tgd
            )} ${this.lookup(left)} ${this.lookup(right)}`
        )
    }
    unop(tgd, op, arg) {
        ice('Program: unop')
    }
    imm(n) {
        const sym = Symbol(`${n}`) 
        this.nameLookup.set(sym, `${ri}${n}${nostyle}`)
        return sym
    }
    stri(n) {
        ice('todo: Program: stri()')
    }
    name(n) {
        const sym = Symbol(`${n}`) 
        this.nameLookup.set(sym, `${glob}g${n}${nostyle}`)
        return sym
    }
    name2(n) {
        const sym = Symbol(`${n}`) 
        this.nameLookup.set(sym, `${ri}t${n}${nostyle}`)
        return sym
    }
    label(tgd) {
        this.emit(`${label}${tgd}${nostyle}:`, false)
    }
    br(tgd) {
        this.emit(`    ${fmt.cflow}jump ${label}${tgd} ${selector}always${nostyle}`)
    }
    bz(tgd, cond) {
        this.emit(
            `    ${fmt.cflow}jump ${label}${tgd} ${selector}equal ${ri}0${nostyle} ${this.lookup(
                cond
            )}`
        )
    }
    bnz(tgd, ncond) {
        this.emit(
            `    ${fmt.cflow}jump ${label}${tgd} ${selector}notEqual ${ri}0${nostyle} ${this.lookup(
                ncond
            )}`
        )
    }

    platformHookEnd() {
        this.emit(`    ${fmt.cflow}end${nostyle}`)
    }
    platformHookPrintValue(p) {
        this.emit(`    ${fmt.rawio}print${nostyle} ${this.lookup(p)}`)
    }
    platformHookPrintString(p) {
        this.emit(`    ${fmt.rawio}print ${ri}${JSON.stringify(p)}${nostyle}`)
    }

    generate() {
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

 function createProgram() {
    return new MindustryProgram()
} exports.createProgram = createProgram;
