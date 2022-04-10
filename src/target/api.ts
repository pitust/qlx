import { MindustryProgram } from './mlog/MindustryProgram'
import { TestNativeProgram } from './mlog/TestProgram'
import { Program } from './targen'

export function createProgram(): Program {
    if (process.env.QLX_EXPERIMANTAL_NATIVE == 'yes') return new TestNativeProgram()
    return new MindustryProgram()
}
