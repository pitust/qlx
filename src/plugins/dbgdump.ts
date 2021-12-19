import { registerMixin } from '../plugins'
import { ICompilerCallContext } from '../qlxemit'

enum DumpRecordType {
    LOCAL,
    GLOBAL,
}

interface IDumpRecord {
    name: string
    type: DumpRecordType
}

let dvariants = 0
let dvdata = new Map<number, IDumpRecord[]>()
let dqdata: string[] = []
let adata = new Map<number, string>()
registerMixin<[string, number], void>('@qlx/parse:create-atom', ([name, id]) => {
    adata.set(id, name)
})
registerMixin<ICompilerCallContext, string>('@qlx/emit:late-intrinsics:_dbgdump/0', ctx => {
    const variant = dvariants++
    const stream: IDumpRecord[] = []
    ctx.emit(`print "dbg trace: ${variant}"`)
    for (const [name, ref] of ctx.ctx) {
        if (ref[0] == 'func') continue // skip functions
        ctx.emit('print "|/"')
        ctx.emit(
            `print ${
                {
                    local: ref[1],
                }[ref[0]] ?? '?'
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

registerMixin<null, string>('@qlx/cli:generate-mapfile', () => {
    return JSON.stringify([dqdata, Object.fromEntries(dvdata.entries()), Object.fromEntries(adata.entries())])
})
registerMixin<string, void>('@qlx/cli:load-mapfile', map => {
    const jm = JSON.parse(map)
    dqdata = jm[0]
    dvdata = new Map(Object.entries(jm[1]).map(a => [+a[0], <IDumpRecord[]>a[1]]))
    adata = new Map(Object.entries(jm[2]).map(a => [+a[0], <string>a[1]]))
})
registerMixin<string, void>('@qlx/cli:lookup-in-map', trace => {
    const entries = trace.split('|/')
    const id = +entries.shift()
    const records = dvdata.get(id)
    console.log('variables in scope for ' + dqdata[id])
    for (let i = 0; i < records.length; i++) {
        let label = '\x1b[0;30;1munkown'
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
