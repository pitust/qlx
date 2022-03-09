import path from 'path'

const mixins = new Map<string, any>()

export function checkForMixin<T, U>(s: string, t: T): false | U {
    if (!mixins.has(s)) return null
    return mixins.get(s)!(t)
}

export function registerMixin<T, U>(mixin: string, cb: (arg: T) => U) {
    if (mixins.has(mixin)) {
        console.log('Error: mixin conflict: %s redeclared', mixin)
        process.exit(1)
    }
    mixins.set(mixin, cb)
}

function applyPlg(p: any) {
    p && p.load && p.load()
}

export function loadPlugin(name: string) {
    try {
        applyPlg(require(name))
    } catch {
        applyPlg(require(path.join(process.cwd(), name)))
    }
}
