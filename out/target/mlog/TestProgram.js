"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }























var _crayons = require('../crayons');
var _highlight = require('../highlight');
var _targen = require('../targen');

 class TestNativeProgram extends _targen.Program {constructor(...args2) { super(...args2); TestNativeProgram.prototype.__init.call(this);TestNativeProgram.prototype.__init2.call(this);TestNativeProgram.prototype.__init3.call(this);TestNativeProgram.prototype.__init4.call(this);TestNativeProgram.prototype.__init5.call(this);TestNativeProgram.prototype.__init6.call(this);TestNativeProgram.prototype.__init7.call(this);TestNativeProgram.prototype.__init8.call(this); }
    __init() {this.varNameToReg = new Map()}
    __init2() {this.regToProgramName = new Map()}
    __init3() {this.vreg = 0}
    __init4() {this.programNameToRef = new Map()}
    __init5() {this.opstream = []}
    __init6() {this.labelidx = 0}
    __init7() {this.labelmap = new Map()}
    __init8() {this.strings = []}

    emit(insn, ...args) {
        if (args[0] == args[1] && insn == _crayons.move) return
        this.opstream.push([
            insn,
            args.map(e => _nullishCoalesce(this.programNameToRef.get(e ), () => ( (e )))),
        ])
    }
    obtainVirtualRegister() {
        return this.vreg++
    }
    lookupNameForReg(r) {
        if (!this.regToProgramName.has(r)) {
            this.regToProgramName.set(r, Symbol(`v${r}`) )
            this.programNameToRef.set(this.regToProgramName.get(r), _crayons.vreg.call(void 0, r))
        }
        return this.regToProgramName.get(r)
    }

    move(tgd, value) {
        this.emit(_crayons.move, tgd, value)
    }
    binop(tgd, left, op, right) {
        if (op == 'add') {
            this.emit(_crayons.move, tgd, left)
            this.emit(_crayons.add, tgd, right)
            return
        }
        if (op == 'sub') {
            this.emit(_crayons.move, tgd, left)
            this.emit(_crayons.sub, tgd, right)
            return
        }
        throw new Error('Method not implemented.')
    }
    unop(tgd, op, arg) {
        throw new Error('Method not implemented.')
    }
    imm(n) {
        const nam = Symbol(`${n}`) 
        this.programNameToRef.set(nam, _crayons.imm.call(void 0, n))
        return nam
    }
    stri(s) {
        const nam = Symbol(s) 
        this.programNameToRef.set(nam, _crayons.dataref.call(void 0, this.strings.push(s) - 1))
        return nam
    }
    name(n) {
        n = 'g' + n
        if (!this.varNameToReg.has(n)) {
            this.varNameToReg.set(n, this.obtainVirtualRegister())
        }
        const r = this.varNameToReg.get(n)
        return this.lookupNameForReg(r)
    }
    loc(n) {
        throw new Error('Method not implemented.')
    }
    name2(n) {
        n = 'v' + n
        if (!this.varNameToReg.has(n)) {
            const r = this.obtainVirtualRegister()
            this.varNameToReg.set(n, r)
            if (n.startsWith('va')) this.emit(_crayons.freeze, _crayons.vreg.call(void 0, r), _crayons.__phyreg.call(void 0, +n.slice(2) + 1))
            if (n.startsWith('vret0')) this.emit(_crayons.freeze, _crayons.vreg.call(void 0, r), _crayons.phyreg.call(void 0, 'rax'))
        }
        const r = this.varNameToReg.get(n)
        return this.lookupNameForReg(r)
    }
    label(tgd) {
        this.labelmap.set(tgd, this.labelidx)
        console.log('l', tgd)
        this.emit(_crayons.endbr, _crayons.label.call(void 0, this.labelidx++))
    }
    br(tgd) {
        if (!this.labelmap.has(tgd)) this.labelmap.set(tgd, this.labelidx++)
        this.emit(_crayons.br, _crayons.label.call(void 0, this.labelmap.get(tgd)))
    }
    bz(tgd, cond) {
        throw new Error('Method not implemented.')
    }
    bnz(tgd, ncond) {
        throw new Error('Method not implemented.')
    }
    generate() {
        return _highlight.finalizeColors.call(void 0, _crayons.completeGraphColor.call(void 0, this.opstream, this.strings).filter(e => !e.includes(';')))
    }
    line(pos, source) {}
    platformHookEnd() {
        const sysno_reg = this.obtainVirtualRegister()
        const ecode_reg = this.obtainVirtualRegister()
        this.emit(_crayons.move, _crayons.vreg.call(void 0, sysno_reg), _crayons.imm.call(void 0, 60))
        this.emit(_crayons.move, _crayons.vreg.call(void 0, ecode_reg), _crayons.imm.call(void 0, 0))
        this.emit(_crayons.freeze, _crayons.vreg.call(void 0, sysno_reg), _crayons.phyreg.call(void 0, 'rax'))
        this.emit(_crayons.freeze, _crayons.vreg.call(void 0, ecode_reg), _crayons.phyreg.call(void 0, 'rdi'))
        this.emit(_crayons.syscall, _crayons.vreg.call(void 0, sysno_reg), _crayons.vreg.call(void 0, sysno_reg), _crayons.vreg.call(void 0, ecode_reg))
    }
    platformHookPrintValue(p) {
        throw new Error('Method not implemented.')
    }
    platformHookPrintString(p) {
        throw new Error('Method not implemented.')
    }
    retv(name) {
        throw new Error('Method not implemented.')
    }
    call(name) {
        if (name.startsWith('__intrin::')) {
            const iname = name.slice(10)

            if (iname == '__syscall1_vii') {
                // 'a0 contains the sysno, 'a1 contains the value
                const sysno_reg = this.obtainVirtualRegister()
                const arg_reg = this.obtainVirtualRegister()
                
                // according to the pitust "madeupabi", a0 is in rax and so we can keep it there

                this.emit(_crayons.move, _crayons.vreg.call(void 0, arg_reg), this.name2('a1')) // rdi <- rbx
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, arg_reg), _crayons.phyreg.call(void 0, 'rdi'))
                this.emit(_crayons.syscall, this.name2('a0'), this.name2('a0'), _crayons.vreg.call(void 0, arg_reg))
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

                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, a0), _crayons.phyreg.call(void 0, 'rax'))
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, a1), _crayons.phyreg.call(void 0, 'rdi'))
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, a2), _crayons.phyreg.call(void 0, 'rsi'))
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, a3), _crayons.phyreg.call(void 0, 'rdx'))

                this.emit(_crayons.move, _crayons.vreg.call(void 0, a0), this.name2('a0'))
                this.emit(_crayons.move, _crayons.vreg.call(void 0, t1), this.name2('a3'))
                this.emit(_crayons.move, _crayons.vreg.call(void 0, a1), this.name2('a1'))
                this.emit(_crayons.move, _crayons.vreg.call(void 0, a2), this.name2('a2'))
                this.emit(_crayons.move, _crayons.vreg.call(void 0, a3), _crayons.vreg.call(void 0, t1))

                this.emit(_crayons.syscall2, _crayons.vreg.call(void 0, a0), _crayons.vreg.call(void 0, a0), _crayons.vreg.call(void 0, a1), _crayons.vreg.call(void 0, a2), _crayons.vreg.call(void 0, a3))
                return
            }
            if (iname == '__stroff_ssi') {
                this.emit(_crayons.move, this.name2('ret0'), this.name2('a0'))
                this.emit(_crayons.add, this.name2('ret0'), this.name2('a1'))
                return
            }
            if (iname == '__poke8_vsi') {
                this.emit(_crayons.poke8, this.name2('a0'), this.name2('a1'))
                return
            }
            if (iname == '__ichg_is') {
                this.emit(_crayons.move, this.name2('ret0'), this.name2('a0'))
                return
            }
            if (iname == '__exit_vi') {
                const sysno_reg = this.obtainVirtualRegister()
                const ecode_reg = this.obtainVirtualRegister()
                this.emit(_crayons.move, _crayons.vreg.call(void 0, sysno_reg), _crayons.imm.call(void 0, 60))
                this.emit(_crayons.move, _crayons.vreg.call(void 0, ecode_reg), this.name2('a0'))
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, sysno_reg), _crayons.phyreg.call(void 0, 'rax'))
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, ecode_reg), _crayons.phyreg.call(void 0, 'rdi'))
                this.emit(_crayons.syscall, _crayons.vreg.call(void 0, sysno_reg), _crayons.vreg.call(void 0, sysno_reg), _crayons.vreg.call(void 0, ecode_reg))
                return
            }
        }
        throw new Error(`cannot call ${name} (yet)`)
    }
} exports.TestNativeProgram = TestNativeProgram;
