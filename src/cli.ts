import { readFileSync } from 'fs'
import { checkForMixin, loadPlugin } from './plugins'
import { compileCode } from './qlxemit'

let paramCallback: null | ((s: string) => void)
let inp: string | null = null
let out: string | null = null
let decode_trace: string = null

for (const arg of process.argv.slice(2)) {
    if (paramCallback) {
        paramCallback(arg)
        paramCallback = null
        continue
    }

    if (arg == '--plugin') {
        paramCallback = plg => {
            loadPlugin(plg)
        }
        continue
    }
    if (arg.startsWith('--plugin=')) {
        loadPlugin(arg.slice(9))
        continue
    }

    if (arg == '-o' || arg == '--output') {
        paramCallback = theout => {
            out = theout
        }
        continue
    }
    if (arg.startsWith('-o') || arg.startsWith('--output=')) {
        out = arg.slice(arg[1] == '-' ? 9 : 2)
        continue
    }
    if (arg == '--decode') {
        paramCallback = theout => {
            decode_trace = theout
        }
        continue
    }
    if (arg.startsWith('--decode=')) {
        decode_trace = arg.slice(9)
        continue
    }

    if (inp) {
        console.log('error: multiple inputs!')
        process.exit(1)
    }
    inp = arg
}

if (!inp) {
    console.log('error: no input!')
    process.exit(1)
}

if (decode_trace) {
    if (!out) {
        console.log('error: cannot read mapfiles without output!')
        process.exit(1)
    }
    if (
        checkForMixin<string, void>(
            '@qlx/cli:load-mapfile',
            readFileSync(out + '.map').toString()
        ) === false ||
        checkForMixin<string, void>('@qlx/cli:lookup-in-map', decode_trace) === false
    ) {
        console.log('error: cannot file mapfile mixins!')
        process.exit(1)
    }
    process.exit(0)
}

if (out) compileCode(inp, out)
else compileCode(inp)
