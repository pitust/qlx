"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }











var _middlegen = require('./middlegen');






var _optimizer = require('./optimizer');
var _api = require('./target/api');
var _common = require('./target/common');
var _highlight = require('./target/highlight');


const refcounts = new Map()
const optimizedFunctionBlocks = new Map()
const inliningCost = new Map()
const inliningCounterCost = new Map()
const functionCallReferenceSet = new Set()
function generateUnit(mod, fn, unit, writeCode) {
    const program = _api.createProgram.call(void 0, )
    function immref(arg) {
        if (typeof arg == 'number') return program.imm(arg)
        if (typeof arg == 'string') return program.stri(arg)
        if ('reg' in arg) return program.name2(`r${arg.reg}`)
        if ('arg' in arg) return program.name2(`${mod}::${fn}::a${arg.arg}`)
        if ('glob' in arg) return program.name(`${mod}::_init::${arg.glob}`)
        console.log(`error: no ${Object.keys(arg)} support rn!`)
        process.exit(2)
    }

    const afterBlock = new Map()
    let blocks = _optimizer.orderBlocks.call(void 0, unit.blocks, unit.startBlock)
    inliningCounterCost.set(`${mod}::${fn}`, _optimizer.calculateCounterCost.call(void 0, blocks))
    // run optimization passes 8 times
    if (_middlegen.options.dump_ssaPreOpt) {
        _middlegen.dumpSSA.call(void 0, unit, blocks)
    }
    for (let i = 0; i < 8; i++)
        blocks = _optimizer.optimize.call(void 0, 
            unit,
            blocks,
            tfn => {
                const choice = _optimizer.makeInliningChoice.call(void 0, 
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
    inliningCost.set(`${mod}::${fn}`, _optimizer.calculateCost.call(void 0, blocks, refcounts.get(`${mod}::${fn}`)))
    optimizedFunctionBlocks.set(`${mod}::${fn}`, blocks)
    if (_middlegen.options.dump_ssaPreEmit) {
        _middlegen.dumpSSA.call(void 0, unit, blocks)
    }
    const genid = (
        i => () =>
            `b_${i++}`
    )(0)
    for (let i = 1; i < blocks.length; i++) afterBlock.set(blocks[i], blocks[i - 1])
    const bnames = new Map()
    const usedlabels = new Set()
    bnames.set(unit.startBlock, 'entry')
    function blookup(blk) {
        const id = bnames.has(blk) ? bnames.get(blk) : genid()
        bnames.set(blk, id)
        return id
    }
    let programLongestOpcode = 4
    for (const blk of blocks) {
        const id = blookup(blk)
        program.label(`${mod}::${fn}.${id}`)
        for (const op of blk.ops) {
            program.line(op.pos, _nullishCoalesce(_optionalChain([op, 'access', _ => _.meta, 'optionalAccess', _2 => _2.line]), () => ( '')))
            if (op.op == _middlegen.Opcode.TypeGlob || op.op == _middlegen.Opcode.TypeLoc) {
            } else if (op.op == _middlegen.Opcode.StGlob || op.op == _middlegen.Opcode.StInitGlob) {
                program.move(program.name(`${mod}::_init::${op.args[0]}`), immref(op.args[1]))
            } else if (op.op == _middlegen.Opcode.StLoc || op.op == _middlegen.Opcode.StInitLoc) {
                program.move(program.loc(`${mod}::${fn}::${op.args[0]}`), immref(op.args[1]))
            } else if (op.op == _middlegen.Opcode.Move) {
                program.move(immref(op.args[0]), immref(op.args[1]))
            } else if (op.op == _middlegen.Opcode.BindArgument) {
                program.move(
                    program.name(`${mod}::${fn}::${op.args[0]}`),
                    program.name2(`${mod}::${fn}.a${op.args[1]}.`)
                )
            } else if (op.op == _middlegen.Opcode.Call) {
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
            } else if (op.op == _middlegen.Opcode.LdGlob) {
                program.move(immref(op.args[0]), program.name(`${mod}::_init::${op.args[1]}`))
            } else if (op.op == _middlegen.Opcode.LdLoc) {
                program.move(immref(op.args[0]), program.loc(`${mod}::${fn}::${op.args[1]}`))
            } else if (op.op == _middlegen.Opcode.BinOp) {
                const nam = `${op.args[1]}`
                const mappings = new Map(
                    Object.entries({
                        lessThan: 'lt',
                        add: 'add',
                    } )
                )
                if (!mappings.has(nam)) _common.ice.call(void 0, `todo: binop ${nam}`)
                program.binop(
                    immref(op.args[0]),
                    immref(op.args[2]),
                    mappings.get(nam),
                    immref(op.args[3])
                )
            } else if (op.op == _middlegen.Opcode.TargetOp) {
                const top = `${op.args[0]}`
                if (top == 'print.direct') {
                    program.platformHookPrintString(JSON.parse(`${op.args[1]}`))
                } else {
                    _common.ice.call(void 0, `todo: targetop ${top}`)
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
            } else if (op.op == _middlegen.Opcode.Return) {
                program.move(program.name2(`${mod}::${fn}-ret0`), immref(op.args[0]))
                program.retv(`${mod}::${fn}`)
            } else if (op.op == _middlegen.Opcode.ReturnVoid) {
                program.retv(`${mod}::${fn}`)
            } else if (op.op == _middlegen.Opcode.End) {
                program.platformHookEnd()
                // if (
                //     options.noEnd &&
                //     blocks[blocks.length - 1] == blk &&
                //     blk.cond == JumpCond.Abort
                // ) {
                //     continue
                // }
                // code.push(`    ${fmt.cflow}end${nostyle}`)
            } else if (op.op == _middlegen.Opcode.Function) {
                // `Function` is a typechecker hint.
            } else {
                console.log(`error: unknown op:`, _middlegen.Opcode[op.op], ...op.args)
                process.exit(2)
            }
            if ([_middlegen.Opcode.Return, _middlegen.Opcode.ReturnVoid, _middlegen.Opcode.End].includes(op.op)) break
        }
        const hasCons =
            _middlegen.options.eliminateBranches &&
            blk.targets.length > 0 &&
            afterBlock.get(blk.targets[0]) == blk
        const hasAlt =
            _middlegen.options.eliminateBranches &&
            blk.targets.length > 1 &&
            afterBlock.get(blk.targets[1]) == blk
        if (blk.cond == _middlegen.JumpCond.Always) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                program.br(target)
            }
        } else if (blk.cond == _middlegen.JumpCond.AlwaysNoMerge) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                program.br(target)
            }
        } else if (blk.cond == _middlegen.JumpCond.TestBoolean) {
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
        } else if (blk.cond == _middlegen.JumpCond.Equal) {
            const nm = program.name(`r${_middlegen.getreg.call(void 0, )}`)
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
        } else if (blk.cond == _middlegen.JumpCond.Abort) {
            // its fine they are unchecked aborts, stop whining
        } else {
            _common.ice.call(void 0, `todo: cond ${_middlegen.JumpCond[blk.cond]}`)
        }
    }
    writeCode(program.generate())
}
 function generateCode(
    units,
    writeCode
) {
    let buf = [_highlight.COMPILED_BY_QLX_BANNER.call(void 0, 'mlog')]

    for (const [nm] of units[1]) refcounts.set(`_main::${nm}`, 0)

    for (const [, u] of units[1]) {
        for (const blk of u.blocks) {
            for (const op of blk.ops) {
                const tgd = `_main::${op.args[1]}`
                if (op.op == _middlegen.Opcode.Call) refcounts.set(tgd, refcounts.get(tgd) + 1)
            }
        }
    }
    for (const blk of units[0].blocks) {
        for (const op of blk.ops) {
            const tgd = `_main::${op.args[1]}`
            if (op.op == _middlegen.Opcode.Call) refcounts.set(tgd, refcounts.get(tgd) + 1)
        }
    }

    let buffers = new Map()
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
    if (functionCallReferenceSet.size && _middlegen.options.noEnd) {
        buf.push(process.env.QLXCOLOR == 'on' ? `    \x1b[34mend\x1b[0m` : '    end')
    }
    for (const u of functionCallReferenceSet) buf.push(...buffers.get(u))
    if (!_middlegen.options.cgOutput_suppress) {
        writeCode(buf.join('\n'))
    }
} exports.generateCode = generateCode;
