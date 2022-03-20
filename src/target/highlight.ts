export const hlcolors = {
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
    '{',
    '}',
]
const kwregex = new RegExp('(?<=\\s|^)(' + kw.join('|') + ')(?=\\s|$)', 'g')
export function highlight(k: string, hotrange = [0, 0]) {
    k = k
        .replaceAll(/"[^"]*"/g, re => '%s%' + re + '%S%')
        .replaceAll(kwregex, kw => '%k%' + kw + '%r%')
        .replaceAll(/(?<=\s|^)\.?[a-zA-Z_][a-zA-Z_0-9]*(?=\s|$)/g, id => '%i%' + id + '%r%')
        .replaceAll(
            /(?<=\s|^)([a-zA-Z_][a-zA-Z_0-9]*)(\/[0-9]+)(?=(\s|$))/g,
            (_, id, p2) => '%i%' + id + '%o%' + p2 + '%r%'
        )
        .replaceAll(/(?<=\s|^|\/%r%)[0-9]+(\.[0-9]*)?(?=\s|$)/g, id => '%n%' + id + '%r%')
        .replaceAll(/(?<!%.%)(?<![a-z])[\:\*\/\+\-=\.!<>]/g, id => '%o%' + id + '%r%')
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
export const ri = '\x005'
export const opc = '\x00+\x002'
export const cond = '\x003'
export const label = '\x00r\x003'
export const glob = '\x00+\x002'
export const nostyle = '\x00r'
export const comment = '\x00r\x000'
export const fmt = {
    assign: '\x00a',
    cflow: '\x00b',
    unit: '\x00c',
    blockio: '\x00d',
    rawio: '\x00e',
}
export const selector = '\x00f'

export const COMPILED_BY_QLX_BANNER = (src: 'native' | 'mlog') => {
    let banner = '    '
    if (process.env.QLCOLOR == 'on') {
        if (process.env.QLX_DARKER_COMMENT == 'on') banner += '\x1b[0;30m'
        else banner += '\x1b[0m;37m'
    }
    if (src == 'native') banner += ';'
    else banner += '#'
    banner += ' '
    banner += 'compiled by qlx'
    if (process.env.QLXCOLOR == 'on') {
        banner += '\x1b[0m'
    }
    return banner
}
const colormap = {
    r: '\x1b[0m',
    '+': '\x1b[1m',
    '-': '\x1b[2m',
    '0': process.env.QLX_DARKER_COMMENT == 'on' ? '\x1b[0;30m' : '\x1b[0;1;30m',
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
export function finalizeColors(code: string[]) {
    const maxlen = Math.max(...code.map(e => e.split('\x00%')[0].replaceAll(/\0(.)/g, '').length))

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
