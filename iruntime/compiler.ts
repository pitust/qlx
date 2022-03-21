function err(e: string) {
    console.log('\x1b[31;1merror\x1b[0m %s', e)
    process.exit(1)
}
function parseCode(s: string) {
    const lines = s
        .split('\n')
        .map(e => e.trim())
        .filter(e => e)

    const opcodes: string[][] = []
    const symbolMap = new Map<string, number>()
    for (const line of lines) {
        const pc = opcodes.length
        let tk: string[] = []
        let mode = 0
        for (const c of line) {
            if (mode == 0) {
                tk.push('')
                mode = 1
            }
            if (c == ' ' && tk[tk.length - 1] == '' && mode == 1) continue
            if (c == ' ' && mode == 1) {
                tk.push('')
                continue
            }
            if (c == '"') {
                if (mode == 1) {
                    if (tk[tk.length - 1] != '') err('bad string literal')
                    tk[tk.length - 1] = '"'
                    mode = 2
                } else if (mode == 2) {
                    tk[tk.length - 1] += '"'
                    tk.push('')
                    mode = 1
                } else if (mode == 3) {
                    tk[tk.length - 1] += '"'
                    mode = 2
                }
                continue
            }
            if (mode == 3) {
                tk[tk.length - 1] += c
                mode = 2
                continue
            }
            if (c == '\\' && mode == 2) {
                tk[tk.length - 1] += '\\'
                mode = 3
                continue
            }
            if (c == '#') break
            tk[tk.length - 1] += c
            if (mode == 3) mode = 2
        }
        if (tk.length == 1 && tk[0].endsWith(':')) {
            // label
            symbolMap.set(tk[0].slice(0, -1), pc)
            continue
        }
        if (mode != 1) {
            err('unterminated string literal')
        }
        if (tk[tk.length - 1] == '') tk.pop()
        if (tk.length) opcodes.push(tk)
    }
    return { opcodes, symbolMap }
}

export function compile<VMValue extends number | string>(srccode: string) {
    let js = ''
    const { opcodes, symbolMap } = parseCode(srccode)
    function emit(s: string) {
        js += s
    }

    let pc = 0
    function afterRunOp() {
        emit(`if(!--ipt)return {pc,vars};break;`)
        pc++
    }

    emit(`while(1)switch(pc++){`)
    for (const opline of opcodes) {
        if (!opline.length) continue
        emit(`case ${pc}:`)
        const opc = opline[0]
        const args = opline.slice(1).map(e => {
            if (/^[0-9\.]+$/.test(e)) return `${e}`
            if (/^@?[a-zA-Z0-9_:\.]+$/.test(e)) return `vars.get('${e}')`
            if (/^".+"$/.test(e)) return `${JSON.stringify(JSON.parse(e))}`
            err('bad arg ' + e)
        })
        const a0 = args[0],
            a1 = args[1],
            a2 = args[2]
        const handlers = {
            print: () => `vmcb.p(${a0});`,
            printflush: () => `vmcb.pf(${a0});`,
            jump: () =>
                `if(vmcb.c_${opline[2]}(${[...args.slice(1), 0, 0, 0].slice(2)}))pc=${
                    symbolMap.get(opline[1]) ?? 0
                };`,
            op: () => `vars.set("${opline[2]}",vmcb.o_${opline[1]}(${[...args.slice(2), 0, 0]}));`,
            set: () => `vars.set("${opline[1]}",${a1});`,
            end: () => `pc=0;`
        }
        emit(handlers[opc]())
        afterRunOp()
    }
    emit(`default:pc=0;}`)
    return new Function('pc', 'vars', 'vmcb', 'ipt', js) as (
        pc: number,
        vars: Map<string, VMValue>,
        vmcb: {
            p: (str: VMValue) => void
            pf: (str: VMValue) => void
            c_always: (a1: VMValue, a2: VMValue, a3: VMValue) => boolean
            c_notEqual: (a1: VMValue, a2: VMValue, a3: VMValue) => boolean
            c_equal: (a1: VMValue, a2: VMValue, a3: VMValue) => boolean
            o_add: (a1: VMValue, a2: VMValue) => VMValue
            o_equal: (a1: VMValue, a2: VMValue) => boolean
        },
        opcodesToRun: number
    ) => { pc: number; vars: Map<string, VMValue> }
}

const rt = compile<number | string>(
    `
    set _main::_init::i 3          
_main::_init.b_0:
    print _main::_init::i          
    print "\\n"                     
    printflush message1            
    op add r3 _main::_init::i 1    
    set _main::_init::i r3         
    jump _main::_init.b_0 always
    `
)
