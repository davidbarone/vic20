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

class cpu6502 {
  Memory: Memory;
  Registers: Registers;

  constructor(
    memory: Memory
  ) {
    this.Memory = memory;
    this.Registers = {
      PC: 0,
      SP: 0,
      A: 0,
      X: 0,
      Y: 0,
      P: 0
    }
  }

  // **********************************
  // Instruction set
  // 
  // The 6502 has 56 different instructions
  // and 13 addressing modes.
  // The 56 instructions are:
  //
  // Arithmetic / Logic Instructions:
  // --------------------------------
  // ADC - Add with carry
  // AND - Bitwise AND with accumulator
  // ASL - Arithmetic shift left
  // BIT - Test bits
  // CMP - Compare accumulator
  // CPX - Compare X register
  // CPY - Compare Y register
  // DEC - Decrement memory
  // EOR - Bitwise exclusive OR
  // INC - Increment memory
  // LSR - Logical shift right
  // NOP - No operation
  // ORA - Bitwise OR with accumulator
  // ROL - Rotate left
  // ROR - Rotate right
  // SBC - Subtract with carry
  //
  // Loading Instructions:
  // ---------------------
  // LDA - Load accumulator
  // LDX - Load X register
  // LDY - Load Y register
  //
  // Store Instructions:
  // ---------------------
  // STA - Store accumulator
  // STX - Store X register
  // STY - Store Y register
  //
  // Branching Instructions:
  // -----------------------
  // BPL - Branch on plus
  // BMI - Branch on minus
  // BVC - Branch on overflow clear
  // BVS - Branch on overflow set
  // BCC - Branch on carry clear
  // BCS - Branch on carry set
  // BNE - Branch on not equal
  // BEQ - Branch on equal
  //
  // Jump Instructions:
  // ------------------
  // JMP - Jump
  // JSR - Jump to subroutine
  // RTI - Return from interrupt
  // RTS - Return from subroutine
  // BRK - Break
  //
  // Flag Instructions:
  // ------------------
  // CLC - Clear carry
  // SEC - Set carry
  // CLI - Clear interrupt
  // SEI - Set interrupt
  // CLV - Clear overflow
  // CLD - Clear decimal
  // SED - Set decimal
  //
  // Register Instructions:
  // ----------------------
  // TAX - Transfer A to X
  // TXA - Transfer X to A
  // DEX - Decrement X
  // INX - Increment X
  // TAY - Transfer A to Y
  // TYA - Transfer Y to A
  // DEY - Decrement Y
  // INY - Increment Y
  //
  // Stack Instructions:
  // -------------------
  // TXS - Transfer X to SP
  // TSX - Transfer SP to X
  // PHA - Push accumulator
  // PLA - Pull accumulator
  // PHP - Push P (flags)
  // PLP - Pull P (flags)

  // Information on 6502 instructions:
  // ---------------------------------
  // https://www.masswerk.at/6502/6502_instruction_set.html
  // http://nparker.llx.com/a2/opcodes.html


}

export default cpu6502;
