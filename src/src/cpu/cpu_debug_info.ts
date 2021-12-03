/**
 * CPU Debug structure
 */
export default interface CpuDebugInfo {
    offset: number,
    offsetFormatted: string,
    bytes: number,
    opCode: number,
    opCodeFormatted: string,
    instruction: string,
    operand: number,
    operandSigned: number,
    operandFormatted: string,
    raw: Array<number>,
    rawFormatted: string,
    regPC: number,
    regPCFormatted: string,
    regSP: number,
    regSPFormatted: string,
    regA: number,
    regAFormatted: string,
    regX: number,
    regXFormatted: string,
    regY: number,
    regYFormatted: string,
    processorStatus: string,
    registersDebug: string,
    memory: number | null,
    memoryFormatted: string,
    disassembly: string,
    complete: string
}
