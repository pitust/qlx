const { SmartBuffer } = require('smart-buffer')
const zlib = require('zlib')
const sm3 = new SmartBuffer()
const sm2 = new SmartBuffer()
const sm = new SmartBuffer()

sm.writeUInt32BE(0x6d736368) // magic
sm.writeUInt8(1) // ver

function u8(i) {
    sm2.writeUInt8(i)
}
function u16(i) {
    sm2.writeUInt16BE(i)
}
function u32(i) {
    sm2.writeUInt32BE(i)
}
function str(s) {
    u16(s.length)
    sm2.writeString(s)
}

u16(1) // 1 width
u16(1) // 1 height
u8(0) // no tags
u8(1) // one block
str('micro-processor') // the block is a microproc
u32(1) // one tile
u8(0) // blockid 0, microproc
u32(0) // pos 0, idfk
u8(14) // typeid 14, binary data

const logic = `
print "schem hancrafted by pitust"
printflush message1
`.trim() + '\n'

// now comes the payload: deflated logic data
sm3.writeUInt8(1) // magic byte (?)
sm3.writeUInt16BE(0) // idk, links? data length low bits??
sm3.writeUInt16BE(logic.length) // data length
sm3.writeString(logic) // data
sm3.writeUInt32BE(0) // idk, links?

const raw = zlib.deflateSync(sm3.toBuffer())
sm2.writeUInt32BE(raw.length)
sm2.writeBuffer(raw) // they really like zlib
u8(0) // rotation 0
sm.writeBuffer(zlib.deflateSync(sm2.toBuffer())) // like why, zlib(zlib(data)) makes no sense

console.log(sm.toBuffer().toString('base64'))

