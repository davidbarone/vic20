  // **********************************
  //
  // ==========
  // Cpu6502.ts
  // ==========
  // 
  // The 6502 has 56 different instructions and 13 addressing modes. There are 151 defined op codes.
  //
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
  //
  // =============================================================================
  // Addressing Modes (https://www.masswerk.at/6502/6502_instruction_set.html#DEX)
  // =============================================================================
  // 
  // Key   Mode                Example     Description
  // ----- ------------------- ----------- -------------------------------------------------------------
  // A     Accumulator         OPC A       operand is AC (implied single byte instruction)
  // abs   absolute            OPC $LLHH   operand is address $HHLL *
  // abs,X absolute, X-indexed OPC $LLHH,X operand is address; effective address is address incremented by X with carry **
  // abs,Y absolute, Y-indexed OPC $LLHH,Y operand is address; effective address is address incremented by Y with carry **
  // #     immediate           OPC #$BB    operand is byte BB
  // impl  implied             OPC         operand implied
  // ind   indirect            OPC ($LLHH) operand is address; effective address is contents of word at address: C.w($HHLL)
  // X,ind X-indexed, indirect OPC ($LL,X) operand is zeropage address; effective address is word in (LL + X, LL + X + 1), inc. without carry: C.w($00LL + X)
  // ind,Y indirect, Y-indexed OPC ($LL),Y operand is zeropage address; effective address is word in (LL, LL + 1) incremented by Y with carry: C.w($00LL) + Y
  // rel   relative            OPC $BB     branch target is PC + signed offset BB ***
  // zpg   zeropage            OPC $LL     operand is zeropage address (hi-byte is zero, address = $00LL)
  // zpg,X zeropage, X-indexed OPC $LL,X   operand is zeropage address; effective address is address incremented by X without carry **
  // zpg,Y zeropage, Y-indexed OPC $LL,Y   operand is zeropage address; effective address is address incremented by Y without carry **
  // 
  // *   16-bit address words are little endian, lo(w)-byte first, followed by the hi(gh)-byte.
  // (An assembler will use a human readable, big-endian notation as in $HHLL.)
  // 
  // **  The available 16-bit address space is conceived as consisting of pages of 256 bytes each, with
  // address hi-bytes represententing the page index. An increment with carry may affect the hi-byte
  // and may thus result in a crossing of page boundaries, adding an extra cycle to the execution.
  // Increments without carry do not affect the hi-byte of an address and no page transitions do occur.
  // Generally, increments of 16-bit addresses include a carry, increments of zeropage addresses don't.
  // Notably this is not related in any way to the state of the carry bit of the accumulator.
  // 
  // *** Branch offsets are signed 8-bit values, -128 ... +127, negative offsets in two's complement.
  // Page transitions may occur and add an extra cycle to the exucution.
  // --------------------------------------------------------------------------------------------------------------------------------------------------------
  //
  // ==============================
  // Op Code Size
  // ==============================
  //
  // - Op code = 8 bits long
  // - Generic form = AAABBCC. AAA and CC defined the op code. BBB defines addressing mode.
  // - Op code may require zero, one or two additional bytes for operands.
  // - Operand stored in little-endian format.
  //
  // =============
  // Bibliography:
  // =============
  //
  // https://www.masswerk.at/6502/6502_instruction_set.html
  // http://nparker.llx.com/a2/opcodes.html
  // http://visual6502.org/
  // http://6502.org/
  // http://6502.org/tutorials/
  // https://floooh.github.io/2019/12/13/cycle-stepped-6502.html
  // https://github.com/mattgodbolt/jsbeeb/blob/master/6502.opcodes.js
  //
  // **********************************

