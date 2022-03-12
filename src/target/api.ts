import { MindustryProgram } from './mlog/MindustryProgram'
import { Program } from './targen'

export function createProgram(): Program {
    return new MindustryProgram()
}
