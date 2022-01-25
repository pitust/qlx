import { checkForMixin, loadPlugin } from './plugins'
import { checkAllTypes } from './typechk'
import { generateSSA, options, Options } from './middlegen'
import { generateCode } from './codegen'
import { readFileSync } from 'fs'
import { compileCode } from './qlxemit'

export function onCLIParseComplete(o: Options, input: string) {
    Object.assign(options, o)
    if (options.ssa) {
        const u = generateSSA(input)
        if (!checkAllTypes(u)) {
            console.log('fatal error: type check failed; exiting')
            process.exit(1)
        }
        generateCode(u)
    } else {
        compileCode(input)
    }
}
// if (out) compileCode(inp, out)
// else compileCode(inp)
