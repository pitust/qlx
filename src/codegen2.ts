import { inspect } from 'util'
import {
    options,
    JumpCond,
    OpArg,
    Opcode,
    PrimitiveType,
    SSABlock,
    SSAUnit,
    Type,
    dumpSSA,
    getreg,
} from './middlegen'
import {
    optimize,
    orderBlocks,
    calculateCost,
    calculateCounterCost,
    makeInliningChoice,
} from './optimizer'
import { createProgram } from './target/api'
import { ice } from './target/common'
import { COMPILED_BY_QLX_BANNER } from './target/highlight'
import { Program, name } from './target/targen'

const refcounts = new Map<string, number>()
const optimizedFunctionBlocks = new Map<string, SSABlock[]>()
const inliningCost = new Map<string, number>()
const inliningCounterCost = new Map<string, number>()
const functionCallReferenceSet = new Set<string>()
function generateUnit(mod: string, fn: string, unit: SSAUnit, writeCode: (s: string) => void) {
    const program: Program = createProgram()
    function immref(arg: OpArg): name {
        if (typeof arg == 'number') return program.imm(arg)
        if (typeof arg == 'string') return program.stri(arg)
        if ('reg' in arg) return program.name2(`r${arg.reg}`)
        if ('arg' in arg) return program.name2(`${mod}::${fn}::a${arg.arg}`)
        if ('glob' in arg) return program.name(`${mod}::_init::${arg.glob}`)
        console.log(`error: no ${Object.keys(arg)} support rn!`)
        process.exit(2)
    }

    const afterBlock = new Map<SSABlock, SSABlock>()
    let blocks = orderBlocks(unit.blocks, unit.startBlock)
    inliningCounterCost.set(`${mod}::${fn}`, calculateCounterCost(blocks))
    // run optimization passes 8 times
    if (options.dump_ssaPreOpt) {
        dumpSSA(unit, blocks)
    }
    for (let i = 0; i < 8; i++)
        blocks = optimize(
            unit,
            blocks,
            tfn => {
                const choice = makeInliningChoice(
                    inliningCost.get(`${mod}::${tfn}`),
                    inliningCounterCost.get(`${mod}::${tfn}`)
                )
                return choice
            },
            tfn => {
                return optimizedFunctionBlocks.get(`${mod}::${tfn}`)
            },
            fn == '_init' // FIXME: this is a hack
        )
    inliningCost.set(`${mod}::${fn}`, calculateCost(blocks, refcounts.get(`${mod}::${fn}`)))
    optimizedFunctionBlocks.set(`${mod}::${fn}`, blocks)
    if (options.dump_ssaPreEmit) {
        dumpSSA(unit, blocks)
    }
    const genid = (
        i => () =>
            `b_${i++}`
    )(0)
    for (let i = 1; i < blocks.length; i++) afterBlock.set(blocks[i], blocks[i - 1])
    const bnames = new Map<SSABlock, string>()
    const usedlabels = new Set<string>()
    bnames.set(unit.startBlock, 'entry')
    function blookup(blk: SSABlock) {
        const id = bnames.has(blk) ? bnames.get(blk)! : genid()
        bnames.set(blk, id)
        return id
    }
    let programLongestOpcode = 4
    for (const blk of blocks) {
        const id = blookup(blk)
        program.label(`${mod}::${fn}.${id}`)
        for (const op of blk.ops) {
            program.line(op.pos, op.meta?.line ?? '')
            if (op.op == Opcode.TypeGlob || op.op == Opcode.TypeLoc) {
            } else if (op.op == Opcode.StGlob || op.op == Opcode.StInitGlob) {
                program.move(program.name(`${mod}::_init::${op.args[0]}`), immref(op.args[1]))
            } else if (op.op == Opcode.StLoc || op.op == Opcode.StInitLoc) {
                program.move(program.loc(`${mod}::${fn}::${op.args[0]}`), immref(op.args[1]))
            } else if (op.op == Opcode.Move) {
                program.move(immref(op.args[0]), immref(op.args[1]))
            } else if (op.op == Opcode.BindArgument) {
                program.move(
                    program.name(`${mod}::${fn}::${op.args[0]}`),
                    program.name2(`${mod}::${fn}.a${op.args[1]}.`)
                )
            } else if (op.op == Opcode.Call) {
                for (let i = 0; i < op.args.length - 2; i++) {
                    program.move(
                        program.name2(`${mod}::${op.args[1]}-a${i}`),
                        immref(op.args[i + 2])
                    )
                }
                program.call(`${op.args[1]}`)
                if (op.args[0]) {
                    program.move(immref(op.args[0]), program.name2(`${mod}::${op.args[1]}-ret0`))
                }
                functionCallReferenceSet.add(`${op.args[1]}`)
            } else if (op.op == Opcode.LdGlob) {
                program.move(immref(op.args[0]), program.name(`${mod}::_init::${op.args[1]}`))
            } else if (op.op == Opcode.LdLoc) {
                program.move(immref(op.args[0]), program.loc(`${mod}::${fn}::${op.args[1]}`))
            } else if (op.op == Opcode.BinOp) {
                const nam = `${op.args[1]}`
                const mappings = new Map(
                    Object.entries({
                        lessThan: 'lt',
                        add: 'add',
                    } as const)
                )
                if (!mappings.has(nam)) ice(`todo: binop ${nam}`)
                program.binop(
                    immref(op.args[0]),
                    immref(op.args[2]),
                    mappings.get(nam),
                    immref(op.args[3])
                )
            } else if (op.op == Opcode.TargetOp) {
                const top = `${op.args[0]}`
                if (top == 'print.direct') {
                    program.platformHookPrintString(JSON.parse(`${op.args[1]}`))
                } else if (top == 'print.ref') {
                    program.platformHookPrintValue(immref(op.args[1]))
                } else if (top == 'print.flush') {
                    program.platformHookPrintFlush(immref(op.args[1]))
                } else if (top == '_lookupblox') {
                    program.move(immref(op.args[1]), program.stri(`${op.args[2]}`))
                } else {
                    ice(`todo: targetop ${top}`)
                }
                // const ops = {
                //     'print.direct': () => `${fmt.rawio}print ${ri}${op.args[1]}${nostyle}`,
                //     'print.ref': () => `${fmt.rawio}print${nostyle} ${immref(op.args[1])}`,
                //     'print.flush': () => `${fmt.rawio}printflush${nostyle} ${immref(op.args[1])}`,
                //     _lookupblox: () =>
                //         `${fmt.assign}set${nostyle} ${immref(op.args[1])} ${op.args[2]}`,
                //     read: () =>
                //         `${fmt.assign}read${nostyle} ${immref(op.args[1])} ${immref(
                //             op.args[2]
                //         )} ${immref(op.args[3])}`,
                //     write: () =>
                //         `${fmt.assign}write${nostyle} ${immref(op.args[1])} ${immref(
                //             op.args[2]
                //         )} ${immref(op.args[3])}`,
                // }
                // if (!(<string>op.args[0] in ops)) console.log('op:', op.args[0])
                // code.push(`    ${ops[<keyof typeof ops>op.args[0]]()}`)
            } else if (op.op == Opcode.Return) {
                program.move(program.name2(`${mod}::${fn}-ret0`), immref(op.args[0]))
                program.retv(`${mod}::${fn}`)
            } else if (op.op == Opcode.ReturnVoid) {
                program.retv(`${mod}::${fn}`)
            } else if (op.op == Opcode.End) {
                program.platformHookEnd()
                // if (
                //     options.noEnd &&
                //     blocks[blocks.length - 1] == blk &&
                //     blk.cond == JumpCond.Abort
                // ) {
                //     continue
                // }
                // code.push(`    ${fmt.cflow}end${nostyle}`)
            } else if (op.op == Opcode.Function) {
                // `Function` is a typechecker hint.
            } else {
                console.log(`error: unknown op:`, Opcode[op.op], ...op.args)
                process.exit(2)
            }
            if ([Opcode.Return, Opcode.ReturnVoid, Opcode.End].includes(op.op)) break
        }
        const hasCons =
            options.eliminateBranches &&
            blk.targets.length > 0 &&
            afterBlock.get(blk.targets[0]) == blk
        const hasAlt =
            options.eliminateBranches &&
            blk.targets.length > 1 &&
            afterBlock.get(blk.targets[1]) == blk
        if (blk.cond == JumpCond.Always) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                program.br(target)
            }
        } else if (blk.cond == JumpCond.AlwaysNoMerge) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                program.br(target)
            }
        } else if (blk.cond == JumpCond.TestBoolean) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                program.bnz(target, immref(blk.condargs[0]))
            }
            if (!hasAlt) {
                const target = `${mod}::${fn}.${blookup(blk.targets[1])}`
                usedlabels.add(target)
                program.bz(target, immref(blk.condargs[0]))
            }
        } else if (blk.cond == JumpCond.Equal) {
            const nm = program.name(`r${getreg()}`)
            program.binop(nm, immref(blk.condargs[0]), 'eq', immref(blk.condargs[1]))
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                program.bnz(target, nm)
            }
            if (!hasAlt) {
                const target = `${mod}::${fn}.${blookup(blk.targets[1])}`
                usedlabels.add(target)
                program.bz(target, nm)
            }
        } else if (blk.cond == JumpCond.Abort) {
            // its fine they are unchecked aborts, stop whining
        } else {
            ice(`todo: cond ${JumpCond[blk.cond]}`)
        }
    }
    writeCode(program.generate())
}
export function generateCode(
    units: [SSAUnit, Map<string, SSAUnit>],
    writeCode: (s: string) => void
) {
    let buf = [COMPILED_BY_QLX_BANNER('mlog')]

    for (const [nm] of units[1]) refcounts.set(`_main::${nm}`, 0)

    for (const [, u] of units[1]) {
        for (const blk of u.blocks) {
            for (const op of blk.ops) {
                const tgd = `_main::${op.args[1]}`
                if (op.op == Opcode.Call) refcounts.set(tgd, refcounts.get(tgd) + 1)
            }
        }
    }
    for (const blk of units[0].blocks) {
        for (const op of blk.ops) {
            const tgd = `_main::${op.args[1]}`
            if (op.op == Opcode.Call) refcounts.set(tgd, refcounts.get(tgd) + 1)
        }
    }

    let buffers = new Map<string, string[]>()
    for (const [nm, u] of units[1]) {
        let buf1 = []
        buffers.set(`${nm}`, buf1)
        buf1.push(
            process.env.QLXCOLOR == 'on' ? `\x1b[0;33mfn._main::${nm}\x1b[0m:` : `fn._main::${nm}:`
        )
        const mod = nm.split('::')
        const fn = mod.pop()
        generateUnit(mod.join('::'), fn, u, code => {
            buf1.push(code)
        })
    }
    generateUnit('_main', '_init', units[0], code => {
        buf.push(code)
    })
    if (functionCallReferenceSet.size && options.noEnd) {
        buf.push(process.env.QLXCOLOR == 'on' ? `    \x1b[34mend\x1b[0m` : '    end')
    }
    for (const u of functionCallReferenceSet) buf.push(...buffers.get(u))
    if (!options.cgOutput_suppress) {
        writeCode(buf.join('\n'))
    }
}
