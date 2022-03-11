export interface Options {
    target: string
    bindLoads: boolean
    cgOutput_suppress: boolean
    constProp: boolean
    dump_ast: boolean
    dump_freshSsa: boolean
    dump_prgDfg: boolean
    dump_prgDfgExpandvars: boolean
    dump_ssaPreEmit: boolean
    dump_ssaPreOpt: boolean
    eliminateBranches: boolean
    eliminateDeadCode: boolean
    forward: boolean
    inline: boolean
    interleaveSsa: boolean
    max: boolean
    mergeBlocks: boolean
    mergePrint: boolean
    noEnd: boolean
    noSafeAbort: boolean
    prg: boolean
    rawArgRefs: boolean
    reorderBlocks: boolean
    stripComments: boolean
}