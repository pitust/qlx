import { ice } from '../common'
import {
    comment,
    finalizeColors,
    fmt,
    glob,
    highlight,
    label,
    nostyle,
    ri,
    selector,
} from '../highlight'
import { Program, name } from '../targen'

export class MindustryProgram extends Program {
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
        this.currentline = `${comment}# ${pos.padEnd(26)} | ${highlight(source)}`
    }

    move(tgd: name, value: name): void {
        if (this.lookup(tgd) != this.lookup(value))
            this.emit(`    ${fmt.assign}set${nostyle} ${this.lookup(tgd)} ${this.lookup(value)}`)
    }
    binop(tgd: name, left: name, op: 'add' | 'lt' | 'eq', right: name): void {
        const binopLookup = {
            add: 'add',
            sub: 'sub',
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
        const sym = Symbol(`${n}`) as name
        this.nameLookup.set(sym, `${ri}${JSON.stringify(n)}${nostyle}`)
        return sym
    }
    name(n: string): name {
        const sym = Symbol(`${n}`) as name
        this.nameLookup.set(sym, `${glob}g${n}${nostyle}`)
        return sym
    }
    loc(n: string): name {
        const sym = Symbol(`${n}`) as name
        this.nameLookup.set(sym, `${glob}l${n}${nostyle}`)
        return sym
    }
    name2(n: string): name {
        const sym = Symbol(`${n}`) as name
        this.nameLookup.set(sym, `${glob}t${n}${nostyle}`)
        return sym
    }
    call(_ret0hint: name, name: string, args: name[]): name {
        for (let i = 0; i < args.length; i++) {
            this.move(this.name2(`a${i}`), args[i])
        }
        this.emit(
            `    ${fmt.cflow}op ${selector}add ${ri}lr.${name} ${selector}@counter ${ri}2${nostyle}`
        )
        this.emit(`    ${fmt.cflow}jump ${label}${name} ${selector}always${nostyle}`)
        return this.name2('ret0')
    }
    retv(name: string): void {
        this.emit(`    ${fmt.cflow}set ${selector}@counter ${ri}lr.${name}${nostyle}`)
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
    platformHookPrintFlush(p: name): void {
        this.emit(`    ${fmt.rawio}printflush${nostyle} ${this.lookup(p)}`)
    }

    generate(): string {
        return finalizeColors(this._code)
    }
}
