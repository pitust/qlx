export function ice(n: string): never {
    console.log('ICE: %s', n)
    process.exit(1)
}
