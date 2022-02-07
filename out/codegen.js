"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _util = require('util');










var _middlegen = require('./middlegen');
var _optimizer = require('./optimizer');

function immref(arg) {
    if (typeof arg == 'number') return `${arg}`
    if (typeof arg == 'string') return JSON.stringify(arg)
    if ('reg' in arg) return `_main::_init::r${arg.reg}`
    if ('glob' in arg) return `_main::_globals::${arg.glob}`
    if ('blox' in arg) return arg.blox
    console.log(`error: no rtti support rn!`)
    process.exit(2)
}

 function generateCode(unit, writeCode) {
    const afterBlock = new Map()
    let blocks = _optimizer.orderBlocks.call(void 0, unit.blocks, unit.startBlock)
    // run optimization passes 8 times
    for (let i = 0;i < 8;i++) blocks = _optimizer.optimize.call(void 0, unit, blocks)
    if (_middlegen.options.dumpSsa) {
        _middlegen.dumpSSA.call(void 0, unit, blocks)
        return
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
    for (const blk of blocks) {
        const id = blookup(blk)
        code.push(`_main::_init.${id}:`)
        for (const op of blk.ops) {
            if (_middlegen.options.interleaveSsa)
                code.push(
                    `    # ${_middlegen.Opcode[op.op]} ${op.args
                        .map(e => _util.inspect.call(void 0, e, { breakLength: Infinity }))
                        .join(' ')}`
                )
            if (op.op == _middlegen.Opcode.TypeGlob || op.op == _middlegen.Opcode.TypeLoc) {
            } else if (op.op == _middlegen.Opcode.StGlob) {
                if (typeof op.args[1] == 'object' && 'reg' in op.args[1])
                    console.log(`warn: reverse binding for globals should occur!`)
                code.push(`    set _main::_globals::${op.args[0]} ${immref(op.args[1])}`)
            } else if (op.op == _middlegen.Opcode.Move) {
                code.push(`    set ${immref(op.args[0])} ${immref(op.args[1])}`)
            } else if (op.op == _middlegen.Opcode.LdGlob) {
                if (typeof op.args[1] == 'object' && 'reg' in op.args[1])
                    console.log(`warn: forward loadbinding for globals should occur!`)
                code.push(`    set ${immref(op.args[0])} _main::_globals::${op.args[1]}`)
            } else if (op.op == _middlegen.Opcode.BinOp) {
                code.push(
                    `    op ${op.args[1]} ${immref(op.args[0])} ${immref(op.args[2])} ${immref(
                        op.args[3]
                    )}`
                )
            } else if (op.op == _middlegen.Opcode.TargetOp) {
                const ops = {
                    'print.direct': () => `print ${op.args[1]}`,
                    'print.ref': () => `print ${immref(op.args[1])}`,
                    'print.flush': () => `printflush ${immref(op.args[1])}`,
                    _lookupblox: () => `set ${immref(op.args[1])} ${op.args[2]}`,
                }
                if (!(op.args[0] in ops)) console.log('op:', op.args[0])
                code.push(`    ${ops[op.args[0]]()}`)
            } else if (op.op == _middlegen.Opcode.End) {
                if (
                    _middlegen.options.noEnd &&
                    blocks[blocks.length - 1] == blk &&
                    blk.cond == _middlegen.JumpCond.Abort
                ) {
                    continue
                }
                code.push(`    end`)
                break
            } else {
                console.log(`error: unknown op:`, _middlegen.Opcode[op.op], ...op.args)
                process.exit(2)
            }
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
                const target = `_main::_init.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(`    jump ${target}`)
            } else code.push(`    # falls through`)
        } else if (blk.cond == _middlegen.JumpCond.TestBoolean) {
            if (!hasCons) {
                const target = `_main::_init.${blookup(blk.targets[0])}`
                usedlabels.add(target)
                code.push(`    jump ${target} notEqual 0 ${immref(blk.condargs[0])} # consequent`)
            } else {
                code.push(`    # consequent (eliminated)`)
            }
            if (!hasAlt) {
                const target = `_main::_init.${blookup(blk.targets[1])}`
                usedlabels.add(target)
                code.push(`    jump ${target} equal 0 ${immref(blk.condargs[0])} # alternate`)
            } else {
                code.push(`    # alternate (eliminated)`)
            }
        } else if (blk.cond == _middlegen.JumpCond.Abort) {
            if (!_middlegen.options.noSafeAbort) code.push(`    op sub @counter @counter 1 # abort`)
            else code.push(`    # abort!`)
        } else {
            code.push(`    # branch: ${_middlegen.JumpCond[blk.cond]}`)
        }
    }
    if (_middlegen.options.stripComments) {
        code = code.map(line => line.split('#')[0]).filter(e => e.trim())
    }
    if (_middlegen.options.eliminateBranches) {
        code = code.filter(e => !(e.endsWith(':') && !usedlabels.has(e.slice(0, -1))))
    }
    writeCode(code.join('\n'))
} exports.generateCode = generateCode;
