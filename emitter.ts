const outputs = {
    entry: <string[]>[],
    functions: <string[]>[],
}
export const emit = new Proxy<Record<keyof typeof outputs, (s: string) => void>>(<any>{}, {
    get(_v, name) {
        return (str: string) => {
            if (!str.endsWith(':')) str = '    '  + str
            outputs[<string>name].push(str)
        }
    }
})
export function gather(): string {
    const o: string[] = []
    for (let k of Object.values(outputs)) {
        for (let v of k) o.push(v)
    }
    return o.join('\n')
}