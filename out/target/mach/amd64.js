"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _common = require('../common');
var _native = require('../native');

const rax = Symbol('rax') 
const rbx = Symbol('rbx') 
const rcx = Symbol('rcx') 
const rdx = Symbol('rdx') 
const rdi = Symbol('rdi') 
const rsi = Symbol('rsi') 
const rbp = Symbol('rbp') 

let t1used = false
let t2used = false

 class Amd64Machine extends _native.TargetMachine {constructor(...args) { super(...args); Amd64Machine.prototype.__init.call(this); }
    __init() {this._code = []}
    finalize() {
        return this._code
    }
    rname(r) {
        if (r == rax) return 'rax'
        if (r == rbx) return 'rbx'
        if (r == rcx) return 'rcx'
        if (r == rdx) return 'rdx'
        if (r == rdi) return 'rdi'
        if (r == rsi) return 'rsi'
        if (r == rbp) return 'rbp'
        _common.ice.call(void 0, 'unknown register!')
    }
    isTwoAddress() {
        return true
    }
    name() {
        return 'x86_64'
    }
    move(dst, src) {
        this._code.push(`    mov ${this.rname(dst)}, ${this.rname(src)}`)
    }
    movei(dst, src) {
        this._code.push(`    mov ${this.rname(dst)}, ${src}`)
    }
    acquireTemp() {
        if (!t1used) {
            t1used = true
            return rsi
        }
        if (!t2used) {
            t2used = true
            return rbp
        }
        _common.ice.call(void 0, 'cannot allocate temp!')
    }
    releaseTemp(r) {
        if (r == rsi) t1used = false
        if (r == rbp) t2used = false
    }
    xor(dst, left, right) {
        if (dst != left) _common.ice.call(void 0, 'on x86, dst == left for math!')
        this._code.push(`    xor ${this.rname(dst)}, ${this.rname(right)}`)
    }
    stackRead(dst, src) {
        throw new Error('Method not implemented.')
    }
    stackWrite(dst, src) {
        throw new Error('Method not implemented.')
    }
    stackFrameExtend(count) {
        throw new Error('Method not implemented.')
    }
    registers() {
        return [rax, rbx, rcx, rdx, rdi]
    }
    label(name) {
        this._code.push(`${name}:`)
    }
    br(name) {
        this._code.push(`    jmp ${name}`)
    }
    call(name) {
        throw new Error('Method not implemented.')
    }
    condbr(cond, name) {
        throw new Error('Method not implemented.')
    }
    ncondbr(ncond, name) {
        throw new Error('Method not implemented.')
    }
    defineGlobal(name) {
        throw new Error('Method not implemented.')
    }
    defineLocal(name) {
        throw new Error('Method not implemented.')
    }
    ldglob(dst, src) {
        throw new Error('Method not implemented.')
    }
    stglob(dst, src) {
        throw new Error('Method not implemented.')
    }
    ldloc(dst, src) {
        throw new Error('Method not implemented.')
    }
    stloc(dst, src) {
        throw new Error('Method not implemented.')
    }
    add(dst, left, right) {
        if (dst != left) _common.ice.call(void 0, 'on x86, dst == left for math!')
        this._code.push(`    add ${this.rname(dst)}, ${this.rname(right)}`)
    }
    sub(dst, left, right) {
        throw new Error('Method not implemented.')
    }
    eq(dst, left, right) {
        throw new Error('Method not implemented.')
    }
    neq(dst, left, right) {
        throw new Error('Method not implemented.')
    }
    lt(dst, left, right) {
        throw new Error('Method not implemented.')
    }
    gt(dst, left, right) {
        throw new Error('Method not implemented.')
    }
    neg(dst, src) {
        throw new Error('Method not implemented.')
    }
    targetop1(op, src1) {
        throw new Error('Method not implemented.')
    }
    targetop2(op, src1, src2) {
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
        _common.ice.call(void 0, 'todo top2: ' + op)
    }
    targetop3(dst, op, src) {
        throw new Error('Method not implemented.')
    }
    targetop4(dst, op, src) {
        throw new Error('Method not implemented.')
    }
    read8(dst, addr) {
        throw new Error('Method not implemented.')
    }
    read16(dst, addr) {
        throw new Error('Method not implemented.')
    }
    read32(dst, addr) {
        throw new Error('Method not implemented.')
    }
    read64(dst, addr) {
        throw new Error('Method not implemented.')
    }
} exports.Amd64Machine = Amd64Machine;
