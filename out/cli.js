"use strict";var _fs = require('fs');
var _plugins = require('./plugins');
var _qlxemit = require('./qlxemit');

let paramCallback
let inp = null
let out = null
let decode_trace = null

for (const arg of process.argv.slice(2)) {
    if (paramCallback) {
        paramCallback(arg)
        paramCallback = null
        continue
    }

    if (arg == '--plugin') {
        paramCallback = plg => {
            _plugins.loadPlugin.call(void 0, plg)
        }
        continue
    }
    if (arg.startsWith('--plugin=')) {
        _plugins.loadPlugin.call(void 0, arg.slice(9))
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
        _plugins.checkForMixin(
            '@qlx/cli:load-mapfile',
            _fs.readFileSync.call(void 0, out + '.map').toString()
        ) === false ||
        _plugins.checkForMixin('@qlx/cli:lookup-in-map', decode_trace) === false
    ) {
        console.log('error: cannot file mapfile mixins!')
        process.exit(1)
    }
    process.exit(0)
}

if (out) _qlxemit.compileCode.call(void 0, inp, out)
else _qlxemit.compileCode.call(void 0, inp)
