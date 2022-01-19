export enum Opcode {
    LdGlob,
    StGlob,
    LdLoc,
    AliasLoc,
    StLoc,
    Call,
    MathOp,
    TargetOp,
}
export enum JumpCond {
    Always,
    LessThan, GreaterThan, LessEqual, GreaterEqual,
    Equal, NotEqual
}
type OpArg = string | number | { reg: number }
export interface SSAOp {
    op: Opcode
    args: OpArg[]
}
export interface SSABlock {
    ops: SSAOp[]
    cond: JumpCond
    condargs: OpArg[]
    targets: [SSABlock] | [SSABlock, SSABlock]
}