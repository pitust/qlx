"use strict";Object.defineProperty(exports, "__esModule", {value: true}); const outputs = {
    entry: [],
    functions: [],
}; exports.outputs = outputs
 const emit = new Proxy({}, {
    get(_v, name) {
        return (str) => {
            if (!str.endsWith(':')) str = '    ' + str
            exports.outputs[name ].push(str)
        }
    },
}); exports.emit = emit
 function gather() {
    const o = []
    for (let k of Object.values(exports.outputs)) {
        for (let v of k) o.push(v)
    }
    return o.join('\n')
} exports.gather = gather;
