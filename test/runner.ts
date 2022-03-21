import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { createContext, runInContext } from 'vm'
import { compile } from '../iruntime/compiler'
import { createRuntime } from '../iruntime/runtime'

function dotest(test: string, cflags: string) {
    console.log('[TEST]', test, cflags)
    const testHarness = readFileSync(`test/${test}/main.qlx`)
        .toString()
        .split('\n')
        .filter(e => e.startsWith('// > '))
        .map(e => e.slice(5))
        .join('\n')

    const output: [number, string][] = []
    let ctime = 0,
        evaltime = 0
    const rt = createRuntime(out => {
        output.push([evaltime, out])
    })
    let pc = 0,
        vars = new Map<string, string | number>()
    vars.set('qlxconsole', 'qlxconsole')
    let mlog: string
    try {
        mlog = execSync(`node ${__dirname}/../out/qlx test/${test}/main.qlx ${cflags}`).toString()
    } catch {
        scorecard.push(`\x1b[31;1m- ${test} ${cflags}\x1b[0m`)
        return
    }
    const func = compile(mlog)
    let success = true
    const ctx = createContext({
        run(ticks: number, ipt: number) {
            while (ticks > 0) {
                ticks -= ipt
                const newstate = func(pc, vars, rt, ipt)
                vars = newstate.vars
                pc = newstate.pc
                evaltime += ipt
            }
        },
        time<T>(cb: () => T): T {
            let t1 = ctime
            const r = cb()
            if (process.env.QLX_TEST_TIME != 'no')
                console.log('[TIME] test took %o ticks', ctime - t1)
            return r
        },
        expect(s: string) {
            const inp = output.shift()
            if (!inp) {
                if (process.env.QLX_TEST_FAIL_WHY == 'yes')
                    console.error('[TEST] failed: out of input')
                success = false
                return
            }
            if (inp[1] != s) {
                if (process.env.QLX_TEST_FAIL_WHY == 'yes')
                    console.error(`[TEST] outut wrong: got %o, expected %o`, inp[1], s)
                success = false
            }
            ctime = inp[0]
        },
    })

    runInContext(testHarness, ctx, { filename: 'testharness.js' })
    if (success) scorecard.push(`\x1b[32;1m+ ${test} ${cflags}\x1b[0m`)
    else scorecard.push(`\x1b[31;1m- ${test} ${cflags}\x1b[0m`)
}

const args = process.argv.slice(2)
// run tests!
if (args.length == 0) {
    console.log('Usage: qlx-test <test>')
}
const scorecard: string[] = []
for (const test of args) {
    dotest(test, '')
    dotest(test, '-fprg')
    dotest(test, '-fmax')
    dotest(test, '-fgen2')
    dotest(test, '-fgen2 -fmax')
}
for (const score of scorecard) console.log(score)
