"use strict";Object.defineProperty(exports, "__esModule", {value: true});const outputs = {
    entry: [],
    functions: [],
}
 const emit = new Proxy({}, {
    get(_v, name) {
        return (str) => {
            if (!str.endsWith(':')) str = '    '  + str
            outputs[name ].push(str)
        }
    }
}); exports.emit = emit
 function gather() {
    const o = []
    for (let k of Object.values(outputs)) {
        for (let v of k) o.push(v)
    }
    return o.join('\n')
} exports.gather = gather;