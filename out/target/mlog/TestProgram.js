"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }
















var _crayons = require('../crayons');
var _highlight = require('../highlight');
var _targen = require('../targen');

 class TestNativeProgram extends _targen.Program {constructor(...args2) { super(...args2); TestNativeProgram.prototype.__init.call(this);TestNativeProgram.prototype.__init2.call(this);TestNativeProgram.prototype.__init3.call(this);TestNativeProgram.prototype.__init4.call(this);TestNativeProgram.prototype.__init5.call(this);TestNativeProgram.prototype.__init6.call(this);TestNativeProgram.prototype.__init7.call(this); }
    __init() {this.varNameToReg = new Map()}
    __init2() {this.regToProgramName = new Map()}
    __init3() {this.vreg = 0}
    __init4() {this.programNameToRef = new Map()}
    __init5() {this.opstream = []}
    __init6() {this.labelidx = 0}
    __init7() {this.labelmap = new Map()}

    emit(insn, ...args) {
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
    stri(n) {
        throw new Error('Method not implemented.')
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
            this.varNameToReg.set(n, this.obtainVirtualRegister())
        }
        const r = this.varNameToReg.get(n)
        return this.lookupNameForReg(r)
    }
    label(tgd) {
        this.labelmap.set(tgd, this.labelidx)
        this.emit(_crayons.endbr, _crayons.label.call(void 0, this.labelidx++))
    }
    br(tgd) {
        throw new Error('Method not implemented.')
    }
    bz(tgd, cond) {
        throw new Error('Method not implemented.')
    }
    bnz(tgd, ncond) {
        throw new Error('Method not implemented.')
    }
    generate() {
        return _highlight.finalizeColors.call(void 0, _crayons.completeGraphColor.call(void 0, this.opstream).filter(e => !e.startsWith('    ;')))
    }
    line(pos, source) {}
    platformHookEnd() {
        const sysno_reg = this.obtainVirtualRegister()
        const ecode_reg = this.obtainVirtualRegister()
        this.emit(_crayons.move, _crayons.vreg.call(void 0, sysno_reg), _crayons.imm.call(void 0, 60))
        this.emit(_crayons.move, _crayons.vreg.call(void 0, ecode_reg), _crayons.imm.call(void 0, 0))
        this.emit(_crayons.freeze, _crayons.vreg.call(void 0, sysno_reg), /*rax*/ _crayons.phyreg.call(void 0, 0))
        this.emit(_crayons.freeze, _crayons.vreg.call(void 0, ecode_reg), /*rdi*/ _crayons.phyreg.call(void 0, 5))
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
        throw new Error('Method not implemented.')
    }
} exports.TestNativeProgram = TestNativeProgram;
