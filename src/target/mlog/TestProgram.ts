import { options } from '../../middlegen'
import { allocateColors } from '../colors'
import { ice } from '../common'
import {
    add,
    imm,
    ref,
    vreg,
    insn,
    move,
    reg,
    freeze,
    syscall,
    completeGraphColor,
    phyreg,
    label,
    endbr,
} from '../crayons'
import { Program, name } from '../targen'

export class TestNativeProgram extends Program {
    varNameToReg = new Map<string, number>()
    regToProgramName = new Map<number, name>()
    vreg: number = 0
    programNameToRef = new Map<name, ref>()
    opstream: [insn, ref[]][] = []
    labelidx: number = 0
    labelmap = new Map<string, number>()

    emit(insn: insn, ...args: (ref | name)[]) {
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
    binop(tgd: name, left: name, op: 'add' | 'lt' | 'eq', right: name): void {
        if (op == 'add') {
            this.emit(move, tgd, left)
            this.emit(add, tgd, right)
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
    stri(n: string): name {
        throw new Error('Method not implemented.')
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
            this.varNameToReg.set(n, this.obtainVirtualRegister())
        }
        const r = this.varNameToReg.get(n)
        return this.lookupNameForReg(r)
    }
    label(tgd: string): void {
        this.labelmap.set(tgd, this.labelidx)
        this.emit(endbr, label(this.labelidx++))
    }
    br(tgd: string): void {
        throw new Error('Method not implemented.')
    }
    bz(tgd: string, cond: name): void {
        throw new Error('Method not implemented.')
    }
    bnz(tgd: string, ncond: name): void {
        throw new Error('Method not implemented.')
    }
    generate(): string {
        return completeGraphColor(this.opstream).filter(e => !e.startsWith('    ;')).join('\n')
    }
    line(pos: string, source: string): void {
        
    }
    platformHookEnd(): void {
        const sysno_reg = this.obtainVirtualRegister()
        const ecode_reg = this.obtainVirtualRegister()
        this.emit(move, vreg(sysno_reg), imm(60))
        this.emit(move, vreg(ecode_reg), imm(0))
        this.emit(freeze, vreg(sysno_reg), /*rax*/ phyreg(0))
        this.emit(freeze, vreg(ecode_reg), /*rdi*/ phyreg(5))
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
        throw new Error('Method not implemented.')
    }
}
