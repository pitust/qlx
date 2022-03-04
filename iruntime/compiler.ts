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
                    tk.push('"')
                    mode = 2
                }
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
        opcodes.push(tk)
    }
    return { opcodes, symbolMap }
}

function compile<VMValue>(srccode: string) {
    let js = ''
    const { opcodes, symbolMap } = parseCode(srccode)
    function emit(s: string) {
        js += s
    }

    let pc = 0
    function afterRunOp() {
        emit(`if(--ipt)return {pc,vars};break;`)
        pc++
    }

    emit(`while(1)switch(pc++){`)
    for (const opline of opcodes) {
        emit(`case ${pc}:`)
        const opc = opline[0]
        const args = opline.slice(1).map(e => {
            if (/^@?[a-zA-Z0-9_:\.]+$/.test(e)) return `vars.get('${e}')`
            if (/^".+"$/.test(e)) return `${JSON.stringify(JSON.parse(e))}`
            if (/^[0-9\.]+$/.test(e)) return `${e}`
            err('bad arg ' + e)
        })
        const a0 = args[0],
            a1 = args[1],
            a2 = args[2]
        const handlers = {
            print: () => `vmcb.p(${a0});`,
            printflush: () => `vmcb.pf(${a0});`,
            jump: () =>
                `if(vmcb.c_${opline[2]}(${args.slice(2)},0,0,0))pc=${
                    symbolMap.get(opline[1]) ?? 0
                };`,
            op: () => `vars.set(${args[2]},vmcb.o_${args[1]}(${args.slice(3)},0,0))`,
            set: () => `vars.set(${args[2]},)`
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
        },
        opcodesToRun: number
    ) => { pc: number; vars: Map<string, VMValue> }
}

const rt = compile<number | string>(
    `
    # compiled by qlx
    set _main::_init::i 3          # input.qlx:1:1      | let i = 3
    # falls through
_main::_init.b_0:
    print _main::_init::i          # input.qlx:3:5      |     print i
    printflush message1            # input.qlx:4:5      |     printflush @message1
    op add r3 1 _main::_init::i    # input.qlx:5:9      |     i = + 1 i
    set _main::_init::i r3         # input.qlx:5:5      |     i = + 1 i
    jump _main::_init.b_0`
)
let pc = 0
const vars = new Map<string, number | string>()
let printbuffer = ''
vars.set('message1', 'message1')
while (true) {
    const res = rt(
        pc,
        vars,
        {
            p(str) {
                printbuffer += `${str}`
            },
            pf(obj) {
                for (const printbufferline of printbuffer.split('\n')) {
                    console.log(`\x1b[0;30m${obj}\x1b[0m ${printbufferline}`)
                }
                printbuffer = ''
            },
            c_always: () => true
        },
        1
    )
    pc = res.pc
}
