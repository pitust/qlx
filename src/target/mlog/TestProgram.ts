import { options } from '../../middlegen'
import { allocateColors } from '../colors'
import { ice } from '../common'
import {
    add,
    sub,
    imm,
    ref,
    vreg,
    insn,
    move,
    reg,
    dataref,
    freeze,
    syscall,
    completeGraphColor,
    phyreg,
    label,
    endbr,
    poke8,
    condbr,
    br,
    syscall2,
    __phyreg,
} from '../crayons'
import { finalizeColors } from '../highlight'
import { Program, name } from '../targen'

export class TestNativeProgram extends Program {
    varNameToReg = new Map<string, number>()
    regToProgramName = new Map<number, name>()
    vreg: number = 0
    programNameToRef = new Map<name, ref>()
    opstream: [insn, ref[]][] = []
    labelidx: number = 0
    labelmap = new Map<string, number>()
    strings: string[] = []

    emit(insn: insn, ...args: (ref | name)[]) {
        if (args[0] == args[1] && insn == move) return
        this.opstream.push([
            insn,
            args.map(e => this.programNameToRef.get(e as name) ?? (e as ref)),
        ])
    }
    obtainVirtualRegister() {
        return this.vreg++
    }
    lookupNameForReg(r: number) {
        if (!this.regToProgramName.has(r)) {
            this.regToProgramName.set(r, Symbol(`v${r}`) as name)
            this.programNameToRef.set(this.regToProgramName.get(r), vreg(r))
        }
        return this.regToProgramName.get(r)
    }

