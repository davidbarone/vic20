import ProcessorStatus from "./processor_status";

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
export default interface Registers {

  /**
   * The program counter (16-bit)
   */
  PC: number;

  /**
   * The stack pointer (16-bit, only 8 bits used)
   */
  SP: number;

  /**
   * The accumulator (8-bit)
   */
  A: number;

  /**
   * The x-index register (8-bit)
   */
  X: number;

  /**
   * The y-index register (8-bit)
   */
  Y: number;

  /**
   * Processor status register (8-bit)
   */
  P: ProcessorStatus;
}