import { MindustryProgram } from './mlog/MindustryProgram'
import { NativeProgram } from './mlog/NativeProgram'
import { TestNativeProgram } from './mlog/TestProgram'
import { Program } from './targen'

export function createProgram(): Program {
    if (process.env.QLX_EXPERIMANTAL_NATIVE == 'test') return new TestNativeProgram()
    if (process.env.QLX_EXPERIMANTAL_NATIVE == 'yes') return new NativeProgram()
    return new MindustryProgram()
}
