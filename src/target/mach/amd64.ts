import { ice } from '../common'
import { Global, Local, Register, TargetMachine } from '../native'

const rax = Symbol('rax') as Register
const rbx = Symbol('rbx') as Register
const rcx = Symbol('rcx') as Register
const rdx = Symbol('rdx') as Register
const rdi = Symbol('rdi') as Register
const rsi = Symbol('rsi') as Register
const rbp = Symbol('rbp') as Register

let t1used = false
let t2used = false

export class Amd64Machine extends TargetMachine {
    _code: string[] = []
    finalize(): string[] {
        return this._code
    }
    rname(r: Register): string {
        if (r == rax) return 'rax'
        if (r == rbx) return 'rbx'
        if (r == rcx) return 'rcx'
        if (r == rdx) return 'rdx'
        if (r == rdi) return 'rdi'
        if (r == rsi) return 'rsi'
        if (r == rbp) return 'rbp'
        ice('unknown register!')
    }
    isTwoAddress(): boolean {
        return true
    }
    name(): string {
        return 'x86_64'
    }
    move(dst: Register, src: Register): void {
        this._code.push(`    mov ${this.rname(dst)}, ${this.rname(src)}`)
    }
    movei(dst: Register, src: number): void {
        this._code.push(`    mov ${this.rname(dst)}, ${src}`)
    }
    acquireTemp(): Register {
        if (!t1used) {
            t1used = true
            return rsi
        }
        if (!t2used) {
            t2used = true
            return rbp
        }
        ice('cannot allocate temp!')
    }
    releaseTemp(r: Register): void {
        if (r == rsi) t1used = false
        if (r == rbp) t2used = false
    }
    xor(dst: Register, left: Register, right: Register): void {
        if (dst != left) ice('on x86, dst == left for math!')
        this._code.push(`    xor ${this.rname(dst)}, ${this.rname(right)}`)
    }
    stackRead(dst: Register, src: number): void {
        throw new Error('Method not implemented.')
    }
    stackWrite(dst: number, src: Register): void {
        throw new Error('Method not implemented.')
    }
    stackFrameExtend(count: number): void {
        throw new Error('Method not implemented.')
    }
    registers(): Register[] {
        return [rax, rbx, rcx, rdx, rdi]
    }
    label(name: string): void {
        this._code.push(`${name}:`)
    }
    br(name: string): void {
        this._code.push(`    jmp ${name}`)
    }
    call(name: string): void {
        throw new Error('Method not implemented.')
    }
    condbr(cond: Register, name: string): void {
        throw new Error('Method not implemented.')
    }
    ncondbr(ncond: Register, name: string): void {
        throw new Error('Method not implemented.')
    }
    defineGlobal(name: string): Global {
        throw new Error('Method not implemented.')
    }
    defineLocal(name: string): Local {
        throw new Error('Method not implemented.')
    }
    ldglob(dst: Register, src: Global): void {
        throw new Error('Method not implemented.')
    }
    stglob(dst: Global, src: Register): void {
        throw new Error('Method not implemented.')
    }
    ldloc(dst: Register, src: Local): void {
        throw new Error('Method not implemented.')
    }
    stloc(dst: Local, src: Register): void {
        throw new Error('Method not implemented.')
    }
    add(dst: Register, left: Register, right: Register): void {
        if (dst != left) ice('on x86, dst == left for math!')
        this._code.push(`    add ${this.rname(dst)}, ${this.rname(right)}`)
    }
    sub(dst: Register, left: Register, right: Register): void {
        throw new Error('Method not implemented.')
    }
    eq(dst: Register, left: Register, right: Register): void {
        throw new Error('Method not implemented.')
    }
    neq(dst: Register, left: Register, right: Register): void {
        throw new Error('Method not implemented.')
    }
    lt(dst: Register, left: Register, right: Register): void {
        throw new Error('Method not implemented.')
    }
    gt(dst: Register, left: Register, right: Register): void {
        throw new Error('Method not implemented.')
    }
    neg(dst: Register, src: Register): void {
        throw new Error('Method not implemented.')
    }
    targetop1(op: string, src1: Register): void {
        throw new Error('Method not implemented.')
    }
    targetop2(op: string, src1: Register, src2: Register): void {
        if (op == 'syscall') {
            this._code.push(`    push rax`)
            this._code.push(`    push rcx`)
            this._code.push(`    push rdi`)
            if (src1 == rax && src2 == rdi) {
                this._code.push(`    xchg rax, rdi`)
            } else if (src2 == rax) {
                this._code.push(`    mov rdi, ${this.rname(src2)}`)
                this._code.push(`    mov rax, ${this.rname(src1)}`)
            } else {
                this._code.push(`    mov rax, ${this.rname(src1)}`)
                this._code.push(`    mov rdi, ${this.rname(src2)}`)
            }
            this._code.push(`    syscall`)
            this._code.push(`    pop rdi`)
            this._code.push(`    pop rcx`)
            this._code.push(`    pop rax`)
            return
        }
        ice('todo top2: ' + op)
    }
    targetop3(dst: Register, op: string, src: Register): void {
        throw new Error('Method not implemented.')
    }
    targetop4(dst: Register, op: string, src: string): void {
        throw new Error('Method not implemented.')
    }
    read8(dst: Register, addr: Register): void {
        throw new Error('Method not implemented.')
    }
    read16(dst: Register, addr: Register): void {
        throw new Error('Method not implemented.')
    }
    read32(dst: Register, addr: Register): void {
        throw new Error('Method not implemented.')
    }
    read64(dst: Register, addr: Register): void {
        throw new Error('Method not implemented.')
    }
}
