"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }
























var _crayons = require('../crayons');
var _highlight = require('../highlight');
var _isel = require('../isel');
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
        if (args.includes(undefined)) throw new Error('undefined arg?')
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
        return _highlight.finalizeColors.call(void 0, 
            _crayons.completeGraphColor.call(void 0, this.opstream, this.strings).filter(e => !e.includes(';'))
        )
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
    call(ret0hint, name, args) {
        const argrefs = []
        const mode = []
        let ret0 = this.name2('ret0')
        let isUnpinnedArgumentIntrinsic = false,
            firstArgEqualsReturn = false,
            refargCapable = false
        if (name == '__intrin::__stroff_ssi') {
            isUnpinnedArgumentIntrinsic = true
            firstArgEqualsReturn = true
        }
        if (name == '__intrin::__ichg_is') {
            isUnpinnedArgumentIntrinsic = true
            firstArgEqualsReturn = true
        }
        if (name == '__intrin::__exit_vi') isUnpinnedArgumentIntrinsic = true
        if (name == '__intrin::__poke8_vsi') {
            isUnpinnedArgumentIntrinsic = true
            refargCapable = true
        }
        for (let i = 0; i < args.length; i++) {
            if (this.programNameToRef.get(args[i]).kind != _isel.rk_reg) {
                argrefs.push(args[i])
                mode.push(true)
            } else {
                let aname = this.name2(`a${i}`)
                if (isUnpinnedArgumentIntrinsic) aname = this.name2(`unpinned-a${i}`)
                if (refargCapable) aname = args[i]
                if (firstArgEqualsReturn && ret0hint && i == 0) aname = ret0hint
                this.move(aname, args[i])
                argrefs.push(aname)
                mode.push(false)
            }
        }
        if (name.startsWith('__intrin::')) {
            const iname = name.slice(10)

            if (iname == '__syscall1_vii') {
                // 'a0 contains the sysno, 'a1 contains the value
                const sysno_reg = this.obtainVirtualRegister()
                const arg_reg = this.obtainVirtualRegister()

                this.emit(_crayons.move, _crayons.vreg.call(void 0, sysno_reg), argrefs[1]) // rax <- rbx
                this.emit(_crayons.move, _crayons.vreg.call(void 0, arg_reg), argrefs[1]) // rdi <- rcx
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, arg_reg), _crayons.phyreg.call(void 0, 'rdi'))
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, sysno_reg), _crayons.phyreg.call(void 0, 'rax'))
                this.emit(_crayons.syscall, this.name2('ret0'), _crayons.vreg.call(void 0, sysno_reg), _crayons.vreg.call(void 0, arg_reg))
                return ret0
            }
            if (iname == '__syscall3_viiii') {
                // 'a0 contains the sysno, 'a1 contains the value
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

                this.emit(_crayons.move, _crayons.vreg.call(void 0, a0), argrefs[0])
                if (!mode[3]) this.emit(_crayons.move, _crayons.vreg.call(void 0, t1), argrefs[3])
                this.emit(_crayons.move, _crayons.vreg.call(void 0, a1), argrefs[1])
                this.emit(_crayons.move, _crayons.vreg.call(void 0, a2), argrefs[2])
                if (!mode[3]) this.emit(_crayons.move, _crayons.vreg.call(void 0, a3), _crayons.vreg.call(void 0, t1))
                if (mode[3]) this.emit(_crayons.move, _crayons.vreg.call(void 0, a3), argrefs[3])

                this.emit(_crayons.syscall2, _crayons.vreg.call(void 0, a0), _crayons.vreg.call(void 0, a0), _crayons.vreg.call(void 0, a1), _crayons.vreg.call(void 0, a2), _crayons.vreg.call(void 0, a3))
                this.emit(_crayons.move, ret0, _crayons.vreg.call(void 0, a0))
                return ret0
            }
            if (iname == '__stroff_ssi') {
                if (mode[0]) {
                    if (ret0hint) ret0 = ret0hint
                    this.emit(_crayons.move, ret0, argrefs[0])
                    this.emit(_crayons.add, ret0, argrefs[1])
                } else {
                    ret0 = argrefs[0]
                    this.emit(_crayons.add, ret0, argrefs[1])
                }
                return ret0
            }
            if (iname == '__poke8_vsi') {
                this.emit(_crayons.poke8, argrefs[0], argrefs[1])
                return ret0
            }
            if (iname == '__ichg_is') {
                if (ret0hint) ret0 = ret0hint
                this.emit(_crayons.move, ret0, argrefs[0])
                return ret0
            }
            if (iname == '__exit_vi') {
                const sysno_reg = this.obtainVirtualRegister()
                const ecode_reg = this.obtainVirtualRegister()
                this.emit(_crayons.move, _crayons.vreg.call(void 0, ecode_reg), argrefs[0])
                this.emit(_crayons.move, _crayons.vreg.call(void 0, sysno_reg), _crayons.imm.call(void 0, 60))
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, sysno_reg), _crayons.phyreg.call(void 0, 'rax'))
                this.emit(_crayons.freeze, _crayons.vreg.call(void 0, ecode_reg), _crayons.phyreg.call(void 0, 'rdi'))
                this.emit(_crayons.syscall, _crayons.vreg.call(void 0, sysno_reg), _crayons.vreg.call(void 0, sysno_reg), _crayons.vreg.call(void 0, ecode_reg))
                return ret0
            }
        }
        throw new Error(`cannot call ${name} (yet)`)
    }
} exports.TestNativeProgram = TestNativeProgram;
