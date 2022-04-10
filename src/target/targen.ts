export type name = symbol & { tag: 'name' }
export abstract class Program {
    abstract move(tgd: name, value: name): void
    abstract binop(tgd: name, left: name, op: 'sub' | 'add' | 'lt' | 'eq' | 'sub', right: name): void
    abstract unop(tgd: name, op: 'invert', arg: name): void
    abstract imm(n: number): name
    abstract stri(n: string): name
    abstract name(n: string): name
    abstract loc(n: string): name
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
    abstract platformHookPrintFlush(p: name): void
    abstract platformHookPrintString(p: string): void

    // functions
    abstract retv(name: string): void

    // functions
    abstract call(ret0hint: name | null, name: string, args: name[]): name
}
