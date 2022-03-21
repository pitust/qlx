export function createRuntime(onOutput: (o: string) => void) {
    let printbuffer = ''
    return {
        p(str: string | number) {
            printbuffer += `${str}`
        },
        pf(obj: string | number) {
            onOutput(printbuffer)
            printbuffer = ''
        },
        c_always: () => true,
        c_notEqual: (a: string | number, b: string | number) => a != b,
        c_equal: (a: string | number, b: string | number) => a == b,
        o_add(a: string | number, b: string | number) {
            return +a + +b
        },
        o_equal(a: string | number, b: string | number) {
            return a == b
        },
    }
}
