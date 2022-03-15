const zlib = require('zlib')
let dat = Buffer.from('bXNjaAF4nGNgZABB/tzM5KJ83YKi/OTU4uL8IgYGoCAI8AGxS8Wc5JSEBAN9jVNntAMDtPzOeZwNPeFxxlvPy0fb0zfQY1WIxgkdTV29wEdM2p6nNXXPBZzw1dXz8/E3fcKUlcrAMItfJJ0BAOnhHvM=', 'base64')
const magic = [0x6d, 0x73, 0x63, 0x68]

for (let i = 0; i < 4; i++) {
    if (dat[i] != magic[i]) {
        console.log('err: bad magic!')
        process.exit(1)
    }
}
if (dat[4] != 1) err('bad ver!')
function err(e) {
    console.log('err:', e)
    process.exit(1)
}
let data = zlib.inflateSync(dat.slice(5))
let offset = 0
function u16() {
    offset += 2
    return data.readUint16BE(offset - 2)
}
function i32() {
    offset += 4
    return data.readInt32BE(offset - 4)
}
function u8() {
    return data[offset++]
}
function str() {
    const len = u16()
    offset += len
    return data.slice(offset - len, offset).toString()
}
function bytes(len) {
    offset += len
    return data.slice(offset - len, offset)
}

const w = u16(), h = u16()

const tagcount = u8()
const tags = new Map()

for (let i = 0;i < tagcount;i++) {
    tags.set(str(), str())
}

const blockcount = u8()
const blocks = []

for (let i = 0;i < blockcount;i++) {
    blocks.push(str())
}

const tilecount = i32()
const tiles = []
for (let i = 0;i < tilecount;i++) {
    const block = blocks[u8()]
    const pos = i32()
    console.log(pos, block)
    
    const payloadKind = u8()
    console.log(data.slice(offset).toString('base64'))
    if (payloadKind == 14) {
        const len = i32()
        const data2 = zlib.inflateSync(bytes(len))
        console.log('heh', data2.toString('base64'))
    } else {
        err('todo: typeio of type ' + payloadKind)
    }
}

console.log(tilecount)
