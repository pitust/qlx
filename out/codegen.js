"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _util = require('util');










var _middlegen = require('./middlegen');






var _optimizer = require('./optimizer');











var _highlight = require('./target/highlight');

const refcounts = new Map()
const optimizedFunctionBlocks = new Map()
const inliningCost = new Map()
const inliningCounterCost = new Map()
const functionCallReferenceSet = new Set()
function generateUnit(mod, fn, unit, writeCode) {
    function immref(arg) {
        if (typeof arg == 'number') return `${_highlight.ri}${arg}${_highlight.nostyle}`
        if (typeof arg == 'string') return _highlight.ri + JSON.stringify(arg) + _highlight.nostyle
        if ('reg' in arg) return `${_highlight.ri}r${arg.reg}${_highlight.nostyle}`
        if ('arg' in arg) return `${_highlight.ri}arg-${arg.arg}.${mod}::${fn}${_highlight.nostyle}`
        if ('glob' in arg) return `${_highlight.glob}${mod}::_init::${arg.glob}${_highlight.nostyle}`
        if ('blox' in arg) return _highlight.glob + arg.blox + _highlight.nostyle
        console.log(`error: no rtti support rn!`)
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
    let code = []
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
        code.push(`${_highlight.label}${mod}::${fn}.${id}${_highlight.nostyle}:`)
        for (const op of blk.ops) {
            let watermark = code.length
            if (_middlegen.options.interleaveSsa)
                code.push(
                    `    # ${_highlight.opc}${_middlegen.Opcode[op.op]}${_highlight.nostyle} ${op.args
                        .map(e => _util.inspect.call(void 0, e, { breakLength: Infinity }))
                        .join(' ')}`
                )
            if (op.op == _middlegen.Opcode.TypeGlob || op.op == _middlegen.Opcode.TypeLoc) {
            } else if (op.op == _middlegen.Opcode.StGlob || op.op == _middlegen.Opcode.StInitGlob) {
                code.push(
                    `    ${_highlight.fmt.assign}set ${_highlight.glob}${mod}::_init::${op.args[0]}${_highlight.nostyle} ${immref(
                        op.args[1]
                    )}`
                )
            } else if (op.op == _middlegen.Opcode.StLoc || op.op == _middlegen.Opcode.StInitLoc) {
                code.push(
                    `    ${_highlight.fmt.assign}set ${_highlight.glob}${mod}::${fn}::${op.args[0]}${_highlight.nostyle} ${immref(
                        op.args[1]
                    )}`
                )
            } else if (op.op == _middlegen.Opcode.Move) {
                code.push(
                    `    ${_highlight.fmt.assign}set${_highlight.nostyle} ${immref(op.args[0])} ${immref(op.args[1])}`
                )
            } else if (op.op == _middlegen.Opcode.BindArgument) {
                code.push(
                    `    ${_highlight.fmt.assign}set${_highlight.nostyle} ${_highlight.glob}${mod}::${fn}::${op.args[0]} ${_highlight.nostyle}${_highlight.ri}arg-${op.args[1]}.${mod}::${fn}${_highlight.nostyle}`
                )
            } else if (op.op == _middlegen.Opcode.Call) {
                for (let i = 0; i < op.args.length - 2; i++) {
                    code.push(
                        `    ${_highlight.fmt.assign}set ${_highlight.ri}arg-${i}.${mod}::${
                            op.args[1]
                        }${_highlight.nostyle} ${immref(op.args[i + 2])}`
                    )
                }
                code.push(
                    `    ${_highlight.fmt.assign}op ${_highlight.selector}add ${_highlight.ri}lr.${mod}::${op.args[1]} ${_highlight.selector}@counter ${_highlight.ri}1${_highlight.nostyle}`
                )
                code.push(
                    `    ${_highlight.fmt.assign}jump ${_highlight.label}fn.${mod}::${op.args[1]} ${_highlight.selector}always${_highlight.nostyle}`
                )
                if (op.args[0]) {
                    code.push(
                        `    ${_highlight.fmt.assign}set ${immref(op.args[0])} ${_highlight.ri}rv.${mod}::${op.args[1]}`
                    )
                }
                functionCallReferenceSet.add(`${mod}::${op.args[1]}`)
            } else if (op.op == _middlegen.Opcode.LdGlob) {
                code.push(
                    `    ${_highlight.fmt.assign}set${_highlight.nostyle} ${immref(op.args[0])} ${_highlight.label}${mod}::_init::${
                        op.args[1]
                    }${_highlight.nostyle}`
                )
            } else if (op.op == _middlegen.Opcode.LdLoc) {
                code.push(
                    `    ${_highlight.fmt.assign}set${_highlight.nostyle} ${immref(op.args[0])} ${_highlight.label}${mod}::${fn}::${
                        op.args[1]
                    }${_highlight.nostyle}`
                )
            } else if (op.op == _middlegen.Opcode.BinOp) {
                code.push(
                    `    ${_highlight.fmt.assign}op ${_highlight.selector}${op.args[1]}${_highlight.nostyle} ${immref(
                        op.args[0]
                    )} ${immref(op.args[2])} ${immref(op.args[3])}`
                )
            } else if (op.op == _middlegen.Opcode.TargetOp) {
                const ops = {
                    'print.direct': () => `${_highlight.fmt.rawio}print ${_highlight.ri}${op.args[1]}${_highlight.nostyle}`,
                    'print.ref': () => `${_highlight.fmt.rawio}print${_highlight.nostyle} ${immref(op.args[1])}`,
                    'print.flush': () => `${_highlight.fmt.rawio}printflush${_highlight.nostyle} ${immref(op.args[1])}`,
                    _lookupblox: () =>
                        `${_highlight.fmt.assign}set${_highlight.nostyle} ${immref(op.args[1])} ${op.args[2]}`,
                    read: () =>
                        `${_highlight.fmt.assign}read${_highlight.nostyle} ${immref(op.args[1])} ${immref(
                            op.args[2]
                        )} ${immref(op.args[3])}`,
                    write: () =>
                        `${_highlight.fmt.assign}write${_highlight.nostyle} ${immref(op.args[1])} ${immref(
                            op.args[2]
                        )} ${immref(op.args[3])}`,
                }
                if (!(op.args[0] in ops)) console.log('op:', op.args[0])
                code.push(`    ${ops[op.args[0]]()}`)
            } else if (op.op == _middlegen.Opcode.Return) {
                code.push(
                    `    ${_highlight.fmt.cflow}set ${_highlight.ri}rv.${mod}::${fn}${_highlight.nostyle} ${immref(op.args[0])}`
                )
                code.push(`    ${_highlight.fmt.cflow}set ${_highlight.selector}@counter ${_highlight.ri}lr.${mod}::${fn}${_highlight.nostyle}`)
            } else if (op.op == _middlegen.Opcode.ReturnVoid) {
                code.push(`    ${_highlight.fmt.cflow}set ${_highlight.selector}@counter ${_highlight.ri}lr.${mod}::${fn}${_highlight.nostyle}`)
            } else if (op.op == _middlegen.Opcode.End) {
                if (
                    _middlegen.options.noEnd &&
                    blocks[blocks.length - 1] == blk &&
                    blk.cond == _middlegen.JumpCond.Abort
                ) {
                    continue
                }
                code.push(`    ${_highlight.fmt.cflow}end${_highlight.nostyle}`)
            } else if (op.op == _middlegen.Opcode.Function) {
                // `Function` is a typechecker hint.
            } else {
                console.log(`error: unknown op:`, _middlegen.Opcode[op.op], ...op.args)
                process.exit(2)
            }
            for (let i = watermark; i < code.length; i++) {
                programLongestOpcode = Math.max(
                    code[i].replaceAll(/\x00./g, '').length + 4,
                    programLongestOpcode
                )
                code[i] += ' #@@ ' + op.pos + '  \t'
                if (op.meta) code[i] += '| ' + _highlight.nostyle + _highlight.highlight.call(void 0, op.meta.line, op.meta.range)
            }
            if ([_middlegen.Opcode.Return, _middlegen.Opcode.ReturnVoid, _middlegen.Opcode.End].includes(op.op)) break
        }
        if (_middlegen.options.interleaveSsa)
            code.push(
                `    # ${_middlegen.JumpCond[blk.cond]} ${blk.condargs
                    .map(e => _util.inspect.call(void 0, e, { breakLength: Infinity }))
                    .join(' ')}`
            )
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
                code.push(`    ${_highlight.fmt.cflow}jump ${_highlight.label}${target}${_highlight.nostyle}`)
            } else code.push(`    ${_highlight.comment}# falls through`)
        } else if (blk.cond == _middlegen.JumpCond.AlwaysNoMerge) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(
                    `    ${_highlight.fmt.cflow}jump ${_highlight.label}${target} ${_highlight.comment}# ${_highlight.ri}note: this should never happen!`
                )
            } else code.push(`    ${_highlight.comment}# (call block falls through)`)
        } else if (blk.cond == _middlegen.JumpCond.TestBoolean) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(
                    `    ${
                        _highlight.fmt.cflow
                    }jump ${_highlight.label}${target} ${_highlight.selector}notEqual${_highlight.nostyle} 0 ${immref(
                        blk.condargs[0]
                    )} ${_highlight.comment}# consequent`
                )
            }
            if (!hasAlt) {
                const target = `${mod}::${fn}.${blookup(blk.targets[1])}`
                usedlabels.add(target)
                code.push(
                    `    ${_highlight.fmt.cflow}jump ${_highlight.label}${target} ${_highlight.selector}equal${_highlight.nostyle} 0 ${immref(
                        blk.condargs[0]
                    )} ${_highlight.comment}# alternate`
                )
            }
        } else if (blk.cond == _middlegen.JumpCond.Equal) {
            if (!hasCons) {
                const target = `${mod}::${fn}.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(
                    `    ${_highlight.fmt.cflow}jump ${_highlight.label}${target} ${_highlight.selector}equal${_highlight.nostyle} ${immref(
                        blk.condargs[0]
                    )} ${immref(blk.condargs[1])} ${_highlight.comment}# consequent`
                )
            }
            if (!hasAlt) {
                const target = `${mod}::${fn}.${blookup(blk.targets[1])}`
                usedlabels.add(target)
                code.push(
                    `    ${_highlight.fmt.cflow}jump ${_highlight.label}${target} ${_highlight.selector}notEqual${_highlight.nostyle} ${immref(
                        blk.condargs[0]
                    )} ${immref(blk.condargs[1])} ${_highlight.comment}# alternate`
                )
            }
        } else if (blk.cond == _middlegen.JumpCond.Abort) {
            if (!_middlegen.options.noSafeAbort)
                code.push(
                    `    ${_highlight.fmt.assign}op ${_highlight.selector}sub @counter @counter ${_highlight.ri}1 ${_highlight.comment}# abort`
                )
            else code.push(`    ${_highlight.comment}# abort!`)
        } else {
            code.push(`    ${_highlight.comment}# ${_highlight.fmt.rawio}TODO${_highlight.comment}: branch: ${_middlegen.JumpCond[blk.cond]}`)
        }
    }
    for (let i = 0; i < code.length; i++) {
        const tbl = code[i].split(' #@@ ')
        if (tbl.length == 1) continue
        const lol = tbl.slice(0, -1).join(' #@@ ')
        const lolcount = lol.match(/\x00./g).length
        code[i] =
            lol.padEnd(programLongestOpcode + lolcount * 2) +
            _highlight.comment +
            '# ' +
            tbl.slice(-1)[0] +
            _highlight.nostyle
    }
    if (_middlegen.options.stripComments) {
        code = code.map(line => line.split('#')[0]).filter(e => e.replaceAll(/\x00./g, '').trim())
    }
    if (_middlegen.options.eliminateBranches) {
        code = code.filter(e => !(e.endsWith(':') && !usedlabels.has(e.slice(4, -3))))
    }

    writeCode(_highlight.finalizeColors.call(void 0, code))
}
 function generateCode(
    units,
    writeCode
) {
    let buf = [
        process.env.QLXCOLOR == 'on'
            ? '    \x1b[0;30m# compiled by qlx\x1b[0m'
            : '    # compiled by qlx',
    ]

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
        buffers.set(`_main::${nm}`, buf1)
        buf1.push(
            process.env.QLXCOLOR == 'on' ? `\x1b[0;33mfn._main::${nm}\x1b[0m:` : `fn._main::${nm}:`
        )
        generateUnit('_main', nm, u, code => {
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
