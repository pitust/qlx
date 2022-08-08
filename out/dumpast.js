"use strict";Object.defineProperty(exports, "__esModule", {value: true});

 function dumpAstNode(n, pre = '', pre2 = '') {
    if (
        n.children.length ==
        n.children.filter(e => typeof e == 'string' || ('children' in n && n.children.length == 0)).length
    ) {
        console.log(
            `${pre}\x1b[32m${n.type}\x1b[0m`,
            ...n.children.map(e =>
                typeof e == 'string' ? `\x1b[34m'${e}'\x1b[0m` : `\x1b[33m${(e ).type}\x1b[0m`
            )
        )
    } else {
        console.log(`${pre}\x1b[31m${n.type}\x1b[0m`)
        for (const nn of n.children) {
            if (typeof nn == 'string') {
                console.log(`${pre} \x1b[34m'${nn}'\x1b[0m`)
                pre = pre2
            } else if (nn instanceof Array) {
                for (const nnn of nn) {
                    if (typeof nnn == 'string') {
                        console.log(`${pre} \x1b[34m - '${nn}'\x1b[0m`)
                    } else {
                        dumpAstNode(nnn, pre + ' - ', pre2 + '   ')
                    }
                    pre = pre2
                }
            } else {
                dumpAstNode(nn, pre + ' ', pre2 + ' ')
            }
        }
    }
} exports.dumpAstNode = dumpAstNode;
