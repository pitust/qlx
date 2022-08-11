import { checkAllTypes } from './typechk'
import { generateSSA, options, dumpSSA, Opcode } from './middlegen'
import { generateCode } from './codegen'
import { generateCode as gen2_generateCode } from './codegen2'
import { readFileSync, writeFileSync } from 'fs'
import { Options } from './options'
import { buildProgram, buildUnit } from './gen-prg'
import { parseprogram } from './parseqlx'
import { parse as parseprogramv2, parseasm as parseasmv2 } from './parser2'
import { dumpAstNode } from './dumpast'
import { finalizeColors } from './target/highlight'

export function onCLIParseComplete(o: Options, input: string, output: string | null) {
    Object.assign(options, o)
    if (options.max) {
        options.noEnd = true
        options.bindLoads = true
        options.noSafeAbort = true
        options.eliminateBranches = true
        options.rawArgRefs = true
        options.reorderBlocks = true
        options.constProp = true
        options.eliminateDeadCode = true
        options.inline = true
        options.mergePrint = true
        options.mergeBlocks = true
        options.max = true
    }
    if (!options.frontend_modern && !options.frontend_qlxasm && !options.frontend_legacy) {
        options.frontend_modern = true
    }

    const ast = options.frontend_modern
        ? parseprogramv2(input, readFileSync(input).toString())
        : options.frontend_qlxasm
        ? parseasmv2(input, readFileSync(input).toString())
        : parseprogram(readFileSync(input).toString())
    if (options.dump_ast) dumpAstNode(ast)

    const writeCode = (code: string) => (output ? writeFileSync(output, code) : console.log(code))
    const u = generateSSA(ast)
    if (options.dump_freshSsa) {
        dumpSSA(u[0])
        for (const [, p] of u[1]) dumpSSA(p)
    }
    if (options.frontend_qlxasm) {
        console.log(finalizeColors(u[0].startBlock.ops.filter(e => e.op == Opcode.Asm).map(e => <string>e.args[0]).map(e => e.endsWith(':')?e:'    '+e)))
        process.exit(1)
    }
    if (!checkAllTypes(u)) {
        console.log('fatal error: type check failed; exiting')
        process.exit(1)
    }
    if (options.prg) buildProgram(u)
    else if (options.gen2) gen2_generateCode(u, writeCode)
    else generateCode(u, writeCode)
    // goodbye, qlxemit
    // it was not that bad
    //     compileCode(input, writeCode)
}
