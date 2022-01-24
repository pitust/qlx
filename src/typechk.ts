import { SSABlock, SSAUnit, Type } from './middlegen'

interface CachedTypecheck {
    localTypes: Map<number, Type>
    didCheck: boolean
}

type CheckCache = Set<CachedTypecheck>

const checkedBlocks = new WeakMap<SSABlock, CheckCache>()

function sameType(t1: Type, t2: Type) {
    return t1 == t2
}
function continueBlockCheck(block: SSABlock, entryTypes: Map<number, Type>) {
    if (checkedBlocks.has(block)) {
        next_check: for (const check of checkedBlocks.get(block)) {
            if (check.localTypes.size != entryTypes.size) continue
            for (const [lid, ty] of [...check.localTypes.entries()]) {
                if (!entryTypes.has(lid) || !sameType(entryTypes.get(lid), ty)) continue next_check
            }
            // block is already checked!
            console.log('block is in cache!')
            return
        }
    }
    for (const op of block)
}

export function checkAllTypes(unit: SSAUnit) {
    continueBlockCheck(unit.startBlock, new Map<number, Type>())
}
