// Target abstract machine

export type Global = symbol & { _kind: '__global' }
export type Local = symbol & { _kind: '__local' }
export type Register = symbol & { _kind: '__register' }
export abstract class TargetMachine {
    // general info
    abstract registers(): Register[]
    abstract isTwoAddress(): boolean
    abstract name(): string
    abstract finalize(): string[]

    // labels & control flow
    abstract label(name: string): void
    abstract br(name: string): void
    abstract call(name: string): void
    abstract condbr(cond: Register, name: string): void
    abstract ncondbr(ncond: Register, name: string): void

    // variables
    abstract defineGlobal(name: string): Global
    abstract defineLocal(name: string): Local

    // variable ops
    abstract ldglob(dst: Register, src: Global): void
    abstract stglob(dst: Global, src: Register): void
    abstract ldloc(dst: Register, src: Local): void
    abstract stloc(dst: Local, src: Register): void

    // misc
    abstract move(dst: Register, src: Register): void
    abstract movei(dst: Register, src: number): void
    abstract acquireTemp(): Register
    abstract releaseTemp(r: Register): void

    // operations
    abstract xor(dst: Register, left: Register, right: Register): void
    abstract add(dst: Register, left: Register, right: Register): void
    abstract sub(dst: Register, left: Register, right: Register): void
    abstract eq(dst: Register, left: Register, right: Register): void
    abstract neq(dst: Register, left: Register, right: Register): void
    abstract lt(dst: Register, left: Register, right: Register): void
    abstract gt(dst: Register, left: Register, right: Register): void
    abstract neg(dst: Register, src: Register): void

    // target shit
    abstract targetop1(op: string, src1: Register): void
    abstract targetop2(op: string, src1: Register, src2: Register): void
    abstract targetop3(dst: Register, op: string, src: Register): void
    abstract targetop4(dst: Register, op: string, src: string): void

    // memory shit
    abstract read8(dst: Register, addr: Register): void
    abstract read16(dst: Register, addr: Register): void
    abstract read32(dst: Register, addr: Register): void
    abstract read64(dst: Register, addr: Register): void

    // stack frame
    abstract stackRead(dst: Register, src: number): void
    abstract stackWrite(dst: number, src: Register): void
    abstract stackFrameExtend(count: number): void
}

export const targettingRegistry = new Map<string, () => TargetMachine>()
export function getTargetForName(name: string) {
    if (!targettingRegistry.has(name)) {
        console.error('ERROR: no such target: %s', name)
        process.exit(1)
    }
    return targettingRegistry.get(name)()
}
