"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _common = require('../common');










var _highlight = require('../highlight');
var _targen = require('../targen');

 class MindustryProgram extends _targen.Program {constructor(...args) { super(...args); MindustryProgram.prototype.__init.call(this);MindustryProgram.prototype.__init2.call(this);MindustryProgram.prototype.__init3.call(this); }
    __init() {this._code = []}
    __init2() {this.currentline = ''}
    __init3() {this.nameLookup = new Map()}
    lookup(n) {
        return this.nameLookup.get(n)
    }
    emit(s, line = true) {
        if (line) s += `\x00%` + this.currentline
        this._code.push(s)
    }
    line(pos, source) {
        this.currentline = `${_highlight.comment}# ${pos.padEnd(26)} | ${_highlight.highlight.call(void 0, source)}`
    }

    move(tgd, value) {
        if (this.lookup(tgd) != this.lookup(value))
            this.emit(`    ${_highlight.fmt.assign}set${_highlight.nostyle} ${this.lookup(tgd)} ${this.lookup(value)}`)
    }
    binop(tgd, left, op, right) {
        const binopLookup = {
            add: 'add',
            sub: 'sub',
            lt: 'lessThan',
            eq: 'equal',
        } 
        this.emit(
            `    ${_highlight.fmt.assign}op ${_highlight.selector}${binopLookup[op]}${_highlight.nostyle} ${this.lookup(
                tgd
            )} ${this.lookup(left)} ${this.lookup(right)}`
        )
    }
    unop(tgd, op, arg) {
        _common.ice.call(void 0, 'Program: unop')
    }
    imm(n) {
        const sym = Symbol(`${n}`) 
        this.nameLookup.set(sym, `${_highlight.ri}${n}${_highlight.nostyle}`)
        return sym
    }
    stri(n) {
        const sym = Symbol(`${n}`) 
        this.nameLookup.set(sym, `${_highlight.ri}${JSON.stringify(n)}${_highlight.nostyle}`)
        return sym
    }
    name(n) {
        const sym = Symbol(`${n}`) 
        this.nameLookup.set(sym, `${_highlight.glob}g${n}${_highlight.nostyle}`)
        return sym
    }
    loc(n) {
        const sym = Symbol(`${n}`) 
        this.nameLookup.set(sym, `${_highlight.glob}l${n}${_highlight.nostyle}`)
        return sym
    }
    name2(n) {
        const sym = Symbol(`${n}`) 
        this.nameLookup.set(sym, `${_highlight.glob}t${n}${_highlight.nostyle}`)
        return sym
    }
    call(name) {
        this.emit(
            `    ${_highlight.fmt.cflow}op ${_highlight.selector}add ${_highlight.ri}lr.${name} ${_highlight.selector}@counter ${_highlight.ri}2${_highlight.nostyle}`
        )
        this.emit(`    ${_highlight.fmt.cflow}jump ${_highlight.label}${name} ${_highlight.selector}always${_highlight.nostyle}`)
    }
    retv(name) {
        this.emit(`    ${_highlight.fmt.cflow}set ${_highlight.selector}@counter ${_highlight.ri}lr.${name}${_highlight.nostyle}`)
    }
    label(tgd) {
        this.emit(`${_highlight.label}${tgd}${_highlight.nostyle}:`, false)
    }
    br(tgd) {
        this.emit(`    ${_highlight.fmt.cflow}jump ${_highlight.label}${tgd} ${_highlight.selector}always${_highlight.nostyle}`)
    }
    bz(tgd, cond) {
        this.emit(
            `    ${_highlight.fmt.cflow}jump ${_highlight.label}${tgd} ${_highlight.selector}equal ${_highlight.ri}0${_highlight.nostyle} ${this.lookup(
                cond
            )}`
        )
    }
    bnz(tgd, ncond) {
        this.emit(
            `    ${_highlight.fmt.cflow}jump ${_highlight.label}${tgd} ${_highlight.selector}notEqual ${_highlight.ri}0${_highlight.nostyle} ${this.lookup(
                ncond
            )}`
        )
    }

    platformHookEnd() {
        this.emit(`    ${_highlight.fmt.cflow}end${_highlight.nostyle}`)
    }
    platformHookPrintValue(p) {
        this.emit(`    ${_highlight.fmt.rawio}print${_highlight.nostyle} ${this.lookup(p)}`)
    }
    platformHookPrintString(p) {
        this.emit(`    ${_highlight.fmt.rawio}print ${_highlight.ri}${JSON.stringify(p)}${_highlight.nostyle}`)
    }
    platformHookPrintFlush(p) {
        this.emit(`    ${_highlight.fmt.rawio}printflush${_highlight.nostyle} ${this.lookup(p)}`)
    }

    generate() {
        return _highlight.finalizeColors.call(void 0, this._code)
    }
} exports.MindustryProgram = MindustryProgram;
