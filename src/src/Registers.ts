// **********************************
// CPU Registers
//
// PC = program counter (16-bit)
// SP = stack pointer (16-bit, only 8 bits used)
// A = accumulator (8-bit)
// X = x-index register (8-bit)
// Y = y-index register (8-bit)
// P = processor status register (8-bit)
// **********************************
interface Registers {
    PC: number;
    SP: number;
    A: number;
    X: number;
    Y: number;
    P: number
  }