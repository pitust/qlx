"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _middlegen = require('../../middlegen');
var _colors = require('../colors');
var _common = require('../common');
var _amd64 = require('../mach/amd64');

var _targen = require('../targen');













 class NativeProgram extends _targen.Program {constructor(...args) { super(...args); NativeProgram.prototype.__init.call(this);NativeProgram.prototype.__init2.call(this);NativeProgram.prototype.__init3.call(this);NativeProgram.prototype.__init4.call(this);NativeProgram.prototype.__init5.call(this); }
    __init() {this.immediateNames = new Map()}
    __init2() {this.variableNames = new Map()}
    __init3() {this.variableRevNames = new Map()}
    __init4() {this.operations = []}
    __init5() {this.labels = []}

    lookupLabel(l) {
        for (const lab of this.labels) if (lab.name == l) return lab.index
        _common.ice.call(void 0, 'invalid jump to undefined label ' + l)
    }

    lookup(n) {
        if (this.immediateNames.has(n)) return '__immediate'
        if (this.variableNames.has(n)) return this.variableNames.get(n)
        _common.ice.call(void 0, 'bad name: ' + n.description)
    }

    move(tgd, value) {
        this.operations.push({
            loads: [this.lookup(value)],
            stores: [this.lookup(tgd)],
            generate(np, nx) {
                np.move(nx(tgd), nx(value))
            }
        })
    }
    binop(tgd, left, op, right) {
        this.operations.push({
            loads: [this.lookup(left), this.lookup(right)],
            stores: [this.lookup(tgd)],
            generate(np, nx) {
                if (np.isTwoAddress()) {
                    np.move(nx(tgd), nx(left))
                    np.add(nx(tgd), nx(tgd), nx(right))
                } else {
                    np.add(nx(tgd), nx(left), nx(right))
                }
            }
        })
    }
    unop(tgd, op, arg) {
        throw new Error('Method not implemented.')
    }
    imm(n) {
        const nam = Symbol(`${n}`) 
        this.immediateNames.set(nam, n)
        return nam
    }
    stri(n) {
        throw new Error('Method not implemented.')
    }
    name(n) {
        return this.name_common('v' + n)
    }
    loc(n) {
        throw new Error('Method not implemented.')
    }
    name2(n) {
        return this.name_common('t' + n)
    }
    name_common(n) {
        if (this.variableRevNames.has(n)) return this.variableRevNames.get(n)
        const nam = Symbol(`${n}`) 
        this.variableNames.set(nam, n)
        this.variableRevNames.set(n, nam)
        return nam
    }
    label(tgd) {
        this.labels.push({
            name: tgd,
            index: this.operations.length,
        })
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
    line(pos, source) {
        // todo
    }
    platformHookEnd() {
        this.operations.push({
            loads: [],
            stores: [],
            exits: true,
            generate(np, nx) {
                let sysno = -1
                if (np.name() == 'x86_64') {
                    sysno = 60
                } else if (np.name() == 'aarch64') {
                    sysno = 94
                }
                if (sysno != -1) {
                    const ti = np.acquireTemp()
                    const ti2 = np.acquireTemp()
                    np.movei(ti, sysno)
                    np.xor(ti2, ti2, ti2)
                    np.targetop2('syscall', ti, ti2)
                    np.releaseTemp(ti)
                    np.releaseTemp(ti2)
                }
                np.label('__end')
                np.br('__end')
            }
        })
    }
    platformHookPrintValue(p) {
        const highimm = this.imm(99999)
        this.operations.push({
            loads: [this.lookup(p)],
            stores: [],
            generate(np, nx) {
                np.targetop2('syscall', nx(highimm), nx(p))
            }
        })
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

    findLivePoints(n) {
        if (this.immediateNames.has(n)) return new Set()
        if (!this.variableNames.has(n)) _common.ice.call(void 0, 'bad name ' + n.description)
        const prog = this
        const mname = this.variableNames.get(n)

        const liveRequirements = new Set()

        // target -> source
        const branches = new Map()
        for (let i = 0; i < this.operations.length; i++) {
            if (this.operations[i].jumpsTo)
                branches.set(this.lookupLabel(this.operations[i].jumpsTo), i)
        }

        const scanned = new Set()
        const live = new Set()
        let queue = []
        for (let i = 0; i < this.operations.length; i++) {
            if (prog.operations[i].loads.includes(mname)) queue.push(i)
        }
        for (let i = 0; i < this.operations.length; i++) {
            // if you store something, it has to be live for at least one op
            if (prog.operations[i].stores.includes(mname)) live.add(i)
        }
        function scan(from) {
            if (scanned.has(from)) return
            scanned.add(from)
            live.add(from)
            if (prog.operations[from].stores.includes(mname)) return
            if (from > 0) queue.push(from - 1)
            if (branches.has(from)) queue.push(branches.get(from))
        }

        while (queue.length) {
            const oldqueue = queue
            queue = []
            for (const e of oldqueue) scan(e)
        }
        return live
    }
    generate() {
        // let's get started!
        // step 1: perform analysis
        const liveness = new Map()
        for (const [vn] of this.variableNames) liveness.set(vn, this.findLivePoints(vn))

        const coloring = new Map()
        let nregs = 0
        for (const [nam, livepoints] of liveness) {
            let registerUsage = new Set()
            for (const lp of livepoints) {
                for (const [nam2, livepoints2] of liveness) {
                    if (nam == nam2) continue
                    if (livepoints2.has(lp)) {
                        if (!coloring.has(nam2)) registerUsage.add(coloring.get(nam2))
                    }
                }
            }
            let register = 1
            while (registerUsage.has(register)) register++
            nregs = Math.max(nregs, register)
            coloring.set(nam, register)
        }
        const colors = _colors.allocateColors.call(void 0, nregs)
        const done = new Set()
        let flip = false
        if (_middlegen.options.dump_nativeGraphColoring) {
            console.log('graph {')
            for (const [nam, livepoints] of liveness) {
                console.log(
                    `    "${nam.description}" [style=dashed,color="${
                        colors[coloring.get(nam) - 1]
                    }"];`
                )
                names: for (const [nam2, livepoints2] of liveness) {
                    if (nam == nam2) continue
                    for (const lp of livepoints) {
                        if (livepoints2.has(lp)) {
                            flip = !flip
                            let cnst = `[constraint=${flip}]`
                            if (!done.has(`${nam.description}-${nam2.description}`)) {
                                console.log(
                                    `    "${nam.description}" -- "${nam2.description}" ${cnst};`
                                )
                            }
                            done.add(`${nam2.description}-${nam.description}`)
                            done.add(`${nam.description}-${nam2.description}`)
                            continue names
                        }
                    }
                }
            }
            console.log('}')
        }

        // okay, we colored registers. time for...
        // step 2: each reg has a color, now we need to lower the colors to target regs
        const target = new (0, _amd64.Amd64Machine)()
        const regs = target.registers()
        if (nregs > regs.length) {
            _common.ice.call(void 0, 'TODO: spilling')
        }
        const currentMapping = new Map()
        for (const [nam, regid] of coloring) {
            currentMapping.set(nam, regs[regid - 1])
        }
        
        // step 3: linearly emit all the code into the target
        for (let i = 0;i < this.operations.length;i++) {
            if (this.labels.find(e => e.index == i)) {
                this.labels.filter(e => e.index == i).forEach(e => {
                    target.label(e.name)
                })
            }
            let cache = []
            this.operations[i].generate(target, nam => {
                if (currentMapping.has(nam)) return currentMapping.get(nam)
                if (this.immediateNames.has(nam)) {
                    const inam = this.immediateNames.get(nam)
                    const t1 = target.acquireTemp()
                    cache.push(t1)
                    target.movei(t1, inam)
                    return t1
                }
                _common.ice.call(void 0, 'TODO: name lookup')
            })
            for (const item of cache) target.releaseTemp(item)
        }


        return target.finalize().join('\n')
    }
} exports.NativeProgram = NativeProgram;
