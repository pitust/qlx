import { checkForMixin, loadPlugin } from './plugins'
import { checkAllTypes } from './typechk'
import { generateSSA, options, Options, dumpSSA } from './middlegen'
import { generateCode } from './codegen'
import { readFileSync, writeFileSync } from 'fs'
import { compileCode } from './qlxemit'

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
    if (options.ssa) {
        const u = generateSSA(input)
        if (options.dump_freshSsa) {
            dumpSSA(u[0])
        }
        if (!checkAllTypes(u)) {
            console.log('fatal error: type check failed; exiting')
            process.exit(1)
        }
        generateCode(u, writeCode)
    } else {
        compileCode(input, writeCode)
    }
}
// if (out) compileCode(inp, out)
// else compileCode(inp)
