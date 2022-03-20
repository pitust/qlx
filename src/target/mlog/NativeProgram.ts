import { options } from '../../middlegen'
import { allocateColors } from '../colors'
import { ice } from '../common'
import { Amd64Machine } from '../mach/amd64'
import { Register, TargetMachine } from '../native'
import { Program, name } from '../targen'

interface Label {
    name: string
    index: number
}
interface Operation {
    loads: string[]
    stores: string[]
    jumpsTo?: string
    exits?: true
    generate(
        np: TargetMachine,
        expand: (n: name) => Register,
        move: (out: Register, n: name) => void
    ): void
}

export class NativeProgram extends Program {
    immediateNames = new Map<name, number>()
    variableNames = new Map<name, string>()
    variableRevNames = new Map<string, name>()
    operations: Operation[] = []
    labels: Label[] = []

    lookupLabel(l: string): number {
        for (const lab of this.labels) if (lab.name == l) return lab.index
        ice('invalid jump to undefined label ' + l)
    }

    lookup(n: name): string {
        if (this.immediateNames.has(n)) return '__immediate'
        if (this.variableNames.has(n)) return this.variableNames.get(n)
        ice('bad name: ' + n.description)
    }

    move(tgd: name, value: name): void {
        this.operations.push({
            loads: [this.lookup(value)],
            stores: [this.lookup(tgd)],
            generate(np, nx) {
                np.move(nx(tgd), nx(value))
            },
        })
    }
    binop(tgd: name, left: name, op: 'add' | 'lt' | 'eq', right: name): void {
        this.operations.push({
            loads: [this.lookup(left), this.lookup(right)],
            stores: [this.lookup(tgd)],
            generate(np, nx, mv) {
                if (np.isTwoAddress()) {
                    mv(nx(tgd), left)
                    np.add(nx(tgd), nx(tgd), nx(right))
                } else {
                    np.add(nx(tgd), nx(left), nx(right))
                }
            },
        })
    }
    unop(tgd: name, op: 'invert', arg: name): void {
        throw new Error('Method not implemented.')
    }
    imm(n: number): name {
        const nam = Symbol(`${n}`) as name
        this.immediateNames.set(nam, n)
        return nam
    }
    stri(n: string): name {
        throw new Error('Method not implemented.')
    }
    name(n: string): name {
        return this.name_common('v' + n)
    }
    loc(n: string): name {
        throw new Error('Method not implemented.')
    }
    name2(n: string): name {
        return this.name_common('t' + n)
    }
    name_common(n: string) {
        if (this.variableRevNames.has(n)) return this.variableRevNames.get(n)
        const nam = Symbol(`${n}`) as name
        this.variableNames.set(nam, n)
        this.variableRevNames.set(n, nam)
        return nam
    }
    label(tgd: string): void {
        this.labels.push({
            name: tgd,
            index: this.operations.length,
        })
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
    line(pos: string, source: string): void {
        // todo
    }
    platformHookEnd(): void {
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
            },
        })
    }
    platformHookPrintValue(p: name): void {
        const highimm = this.imm(99999)
        this.operations.push({
            loads: [this.lookup(p)],
            stores: [],
            generate(np, nx) {
                np.targetop2('syscall', nx(highimm), nx(p))
            },
        })
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

    findLivePoints(n: name) {
        if (this.immediateNames.has(n)) return new Set<number>()
        if (!this.variableNames.has(n)) ice('bad name ' + n.description)
        const prog = this
        const mname = this.variableNames.get(n)

        const liveRequirements = new Set<number>()

        // target -> source
        const branches = new Map<number, number>()
        for (let i = 0; i < this.operations.length; i++) {
            if (this.operations[i].jumpsTo)
                branches.set(this.lookupLabel(this.operations[i].jumpsTo), i)
        }

        const scanned = new Set<number>()
        const live = new Set<number>()
        let queue: number[] = []
        for (let i = 0; i < this.operations.length; i++) {
            if (prog.operations[i].loads.includes(mname)) queue.push(i)
        }
        for (let i = 0; i < this.operations.length; i++) {
            // if you store something, it has to be live for at least one op
            if (prog.operations[i].stores.includes(mname)) live.add(i)
        }
        function scan(from: number) {
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
    generate(): string {
        // let's get started!
        // step 1: perform analysis
        const liveness = new Map<name, Set<number>>()
        for (const [vn] of this.variableNames) liveness.set(vn, this.findLivePoints(vn))

        const coloring = new Map<name, number>()
        let nregs = 0
        for (const [nam, livepoints] of liveness) {
            let registerUsage = new Set<number>()
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
        const colors = allocateColors(nregs)
        const done = new Set<string>()
        let flip = false
        if (options.dump_nativeGraphColoring) {
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
        const target: TargetMachine = new Amd64Machine()
        const regs = target.registers()
        if (nregs > regs.length) {
            ice('TODO: spilling')
        }
        const currentMapping = new Map<name, Register>()
        for (const [nam, regid] of coloring) {
            currentMapping.set(nam, regs[regid - 1])
        }

        // step 3: linearly emit all the code into the target
        for (let i = 0; i < this.operations.length; i++) {
            if (this.labels.find(e => e.index == i)) {
                this.labels
                    .filter(e => e.index == i)
                    .forEach(e => {
                        target.label(e.name)
                    })
            }
            let cache: Register[] = []
            this.operations[i].generate(
                target,
                nam => {
                    if (currentMapping.has(nam)) return currentMapping.get(nam)
                    if (this.immediateNames.has(nam)) {
                        const inam = this.immediateNames.get(nam)
                        const t1 = target.acquireTemp()
                        cache.push(t1)
                        target.movei(t1, inam)
                        return t1
                    }
                    ice('TODO: name lookup')
                },
                (out, nam) => {
                    if (currentMapping.has(nam)) {
                        target.move(out, currentMapping.get(nam))
                        return
                    }
                    if (this.immediateNames.has(nam)) {
                        const inam = this.immediateNames.get(nam)
                        target.movei(out, inam)
                        return
                    }
                    ice('TODO: name lookup')
                }
            )
            for (const item of cache) target.releaseTemp(item)
        }

        return target.finalize().join('\n')
    }
}
