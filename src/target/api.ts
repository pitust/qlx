import { MindustryProgram } from './mlog/MindustryProgram'
import { NativeProgram } from './mlog/NativeProgram'
import { Program } from './targen'

export function createProgram(): Program {
    if (process.env.QLX_EXPERIMANTAL_NATIVE == 'yes') return new NativeProgram()
    return new MindustryProgram()
}
