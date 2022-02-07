"use strict"; function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } }var _plugins = require('../plugins');


var DumpRecordType; (function (DumpRecordType) {
    const LOCAL = 0; DumpRecordType[DumpRecordType["LOCAL"] = LOCAL] = "LOCAL";
    const GLOBAL = LOCAL + 1; DumpRecordType[DumpRecordType["GLOBAL"] = GLOBAL] = "GLOBAL";
})(DumpRecordType || (DumpRecordType = {}));






let dvariants = 0
let dvdata = new Map()
let dqdata = []
let adata = new Map()
_plugins.registerMixin('@qlx/parse:create-atom', ([name, id]) => {
    adata.set(id, name)
})
_plugins.registerMixin('@qlx/emit:late-intrinsics:_dbgdump/0', ctx => {
    const variant = dvariants++
    const stream = []
    ctx.emit(`print "dbg trace: ${variant}"`)
    for (const [name, ref] of ctx.ctx) {
        if (ref[0] == 'func') continue // skip functions
        ctx.emit('print "|/"')
        ctx.emit(
            `print ${
                _nullishCoalesce({
                    local: ref[1],
                }[ref[0]], () => ( '?'))
            }`
        )
        stream.push({
            name,
            type: ref[0].startsWith('local') ? DumpRecordType.LOCAL : DumpRecordType.GLOBAL,
        })
    }

    dqdata[variant] = '??'
    dvdata.set(variant, stream)

    return 'null'
})

_plugins.registerMixin('@qlx/cli:generate-mapfile', () => {
    return JSON.stringify([dqdata, Object.fromEntries(dvdata.entries()), Object.fromEntries(adata.entries())])
})
_plugins.registerMixin('@qlx/cli:load-mapfile', map => {
    const jm = JSON.parse(map)
    dqdata = jm[0]
    dvdata = new Map(Object.entries(jm[1]).map(a => [+a[0], a[1]]))
    adata = new Map(Object.entries(jm[2]).map(a => [+a[0], a[1]]))
})
_plugins.registerMixin('@qlx/cli:lookup-in-map', trace => {
    const entries = trace.split('|/')
    const id = +entries.shift()
    const records = dvdata.get(id)
    console.log('variables in scope for ' + dqdata[id])
    for (let i = 0; i < records.length; i++) {
        let label = '\x1b[0;30;1munknown'
        switch (records[i].type) {
        case DumpRecordType.LOCAL:
            label = '\x1b[30;1mlocal'
            break
        case DumpRecordType.GLOBAL:
            label = '\x1b[31;1mglobal'
            break
        }
        let note = ''
        if (adata.has(+entries[i])) {
            note += ` (\x1b[34;1m:${adata.get(+entries[i])}\x1b[0m)`
        }
        console.log(`${label} \x1b[32;1m${records[i].name}: \x1b[33;1m${entries[i]}\x1b[0m${note}`)
    }
})
