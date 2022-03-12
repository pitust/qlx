import { checkAllTypes } from './typechk'
import { generateSSA, options, dumpSSA } from './middlegen'
import { generateCode } from './codegen'
import { generateCode as gen2_generateCode } from './codegen2'
import { writeFileSync } from 'fs'
import { Options } from './options'
import { buildProgram } from './gen-prg'

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
    const writeCode = (code: string) => (output ? writeFileSync(output, code) : console.log(code))
    const u = generateSSA(input)
    if (options.dump_freshSsa) {
        dumpSSA(u[0])
        for (const [, p] of u[1]) dumpSSA(p)
    }
    if (!checkAllTypes(u)) {
        console.log('fatal error: type check failed; exiting')
        process.exit(1)
    }
    if (options.prg) buildProgram(u[0])
    else if (options.gen2) gen2_generateCode(u, writeCode)
    else generateCode(u, writeCode)
    // goodbye, qlxemit
    // it was not that bad
    //     compileCode(input, writeCode)
}
