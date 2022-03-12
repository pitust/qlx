import { ast } from './parseqlx'

export function dumpAstNode(n: ast, pre = '') {
    if (
        n.children.length ==
        n.children.filter(e => typeof e == 'string' || e.children.length == 0).length
    ) {
        console.log(
            `${pre}\x1b[32m${n.type}\x1b[0m`,
            ...n.children.map(e =>
                typeof e == 'string' ? `\x1b[34m'${e}'\x1b[0m` : `\x1b[33m${e.type}\x1b[0m`
            )
        )
    } else {
        console.log(`${pre}\x1b[31m${n.type}\x1b[0m`)
        for (const nn of n.children) {
            if (typeof nn == 'string') {
                console.log(`${pre} \x1b[34m'${nn}'\x1b[0m`)
            } else {
                dumpAstNode(nn, pre + ' ')
            }
        }
    }
}