class cpu6502 {
  private Memory: Memory;
  private Registers: Registers;
  private StackBase = 0x100; // Base of stack

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
      P: new ProcessorStatus(0)
    }
  }

  reset(): void {
    this.Registers.A = 0;
    this.Registers.X = 0;
    this.Registers.Y = 0;
    this.Registers.SP = 0;
    this.Registers.PC = 0;
  }

	private push(value: number): void {
		this.Memory.Write(this.StackBase + this.Registers.SP, value);
    
    // SP loops round 8 bits
    this.Registers.SP = (this.Registers.SP - 1) & 0xFF;
	}
  
	private pop(): number {
		this.Registers.SP = (this.Registers.SP + 1) & 0xFF;
		return this.Memory.Read(this.StackBase + this.Registers.SP);
	}  

  private FetchInstruction(): number {
    let instruction = this.Memory.Read(this.Registers.PC);
    this.Registers.PC = (this.Registers.PC++) & 0xFFFF;
    return instruction;
  }

  // ---------------------------
  // Executes next op code
  // ---------------------------
  Execute() {

  }


  private opcodes6502Documented: { [key: number]: string } = {
    0x00: "BRK impl",
    0x01: "ORA X,ind",
    0x05: "ORA zpg",
    0x06: "ASL zpg",
    0x08: "PHP impl",
    0x09: "ORA #",
    0x0A: "ASL A",
    0x0D: "ORA abs",
    0x0E: "ASL abs",
    0x10: "BPL rel",
    0x11: "ORA ind,Y",
    0x15: "ORA zpg,X",
    0x16: "ASL zpg,X",
    0x18: "CLC impl",
    0x19: "ORA abs,Y",
    0x1D: "ORA abs,X",
    0x1E: "ASL abs,X",
    0x20: "JSR abs",
    0x21: "AND X,ind",
    0x24: "BIT zpg",
    0x25: "AND zpg",
    0x26: "ROL zpg",
    0x28: "PLP impl",
    0x29: "AND #",
    0x2A: "ROL A",
    0x2C: "BIT abs",
    0x2D: "AND abs",
    0x2E: "ROL abs",
    0x30: "BMI rel",
    0x31: "AND ind,Y",
    0x35: "AND zpg,X",
    0x36: "ROL zpg,X",
    0x38: "SEC impl",
    0x39: "AND abs,Y",
    0x3D: "AND abs,X",
    0x3E: "ROL abs,X",
    0x40: "RTI impl",
    0x41: "EOR X,ind",
    0x45: "EOR zpg",
    0x46: "LSR zpg",
    0x48: "PHA impl",
    0x49: "EOR #",
    0x4A: "LSR A",
    0x4C: "JMP abs",
    0x4D: "EOR abs",
    0x4E: "LSR abs",
    0x50: "BVC rel",
    0x51: "EOR ind,Y",
    0x55: "EOR zpg,X",
    0x56: "LSR zpg,X",
    0x58: "CLI impl",
    0x59: "EOR abs,Y",
    0x5D: "EOR abs,X",
    0x5E: "LSR abs,X",
    0x60: "RTS impl",
    0x61: "ADC X,ind",
    0x65: "ADC zpg",
    0x66: "ROR zpg",
    0x68: "PLA impl",
    0x69: "ADC #",
    0x6A: "ROR A",
    0x6C: "JMP ind",
    0x6D: "ADC abs",
    0x6E: "ROR abs",
    0x70: "BVS rel",
    0x71: "ADC ind,Y",
    0x75: "ADC zpg,X",
    0x76: "ROR zpg,X",
    0x78: "SEI impl",
    0x79: "ADC abs,Y",
    0x7D: "ADC abs,X",
    0x7E: "ROR abs,X",
    0x81: "STA X,ind",
    0x84: "STY zpg",
    0x85: "STA zpg",
    0x86: "STX zpg",
    0x88: "DEY impl",
    0x8A: "TXA impl",
    0x8C: "STY abs",
    0x8D: "STA abs",
    0x8E: "STX abs",
    0x90: "BCC rel",
    0x91: "STA ind,Y",
    0x94: "STY zpg,X",
    0x95: "STA zpg,X",
    0x96: "STX zpg,Y",
    0x98: "TYA impl",
    0x99: "STA abs,Y",
    0x9A: "TXS impl",
    0x9D: "STA abs,X",
    0xA0: "LDY #",
    0xA1: "LDA X,ind",
    0xA2: "LDX #",
    0xA4: "LDY zpg",
    0xA5: "LDA zpg",
    0xA6: "LDX zpg",
    0xA8: "TAY impl",
    0xA9: "LDA #",
    0xAA: "TAX impl",
    0xAC: "LDY abs",
    0xAD: "LDA abs",
    0xAE: "LDX abs",
    0xB0: "BCS rel",
    0xB1: "LDA ind,Y",
    0xB4: "LDY zpg,X",
    0xB5: "LDA zpg,X",
    0xB6: "LDX zpg,Y",
    0xB8: "CLV impl",
    0xB9: "LDA abs,Y",
    0xBA: "TSX impl",
    0xBC: "LDY abs,X",
    0xBD: "LDA abs,X",
    0xBE: "LDX abs,Y",
    0xC0: "CPY #",
    0xC1: "CMP X,ind",
    0xC4: "CPY zpg",
    0xC5: "CMP zpg",
    0xC6: "DEC zpg",
    0xC8: "INY impl",
    0xC9: "CMP #",
    0xCA: "DEX impl",
    0xCC: "CPY abs",
    0xCD: "CMP abs",
    0xCE: "DEC abs",
    0xD0: "BNE rel",
    0xD1: "CMP ind,Y",
    0xD5: "CMP zpg,X",
    0xD6: "DEC zpg,X",
    0xD8: "CLD impl",
    0xD9: "CMP abs,Y",
    0xDD: "CMP abs,X",
    0xDE: "DEC abs,X",
    0xE0: "CPX #",
    0xE1: "SBC X,ind",
    0xE4: "CPX zpg",
    0xE5: "SBC zpg",
    0xE6: "INC zpg",
    0xE8: "INX impl",
    0xE9: "SBC #",
    0xEA: "NOP impl",
    0xEC: "CPX abs",
    0xED: "SBC abs",
    0xEE: "INC abs",
    0xF0: "BEQ rel",
    0xF1: "SBC ind,Y",
    0xF5: "SBC zpg,X",
    0xF6: "INC zpg,X",
    0xF8: "SED impl",
    0xF9: "SBC abs,Y",
    0xFD: "SBC abs,X",
    0xFE: "INC abs,X"
  };

  private opcodes6502Undocumented: { [key: number]: string } = {
    0x03: "SLO X,ind",
    0x04: "NOP zpg",
    0x07: "SLO zpg",
    0x0B: "ANC #",
    0x0C: "NOP abs",
    0x0F: "SLO abs",
    0x13: "SLO ind,Y",
    0x14: "NOP zpg,X",
    0x17: "SLO zpg,X",
    0x1A: "NOP impl",
    0x1B: "SLO abs,Y",
    0x1C: "NOP abs,X",
    0x1F: "SLO abs,X",
    0x23: "RLA X,ind",
    0x27: "RLA zpg",
    0x2B: "ANC #",
    0x2F: "RLA abs",
    0x33: "RLA ind,Y",
    0x34: "NOP zpg,X",
    0x37: "RLA zpg,X",
    0x3A: "NOP impl",
    0x3B: "RLA abs,Y",
    0x3C: "NOP abs,X",
    0x3F: "RLA abs,X",
    0x43: "SRE X,ind",
    0x44: "NOP zpg",
    0x47: "SRE zpg",
    0x4B: "ASR #",
    0x4F: "SRE abs",
    0x53: "SRE ind,Y",
    0x54: "NOP zpg,X",
    0x57: "SRE zpg,X",
    0x5A: "NOP impl",
    0x5B: "SRE abs,Y",
    0x5C: "NOP abs,X",
    0x5F: "SRE abs,X",
    0x63: "RRA X,ind",
    0x64: "NOP zpg",
    0x67: "RRA zpg",
    0x6B: "ARR #",
    0x6F: "RRA abs",
    0x73: "RRA ind,Y",
    0x74: "NOP zpg,X",
    0x77: "RRA zpg,X",
    0x7A: "NOP impl",
    0x7B: "RRA abs,Y",
    0x7C: "NOP abs,X",
    0x7F: "RRA abs,X",    
    0x80: "NOP #",
    0x82: "NOP #",
    0x83: "SAX X,ind",
    0x87: "SAX zpg",
    0x89: "NOP #",
    0x8B: "ANE #",
    0x8F: "SAX abs",
    0x93: "SHA ind,Y",
    0x97: "SAX zpg,Y",
    0x9B: "SHS abs,Y",
    0x9C: "SHY abs,X",
    0x9E: "SHX abs,Y",
    0x9F: "SHA abs,Y",
    0xA3: "LAX X,ind",
    0xA7: "LAX zpg",
    0xAB: "LXA #",
    0xAF: "LAX abs",
    0xB3: "LAX ind,Y",
    0xB7: "LAX zpg,Y",
    0xBB: "LAS abs,Y",
    0xBF: "LAX abs,Y",
    0xC2: "NOP #",
    0xC3: "DCP X,ind",
    0xC7: "DCP zpg",
    0xCB: "SBX #",
    0xCF: "DCP abs",
    0xD3: "DCP ind,Y",
    0xD4: "NOP zpg,X",
    0xD7: "DCP zpg,X",
    0xDA: "NOP impl",
    0xDB: "DCP abs,Y",
    0xDC: "NOP abs,X",
    0xDF: "DCP abs,X",
    0xE2: "NOP #",
    0xE3: "ISB X,ind",
    0xE7: "ISB zpg",
    0xEB: "SBC #",
    0xEF: "ISB abs",
    0xF3: "ISB ind,Y",
    0xF4: "NOP zpg,X",
    0xF7: "ISB zpg,X",
    0xFA: "NOP impl",
    0xFB: "ISB abs,Y",
    0xFC: "NOP abs,X",
    0xFF: "ISB abs,X"
  }

  //#region Operations

  // Force break
  private brk() {

  }  

  // Clear carry flag
  private clc() {
    this.Registers.P.Clear(ProcessorStatusFlag.Carry);
  }

  // Clear decimal mode
  private cld() {
    this.Registers.P.Clear(ProcessorStatusFlag.Decimal);
  }

  // Clear interrupt disable bit
  private cli() {
    this.Registers.P.Clear(ProcessorStatusFlag.Interrupt);
  }

  // Clear overflow flag
  private clv() {
    this.Registers.P.Clear(ProcessorStatusFlag.Overflow);
  }

  // Decrement index X by one
  private dex() {
    this.Registers.X = (this.Registers.X - 1) & 0xFF;
    this.Registers.P.SetNegative(this.Registers.X);
    this.Registers.P.SetZero(this.Registers.X);
  }

  // Decrement index Y by one
  private dey() {
    this.Registers.Y = (this.Registers.Y - 1) & 0xFF;
    this.Registers.P.SetNegative(this.Registers.Y);
    this.Registers.P.SetZero(this.Registers.Y);
  }

  // Increment index X by one
  private inx() {
    this.Registers.X = (this.Registers.X + 1) & 0xFF;
    this.Registers.P.SetNegative(this.Registers.X);
    this.Registers.P.SetZero(this.Registers.X);
  }

  // Increment index Y by one
  private iny() {
    this.Registers.Y = (this.Registers.Y + 1) & 0xFF;
    this.Registers.P.SetNegative(this.Registers.Y);
    this.Registers.P.SetZero(this.Registers.Y);
  }

  // No-op
  private nop() {

  }

  // Push accumulator onto stack
  private pha() {
    this.push(this.Registers.A);
  }

  // Push processor status onto stack
  private php() {
    this.push(this.Registers.P.value);
  }

  // Pull accumulator from stack
  private pla() {
    this.Registers.A = this.pop();
    this.Registers.P.SetNegative(this.Registers.A);
    this.Registers.P.SetZero(this.Registers.A);
  }

  // Pull processor status from stack
  private plp() {
    this.Registers.P.value = this.pop();
  }

  // Transfer accumulator to index X
  private tax() {
    this.Registers.X = this.Registers.A;
    this.Registers.P.SetNegative(this.Registers.X);
    this.Registers.P.SetZero(this.Registers.X);
  }

  // Transfer accumulator to index Y
  private tay() {
    this.Registers.Y = this.Registers.A;
    this.Registers.P.SetNegative(this.Registers.Y);
    this.Registers.P.SetZero(this.Registers.Y);
  }

  // Transfer stack pointer to index X
  private tsx() {
    this.Registers.X = this.Registers.SP;
    this.Registers.P.SetNegative(this.Registers.X);
    this.Registers.P.SetZero(this.Registers.X);
  }

  // Transfer index X to accumulator
  private txa() {
    this.Registers.A = this.Registers.X;
    this.Registers.P.SetNegative(this.Registers.A);
    this.Registers.P.SetZero(this.Registers.A);
  }

  // Transfer index X to stack register
  private txs() {
    this.Registers.SP = this.Registers.X;
  }

  // Transfer index Y to accumulator
  private tya() {
    this.Registers.A = this.Registers.Y;
    this.Registers.P.SetNegative(this.Registers.A);
    this.Registers.P.SetZero(this.Registers.A);
  }

  //#endregion
}  

export default cpu6502;