    move(tgd: name, value: name): void {
        this.emit(move, tgd, value)
    }
    binop(tgd: name, left: name, op: 'sub' | 'add' | 'lt' | 'eq', right: name): void {
        if (op == 'add') {
            this.emit(move, tgd, left)
            this.emit(add, tgd, right)
            return
        }
        if (op == 'sub') {
            this.emit(move, tgd, left)
            this.emit(sub, tgd, right)
            return
        }
        throw new Error('Method not implemented.')
    }
    unop(tgd: name, op: 'invert', arg: name): void {
        throw new Error('Method not implemented.')
    }
    imm(n: number): name {
        const nam = Symbol(`${n}`) as name
        this.programNameToRef.set(nam, imm(n))
        return nam
    }
    stri(s: string): name {
        const nam = Symbol(s) as name
        this.programNameToRef.set(nam, dataref(this.strings.push(s) - 1))
        return nam
    }
    name(n: string): name {
        n = 'g' + n
        if (!this.varNameToReg.has(n)) {
            this.varNameToReg.set(n, this.obtainVirtualRegister())
        }
        const r = this.varNameToReg.get(n)
        return this.lookupNameForReg(r)
    }
    loc(n: string): name {
        throw new Error('Method not implemented.')
    }
    name2(n: string): name {
        n = 'v' + n
        if (!this.varNameToReg.has(n)) {
            const r = this.obtainVirtualRegister()
            this.varNameToReg.set(n, r)
            if (n.startsWith('va')) this.emit(freeze, vreg(r), __phyreg(+n.slice(2) + 1))
            if (n.startsWith('vret0')) this.emit(freeze, vreg(r), phyreg('rax'))
        }
        const r = this.varNameToReg.get(n)
        return this.lookupNameForReg(r)
    }
    label(tgd: string): void {
        this.labelmap.set(tgd, this.labelidx)
        console.log('l', tgd)
        this.emit(endbr, label(this.labelidx++))
    }
    br(tgd: string): void {
        if (!this.labelmap.has(tgd)) this.labelmap.set(tgd, this.labelidx++)
        this.emit(br, label(this.labelmap.get(tgd)))
    }
    bz(tgd: string, cond: name): void {
        throw new Error('Method not implemented.')
    }
    bnz(tgd: string, ncond: name): void {
        throw new Error('Method not implemented.')
    }
    generate(): string {
        return finalizeColors(completeGraphColor(this.opstream, this.strings).filter(e => !e.includes(';')))
    }
    line(pos: string, source: string): void {}
    platformHookEnd(): void {
        const sysno_reg = this.obtainVirtualRegister()
        const ecode_reg = this.obtainVirtualRegister()
        this.emit(move, vreg(sysno_reg), imm(60))
        this.emit(move, vreg(ecode_reg), imm(0))
        this.emit(freeze, vreg(sysno_reg), phyreg('rax'))
        this.emit(freeze, vreg(ecode_reg), phyreg('rdi'))
        this.emit(syscall, vreg(sysno_reg), vreg(sysno_reg), vreg(ecode_reg))
    }
    platformHookPrintValue(p: name): void {
        throw new Error('Method not implemented.')
    }
    platformHookPrintString(p: string): void {
        throw new Error('Method not implemented.')
    }
    retv(name: string): void {
        throw new Error('Method not implemented.')
    }
    call(name: string): void {
        if (name.startsWith('__intrin::')) {
            const iname = name.slice(10)

            if (iname == '__syscall1_vii') {
                // 'a0 contains the sysno, 'a1 contains the value
                const sysno_reg = this.obtainVirtualRegister()
                const arg_reg = this.obtainVirtualRegister()
                
                // according to the pitust "madeupabi", a0 is in rax and so we can keep it there

                this.emit(move, vreg(arg_reg), this.name2('a1')) // rdi <- rbx
                this.emit(freeze, vreg(arg_reg), phyreg('rdi'))
                this.emit(syscall, this.name2('a0'), this.name2('a0'), vreg(arg_reg))
                return
            }
            if (iname == '__syscall3_viiii') {
                // 'a0 contains the sysno, 'a1 contains the value
                const sysno_reg = this.obtainVirtualRegister()
                const a0 = this.obtainVirtualRegister()
                const a1 = this.obtainVirtualRegister()
                const a2 = this.obtainVirtualRegister()
                const t1 = this.obtainVirtualRegister()
                const a3 = this.obtainVirtualRegister()
                
                // 
                // a0 (rbx) -> rax
                // a3 (rdi) -> t1
                // a1 (rcx) -> rdi
                // a2 (rdx) -> rsi
                // t1       -> rdx

                this.emit(freeze, vreg(a0), phyreg('rax'))
                this.emit(freeze, vreg(a1), phyreg('rdi'))
                this.emit(freeze, vreg(a2), phyreg('rsi'))
                this.emit(freeze, vreg(a3), phyreg('rdx'))

                this.emit(move, vreg(a0), this.name2('a0'))
                this.emit(move, vreg(t1), this.name2('a3'))
                this.emit(move, vreg(a1), this.name2('a1'))
                this.emit(move, vreg(a2), this.name2('a2'))
                this.emit(move, vreg(a3), vreg(t1))

                this.emit(syscall2, vreg(a0), vreg(a0), vreg(a1), vreg(a2), vreg(a3))
                return
            }
            if (iname == '__stroff_ssi') {
                this.emit(move, this.name2('ret0'), this.name2('a0'))
                this.emit(add, this.name2('ret0'), this.name2('a1'))
                return
            }
            if (iname == '__poke8_vsi') {
                this.emit(poke8, this.name2('a0'), this.name2('a1'))
                return
            }
            if (iname == '__ichg_is') {
                this.emit(move, this.name2('ret0'), this.name2('a0'))
                return
            }
            if (iname == '__exit_vi') {
                const sysno_reg = this.obtainVirtualRegister()
                const ecode_reg = this.obtainVirtualRegister()
                this.emit(move, vreg(sysno_reg), imm(60))
                this.emit(move, vreg(ecode_reg), this.name2('a0'))
                this.emit(freeze, vreg(sysno_reg), phyreg('rax'))
                this.emit(freeze, vreg(ecode_reg), phyreg('rdi'))
                this.emit(syscall, vreg(sysno_reg), vreg(sysno_reg), vreg(ecode_reg))
                return
            }
        }
        throw new Error(`cannot call ${name} (yet)`)
    }
}
