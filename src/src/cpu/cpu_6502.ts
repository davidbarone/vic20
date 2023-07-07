import OpCodeGenRule from "./op_code_gen_rule";
import Memory from "../memory/memory";
import cpu6502Internal from "./cpu_6502_internal";
import Utils from "../lib/utils"
import AddressMode from "./address_mode";
import CpuDebugInfo from "./cpu_debug_info";

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
// https://skilldrick.github.io/easy6502/
// https://sites.google.com/site/6502asembly/
// http://www.emulator101.com/6502-addressing-modes.html
// https://xania.org/201405/jsbeeb-emulating-a-bbc-micro-in-javascript
// http://www.obelisk.me.uk/6502/
// https://codegolf.stackexchange.com/questions/12844/emulate-a-mos-6502-cpu
// https://github.com/amensch/e6502
// https://www.masswerk.at/nowgobang/2021/6502-illegal-opcodes
//
// **********************************

export default class cpu6502 extends cpu6502Internal {

  /**
   * History of recent CPU instructions. Used for debug purposes
   */
  private history: Array<CpuDebugInfo> = [];

  /**
   * Number of instructions stored in cpu history.
   */
  private historyMaxSize: number = 1000;
  private lastPc: number = 0;
  public c: number = 0;                  // total cycle count
  private currentInstruction: OpCodeGenRule | undefined;
  private debug: boolean = false;
  public trapHit: boolean = false;
  private trapPc: number = 0;

  protected opCodes6502: { [key: number]: OpCodeGenRule };

  public requiresIrq: boolean = false;
  public requiresNmi: boolean = false;

  setDebug(mode: boolean) {
    this.debug = mode;
  }

  /**
   * Constructor
   * @param memory 64K addressable memory
   */
  constructor(
    memory: Memory,
  ) {
    super(memory);
    this.debug = false;

    // opCode6502 dictionary initialise
    let array = this.opCodes6502Documented;
    this.opCodes6502 = Object.assign({}, ...array.map((a) => ({ [a.opCode]: a })));
  }

  /**
   * Performs a hard reset.
   */
  public reset(pc: number | null = null, trapPc: number | undefined = undefined): void {
    console.log('Reset...');
    this.Registers.A = 0;
    this.Registers.X = 0;
    this.Registers.Y = 0;
    this.Registers.SP = 0

    if (pc) {
      this.Registers.PC = pc;
    } else {
      let VCTRRST = 0xFFFC;
      this.Registers.PC = this.Memory.readWord(VCTRRST);
    }

    // trap set? (for testing)
    if (trapPc) {
      this.trapPc = trapPc;
      this.trapHit = false;
    }

    this.Cycles = 0;
  }

  public get instructionComplete(): boolean {
    return this.Cycles === 0;
  }

  /**
   * Gets last n instructions executed
   * @param history Number of instructions, n, to keep in history. Can be between 1 and historyMaxSize
   * @returns Debug string showing last instructions
   */
  public getDebug(history: number): string {
    if (history < 1 || history > this.historyMaxSize) {
      throw "Invalid history value.";
    }
    let text = "";

    let frameEnd: number = this.history.length;
    let frameStart: number = this.history.length - history;
    if (frameStart < 0) {
      frameStart = 0;
    }

    // return page of memory in debug format
    for (let row = frameStart; row < frameEnd; row++) {
      text += `${this.history[row].complete}\n`;
    }
    return text;
  }

  /**
   * Returns the PC register. Used for debugging / breakpoints
   */
  public getPC(): number {
    //return this.Registers.PC;
    return this.lastPc;
  }

  /**
   * Gets the current instruction. Used for debugging and breakpoints. Note that the instruction is set during the first cycle
   * so when a breakpoint on an instruction halts a program, the program will stop at the start of cycle #2.
   */
  public getInstruction(): OpCodeGenRule {
    return this.currentInstruction as OpCodeGenRule;
  }

  /**
   * Returns the memory address read from or written to by current instruction
   */
  public getInstructionMemory(): number | null {
    return this.history[this.history.length - 1].memory;
  }

  /**
   * Gets the call stack
   */
  public getCallStack(): string {
    let sp: number = this.Registers.SP + 1;
    let stackFrame = 0;
    let stack = "";
    while (sp < 0xFF) {
      // Must add 1 - JSR pushed [next instruction - 1] originally
      let offset: number = this.Memory.readWord(this.StackBase + sp) + 1;
      let offsetHex: string = Utils.NumberToHex(offset);
      stack = stack + `(${stackFrame}) ${offsetHex} (${offset})\n`;
      stackFrame++;
      sp = sp + 2;
    }
    return stack;
  }

  /**
   * Loads an image or data into memory at a specific address
   * @param offset Address to load data
   * @param data Data to load
   */
  public load(offset: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.Memory.writeByte(offset + i, data[i])
    }
  }

  /**
   * Executes a single cpu cycle.
   * Note that each operation may take
   * multiple cycles to complete.
   * Cycle lengths based on documentation.
   */
  public cycle() {
    this.c++;

    // Check if need to get new instruction?
    if (this.Cycles === 0) {

      if (!this.Registers.P.isSetI() && this.requiresIrq) {
        this.irq();
        this.requiresIrq = false;
      }

      if (this.requiresNmi) {
        this.nmi();
        this.requiresNmi = false;
      }

      // Check if we're looping on same pc?
      // This is trap on 6502 functional tests. If in trap, throw error  PC.
      if (this.trapPc && this.Registers.PC === this.lastPc) {
        this.trapHit = true;
        if (this.trapPc === this.Registers.PC) {
          debugger
        } else {
          throw `Actual trap program counter of ${this.Registers.PC} does not match expected trap program counter of ${this.trapPc}.`
        }
      }
      this.lastPc = this.Registers.PC;

      let instruction = this.FetchInstruction();

      this.currentInstruction = this.opCodes6502[instruction];

      if (typeof this.currentInstruction == 'undefined') {
        throw `Invalid instruction: ${instruction} found at offset: ${this.Registers.PC}.`;
      }

      this.Cycles = this.currentInstruction.cycles;
      this.executeInstruction(this.currentInstruction);
    }
    this.Cycles--
  }

  /**
   * Gets the memory offset relating to a particular addressing mode
   * @param addressMode The address mode
   * @param address The operand / value
   * @returns The memory address lookup
   */
  private GetMemoryOffset(addressMode: string, address: number | null): number {
    address = address ?? 0;
    switch (addressMode) {
      case "abs":     // absolute
        return address & 0xFFFF;
        break;
      case "abs,X":   // absolute, X-indexed
        return (address + this.Registers.X) & 0xFFFF;
        break;
      case "abs,Y":   // absolute, Y-indexed
        return (address + this.Registers.Y) & 0xFFFF;
        break;
      case "ind":     // indirect
        return address & 0xFFFF; // location stores a 16-bit address
        break;
      case "X,ind":   // X-indexed, indirect
        let add = (address + this.Registers.X) % 0x100;
        let lsbXInd = this.Memory.readByte(add);
        let msbXInd = this.Memory.readByte(add + 1);
        return Utils.ShiftLeft(msbXInd, 8) + lsbXInd;
        break;
      case "ind,Y":   // Indirect, Y-indexed
        // Most common indirection mode on 6502.
        // 1. Get byte at zero page: address
        // 2. Add value in Y
        // 3. Trim result to 8 bits -> LSB. Keep carry (C)
        // 4. Get byte at zero page: [address + 1 + C] -> MSB
        // 5. create word value from (MSB << 8) + LSB
        // 6. Return result.
        let addr = this.Memory.readByte(address & 0xFFFF);
        addr = (addr + this.Registers.Y);
        let c = addr > 0xFF ? 1 : 0;
        let lsb = addr % 0x100;
        let msb = this.Memory.readByte(address + 1) + c;
        let offset = Utils.ShiftLeft(msb, 8) + lsb;
        return offset;
        break;
      case "rel":     // relative branch / jump (relative to PC)
        return (this.Registers.PC + Utils.signedWord(address)) & 0xFFFF;
        break;
      case "zpg":     // zero page
        return address & 0xFF;
        break;
      case "zpg,X":   // zero page, X-indexed
        return (address + this.Registers.X) % 0x100;
        break;
      case "zpg,Y":   // zero page, Y-indexed
        return (address + this.Registers.Y) % 0x100;
        break;
      default:  // should not get here
        throw new Error(`Invalid addressing mode for memory access: ${addressMode}`);
    }
  }

  /**
   * Gets the value based on the address mode and operand
   * @param addressMode The address mode
   * @param address The address / operand 
   * @returns 
   */
  private ReadMemory(addressMode: string, address: number | null): number {
    address = address ?? 0;
    let offset = this.GetMemoryOffset(addressMode, address) ?? 0;
    switch (addressMode) {
      case "#":       // immediate
        throw "Invalid address mode: #";
      case "A":       // A register
        throw "Invalid address mode: A";
      case "abs":     // absolute
        return this.Memory.readByte(offset);
        break;
      case "abs,X":   // absolute, X-indexed
        return this.Memory.readByte(offset);
        break;
      case "abs,Y":   // absolute, Y-indexed
        return this.Memory.readByte(offset);
        break;
      case "impl":    // implied
        throw "Invalid address mode: impl";
        break;
      case "ind":     // indirect
        return this.Memory.readWord(offset); // location stores a 16-bit address
        break;
      case "X,ind":   // X-indexed, indirect
        return this.Memory.readByte(offset);
        break;
      case "ind,Y":   // Indirect, Y-indexed
        return this.Memory.readByte(offset);
        break;
      case "rel":     // relative branch / jump (relative to PC)
        return this.Registers.PC + address;
        break;
      case "zpg":     // zero page
        return this.Memory.readByte(offset);
        break;
      case "zpg,X":   // zero page, X-indexed
        return this.Memory.readByte(offset);
        break;
      case "zpg,Y":   // zero page, Y-indexed
        return this.Memory.readByte(offset);
        break;
      default:  // should not get here
        throw new Error(`Invalid address mode: ${addressMode}`);
    }
  }

  /**
   * Writes to memory
   * @param addressMode The address mode
   * @param address The offset / address
   * @param value The value to write
   * @returns void
   */
  protected WriteMemory(addressMode: string, address: number, value: number): void {
    let offset = this.GetMemoryOffset(addressMode, address) ?? 0;
    switch (addressMode) {
      case "#":       // immediate
        throw "Invalid address mode: #";
      case "A":       // A register
        throw "Invalid address mode: A";
      case "abs":     // absolute
        this.Memory.writeByte(offset, value);
        break;
      case "abs,X":   // absolute, X-indexed
        this.Memory.writeByte(offset, value)
        break;
      case "abs,Y":   // absolute, Y-indexed
        this.Memory.writeByte(offset, value)
        break;
      case "impl":    // implied
        throw "Invalid address mode: impl";
        break;
      case "ind":     // indirect
        this.Memory.writeByte(offset, value)
        break;
      case "X,ind":   // X-indexed, indirect
        this.Memory.writeByte(offset, value)
        break;
      case "ind,Y":   // Indirect, Y-indexed
        this.Memory.writeByte(offset, value)
        break;
      case "rel":     // relative branch / jump (relative to PC)
        throw "Invalid address mode: rel";
      case "zpg":     // zero page
        this.Memory.writeByte(offset, value)
        break;
      case "zpg,X":   // zero page, X-indexed
        this.Memory.writeByte(offset, value)
        break;
      case "zpg,Y":   // zero page, Y-indexed
        this.Memory.writeByte(offset, value)
        break;
      default:  // should not get here
        throw new Error(`Invalid address mode: ${addressMode}`);
    }
  }

  // -----------------------------
  // Returns op codes as an array.
  // -----------------------------
  get opCodes6502Array(): Array<{ key: number, rule: OpCodeGenRule }> {
    let rules = [];
    for (const [key, value] of Object.entries(this.opCodes6502)) {

      // Add to Array
      rules.push({
        key: parseInt(key),
        rule: value
      });
    }
    return rules;
  }

  private opCodes6502Documented: Array<OpCodeGenRule> = [
    new OpCodeGenRule({ opCode: 0x00, instruction: "BRK", cycles: 7, addressMode: "impl", operation: (cpu, reg) => { cpu.brk() } }),
    new OpCodeGenRule({ opCode: 0x01, instruction: "ORA", cycles: 6, addressMode: "X,ind", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A | reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x05, instruction: "ORA", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A | reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x06, instruction: "ASL", cycles: 5, addressMode: "zpg", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, false, false)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x08, instruction: "PHP", cycles: 3, addressMode: "impl", operation: (cpu, reg) => { cpu.push(cpu.Registers.P.Flags | (1 << 5) | (1 << 4)) } }),
    new OpCodeGenRule({ opCode: 0x09, instruction: "ORA", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A | reg) } }),
    new OpCodeGenRule({ opCode: 0x0A, instruction: "ASL", cycles: 2, addressMode: "A", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.rotate(cpu.Registers.A, false, false)) } }),
    new OpCodeGenRule({ opCode: 0x0D, instruction: "ORA", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A | reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x0E, instruction: "ASL", cycles: 6, addressMode: "abs", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, false, false)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x10, instruction: "BPL", cycles: 2, addressMode: "rel", operation: (cpu, reg) => { cpu.branch(() => !cpu.Registers.P.isSetN(), reg) } }),
    new OpCodeGenRule({ opCode: 0x11, instruction: "ORA", cycles: 5, addressMode: "ind,Y", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A | reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x15, instruction: "ORA", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A | reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x16, instruction: "ASL", cycles: 6, addressMode: "zpg,X", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, false, false)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x18, instruction: "CLC", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.P.clearC() } }),
    new OpCodeGenRule({ opCode: 0x19, instruction: "ORA", cycles: 4, addressMode: "abs,Y", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A | reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x1D, instruction: "ORA", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A | reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x1E, instruction: "ASL", cycles: 7, addressMode: "abs,X", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, false, false)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x20, instruction: "JSR", cycles: 6, addressMode: "abs", operation: (cpu, reg) => { cpu.jsr(reg) } }),
    new OpCodeGenRule({ opCode: 0x21, instruction: "AND", cycles: 6, addressMode: "X,ind", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A & reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x24, instruction: "BIT", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.bit(reg, 'zpg') }, read: true }),
    new OpCodeGenRule({ opCode: 0x25, instruction: "AND", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A & reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x26, instruction: "ROL", cycles: 5, addressMode: "zpg", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, false, true)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x28, instruction: "PLP", cycles: 4, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.P.Flags = cpu.pop() & 0B11001111 } }),  // break (B4) and B5 ignored
    new OpCodeGenRule({ opCode: 0x29, instruction: "AND", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A & reg) } }),
    new OpCodeGenRule({ opCode: 0x2A, instruction: "ROL", cycles: 2, addressMode: "A", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.rotate(cpu.Registers.A, false, true)) } }),
    new OpCodeGenRule({ opCode: 0x2C, instruction: "BIT", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.bit(reg, 'abs') }, read: true }),
    new OpCodeGenRule({ opCode: 0x2D, instruction: "AND", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A & reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x2E, instruction: "ROL", cycles: 6, addressMode: "abs", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, false, true)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x30, instruction: "BMI", cycles: 2, addressMode: "rel", operation: (cpu, reg) => { cpu.branch(() => cpu.Registers.P.isSetN(), reg) } }),
    new OpCodeGenRule({ opCode: 0x31, instruction: "AND", cycles: 5, addressMode: "ind,Y", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A & reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x35, instruction: "AND", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A & reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x36, instruction: "ROL", cycles: 6, addressMode: "zpg,X", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, false, true)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x38, instruction: "SEC", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.P.setC() } }),
    new OpCodeGenRule({ opCode: 0x39, instruction: "AND", cycles: 4, addressMode: "abs,Y", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A & reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x3D, instruction: "AND", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A & reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x3E, instruction: "ROL", cycles: 7, addressMode: "abs,X", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, false, true)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x40, instruction: "RTI", cycles: 6, addressMode: "impl", operation: (cpu, reg) => { cpu.rti() } }),
    new OpCodeGenRule({ opCode: 0x41, instruction: "EOR", cycles: 6, addressMode: "X,ind", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A ^ reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x45, instruction: "EOR", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A ^ reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x46, instruction: "LSR", cycles: 5, addressMode: "zpg", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, true, false)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x48, instruction: "PHA", cycles: 3, addressMode: "impl", operation: (cpu, reg) => { cpu.push(cpu.Registers.A) } }),
    new OpCodeGenRule({ opCode: 0x49, instruction: "EOR", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A ^ reg) } }),
    new OpCodeGenRule({ opCode: 0x4A, instruction: "LSR", cycles: 2, addressMode: "A", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.rotate(cpu.Registers.A, true, false)) } }),
    new OpCodeGenRule({ opCode: 0x4C, instruction: "JMP", cycles: 3, addressMode: "abs", operation: (cpu, reg) => { cpu.jmp(reg, true) } }),
    new OpCodeGenRule({ opCode: 0x4D, instruction: "EOR", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A ^ reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x4E, instruction: "LSR", cycles: 6, addressMode: "abs", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, true, false)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x50, instruction: "BVC", cycles: 2, addressMode: "rel", operation: (cpu, reg) => { cpu.branch(() => !cpu.Registers.P.isSetV(), reg) } }),
    new OpCodeGenRule({ opCode: 0x51, instruction: "EOR", cycles: 5, addressMode: "ind,Y", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A ^ reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x55, instruction: "EOR", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A ^ reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x56, instruction: "LSR", cycles: 6, addressMode: "zpg,X", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, true, false)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x58, instruction: "CLI", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.P.clearI() } }),
    new OpCodeGenRule({ opCode: 0x59, instruction: "EOR", cycles: 4, addressMode: "abs,Y", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A ^ reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x5D, instruction: "EOR", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.A ^ reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x5E, instruction: "LSR", cycles: 7, addressMode: "abs,X", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, true, false)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x60, instruction: "RTS", cycles: 6, addressMode: "impl", operation: (cpu, reg) => { cpu.rts() } }),
    new OpCodeGenRule({ opCode: 0x61, instruction: "ADC", cycles: 6, addressMode: "X,ind", operation: (cpu, reg) => { cpu.adc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x65, instruction: "ADC", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.adc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x66, instruction: "ROR", cycles: 5, addressMode: "zpg", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, true, true)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x68, instruction: "PLA", cycles: 4, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.pop()) } }),
    new OpCodeGenRule({ opCode: 0x69, instruction: "ADC", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.adc(reg) } }),
    new OpCodeGenRule({ opCode: 0x6A, instruction: "ROR", cycles: 2, addressMode: "A", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.rotate(cpu.Registers.A, true, true)) } }),
    new OpCodeGenRule({ opCode: 0x6C, instruction: "JMP", cycles: 5, addressMode: "ind", operation: (cpu, reg) => { cpu.jmp(reg, false) } }),
    new OpCodeGenRule({ opCode: 0x6D, instruction: "ADC", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.adc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x6E, instruction: "ROR", cycles: 6, addressMode: "abs", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, true, true)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x70, instruction: "BVS", cycles: 2, addressMode: "rel", operation: (cpu, reg) => { cpu.branch(() => cpu.Registers.P.isSetV(), reg) } }),
    new OpCodeGenRule({ opCode: 0x71, instruction: "ADC", cycles: 5, addressMode: "ind,Y", operation: (cpu, reg) => { cpu.adc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x75, instruction: "ADC", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { cpu.adc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x76, instruction: "ROR", cycles: 6, addressMode: "zpg,X", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, true, true)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x78, instruction: "SEI", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.P.setI() } }),
    new OpCodeGenRule({ opCode: 0x79, instruction: "ADC", cycles: 4, addressMode: "abs,Y", operation: (cpu, reg) => { cpu.adc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x7D, instruction: "ADC", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { cpu.adc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0x7E, instruction: "ROR", cycles: 7, addressMode: "abs,X", operation: (cpu, reg) => { return cpu.setzn(cpu.rotate(reg, true, true)) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0x81, instruction: "STA", cycles: 6, addressMode: "X,ind", operation: (cpu, reg) => { return cpu.Registers.A }, write: true }),
    new OpCodeGenRule({ opCode: 0x84, instruction: "STY", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { return cpu.Registers.Y }, write: true }),
    new OpCodeGenRule({ opCode: 0x85, instruction: "STA", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { return cpu.Registers.A }, write: true }),
    new OpCodeGenRule({ opCode: 0x86, instruction: "STX", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { return cpu.Registers.X }, write: true }),
    new OpCodeGenRule({ opCode: 0x88, instruction: "DEY", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.Y = cpu.setzn((cpu.Registers.Y - 1) & 0xFF) } }),
    new OpCodeGenRule({ opCode: 0x8A, instruction: "TXA", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.X) } }),
    new OpCodeGenRule({ opCode: 0x8C, instruction: "STY", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { return cpu.Registers.Y }, write: true }),
    new OpCodeGenRule({ opCode: 0x8D, instruction: "STA", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { return cpu.Registers.A }, write: true }),
    new OpCodeGenRule({ opCode: 0x8E, instruction: "STX", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { return cpu.Registers.X }, write: true }),
    new OpCodeGenRule({ opCode: 0x90, instruction: "BCC", cycles: 2, addressMode: "rel", operation: (cpu, reg) => { cpu.branch(() => !cpu.Registers.P.isSetC(), reg) } }),
    new OpCodeGenRule({ opCode: 0x91, instruction: "STA", cycles: 6, addressMode: "ind,Y", operation: (cpu, reg) => { return cpu.Registers.A }, write: true }),
    new OpCodeGenRule({ opCode: 0x94, instruction: "STY", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { return cpu.Registers.Y }, write: true }),
    new OpCodeGenRule({ opCode: 0x95, instruction: "STA", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { return cpu.Registers.A }, write: true }),
    new OpCodeGenRule({ opCode: 0x96, instruction: "STX", cycles: 4, addressMode: "zpg,Y", operation: (cpu, reg) => { return cpu.Registers.X }, write: true }),
    new OpCodeGenRule({ opCode: 0x98, instruction: "TYA", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(cpu.Registers.Y) } }),
    new OpCodeGenRule({ opCode: 0x99, instruction: "STA", cycles: 5, addressMode: "abs,Y", operation: (cpu, reg) => { return cpu.Registers.A }, write: true }),
    new OpCodeGenRule({ opCode: 0x9A, instruction: "TXS", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.SP = cpu.Registers.X } }),
    new OpCodeGenRule({ opCode: 0x9D, instruction: "STA", cycles: 5, addressMode: "abs,X", operation: (cpu, reg) => { return cpu.Registers.A }, write: true }),
    new OpCodeGenRule({ opCode: 0xA0, instruction: "LDY", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.Registers.Y = cpu.setzn(reg) } }),
    new OpCodeGenRule({ opCode: 0xA1, instruction: "LDA", cycles: 6, addressMode: "X,ind", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xA2, instruction: "LDX", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.Registers.X = cpu.setzn(reg) } }),
    new OpCodeGenRule({ opCode: 0xA4, instruction: "LDY", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.Registers.Y = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xA5, instruction: "LDA", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xA6, instruction: "LDX", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.Registers.X = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xA8, instruction: "TAY", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.Y = cpu.setzn(cpu.Registers.A) } }),
    new OpCodeGenRule({ opCode: 0xA9, instruction: "LDA", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(reg) } }),
    new OpCodeGenRule({ opCode: 0xAA, instruction: "TAX", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.X = cpu.setzn(cpu.Registers.A) } }),
    new OpCodeGenRule({ opCode: 0xAC, instruction: "LDY", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.Registers.Y = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xAD, instruction: "LDA", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xAE, instruction: "LDX", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.Registers.X = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xB0, instruction: "BCS", cycles: 2, addressMode: "rel", operation: (cpu, reg) => { cpu.branch(() => cpu.Registers.P.isSetC(), reg) } }),
    new OpCodeGenRule({ opCode: 0xB1, instruction: "LDA", cycles: 5, addressMode: "ind,Y", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xB4, instruction: "LDY", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { cpu.Registers.Y = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xB5, instruction: "LDA", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xB6, instruction: "LDX", cycles: 4, addressMode: "zpg,Y", operation: (cpu, reg) => { cpu.Registers.X = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xB8, instruction: "CLV", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.P.clearV() } }),
    new OpCodeGenRule({ opCode: 0xB9, instruction: "LDA", cycles: 4, addressMode: "abs,Y", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xBA, instruction: "TSX", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.X = cpu.setzn(cpu.Registers.SP) } }),
    new OpCodeGenRule({ opCode: 0xBC, instruction: "LDY", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { cpu.Registers.Y = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xBD, instruction: "LDA", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { cpu.Registers.A = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xBE, instruction: "LDX", cycles: 4, addressMode: "abs,Y", operation: (cpu, reg) => { cpu.Registers.X = cpu.setzn(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xC0, instruction: "CPY", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.compare(cpu.Registers.Y, reg) } }),
    new OpCodeGenRule({ opCode: 0xC1, instruction: "CMP", cycles: 6, addressMode: "X,ind", operation: (cpu, reg) => { cpu.compare(cpu.Registers.A, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xC4, instruction: "CPY", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.compare(cpu.Registers.Y, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xC5, instruction: "CMP", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.compare(cpu.Registers.A, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xC6, instruction: "DEC", cycles: 5, addressMode: "zpg", operation: (cpu, reg) => { return cpu.setzn((reg - 1) & 0xFF) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0xC8, instruction: "INY", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.Y = cpu.setzn((cpu.Registers.Y + 1) & 0xFF) } }),
    new OpCodeGenRule({ opCode: 0xC9, instruction: "CMP", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.compare(cpu.Registers.A, reg) } }),
    new OpCodeGenRule({ opCode: 0xCA, instruction: "DEX", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.X = cpu.setzn((cpu.Registers.X - 1) & 0xFF) } }),
    new OpCodeGenRule({ opCode: 0xCC, instruction: "CPY", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.compare(cpu.Registers.Y, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xCD, instruction: "CMP", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.compare(cpu.Registers.A, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xCE, instruction: "DEC", cycles: 3, addressMode: "abs", operation: (cpu, reg) => { return cpu.setzn((reg - 1) & 0xFF) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0xD0, instruction: "BNE", cycles: 2, addressMode: "rel", operation: (cpu, reg) => { cpu.branch(() => !cpu.Registers.P.isSetZ(), reg) } }),
    new OpCodeGenRule({ opCode: 0xD1, instruction: "CMP", cycles: 5, addressMode: "ind,Y", operation: (cpu, reg) => { cpu.compare(cpu.Registers.A, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xD5, instruction: "CMP", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { cpu.compare(cpu.Registers.A, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xD6, instruction: "DEC", cycles: 6, addressMode: "zpg,X", operation: (cpu, reg) => { return cpu.setzn((reg - 1) & 0xFF) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0xD8, instruction: "CLD", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.P.clearD() } }),
    new OpCodeGenRule({ opCode: 0xD9, instruction: "CMP", cycles: 4, addressMode: "abs,Y", operation: (cpu, reg) => { cpu.compare(cpu.Registers.A, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xDD, instruction: "CMP", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { cpu.compare(cpu.Registers.A, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xDE, instruction: "DEC", cycles: 7, addressMode: "abs,X", operation: (cpu, reg) => { return cpu.setzn((reg - 1) & 0xFF) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0xE0, instruction: "CPX", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.compare(cpu.Registers.X, reg) } }),
    new OpCodeGenRule({ opCode: 0xE1, instruction: "SBC", cycles: 6, addressMode: "X,ind", operation: (cpu, reg) => { cpu.sbc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xE4, instruction: "CPX", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.compare(cpu.Registers.X, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xE5, instruction: "SBC", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { cpu.sbc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xE6, instruction: "INC", cycles: 5, addressMode: "zpg", operation: (cpu, reg) => { return cpu.setzn((reg + 1) & 0xFF) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0xE8, instruction: "INX", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.X = cpu.setzn((cpu.Registers.X + 1) & 0xFF) } }),
    new OpCodeGenRule({ opCode: 0xE9, instruction: "SBC", cycles: 2, addressMode: "#", operation: (cpu, reg) => { cpu.sbc(reg) } }),
    new OpCodeGenRule({ opCode: 0xEA, instruction: "NOP", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { } }),
    new OpCodeGenRule({ opCode: 0xEC, instruction: "CPX", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.compare(cpu.Registers.X, reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xED, instruction: "SBC", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { cpu.sbc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xEE, instruction: "INC", cycles: 6, addressMode: "abs", operation: (cpu, reg) => { return cpu.setzn((reg + 1) & 0xFF) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0xF0, instruction: "BEQ", cycles: 2, addressMode: "rel", operation: (cpu, reg) => { cpu.branch(() => cpu.Registers.P.isSetZ(), reg) } }),
    new OpCodeGenRule({ opCode: 0xF1, instruction: "SBC", cycles: 5, addressMode: "ind,Y", operation: (cpu, reg) => { cpu.sbc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xF5, instruction: "SBC", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { cpu.sbc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xF6, instruction: "INC", cycles: 6, addressMode: "zpg,X", operation: (cpu, reg) => { return cpu.setzn((reg + 1) & 0xFF) }, read: true, write: true }),
    new OpCodeGenRule({ opCode: 0xF8, instruction: "SED", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { cpu.Registers.P.setD() } }),
    new OpCodeGenRule({ opCode: 0xF9, instruction: "SBC", cycles: 4, addressMode: "abs,Y", operation: (cpu, reg) => { cpu.sbc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xFD, instruction: "SBC", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { cpu.sbc(reg) }, read: true }),
    new OpCodeGenRule({ opCode: 0xFE, instruction: "INC", cycles: 7, addressMode: "abs,X", operation: (cpu, reg) => { return cpu.setzn((reg + 1) & 0xFF) }, read: true, write: true }),
  ];

  private opcodes6502Undocumented: Array<OpCodeGenRule> = [
    new OpCodeGenRule({ opCode: 0x02, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x04, instruction: "NOP", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x0C, instruction: "NOP", cycles: 4, addressMode: "abs", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x12, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x14, instruction: "NOP", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x1A, instruction: "NOP", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x1C, instruction: "NOP", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x22, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x32, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x34, instruction: "NOP", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x3A, instruction: "NOP", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x3C, instruction: "NOP", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x42, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x44, instruction: "NOP", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x52, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x54, instruction: "NOP", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x5A, instruction: "NOP", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x5C, instruction: "NOP", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x62, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x64, instruction: "NOP", cycles: 3, addressMode: "zpg", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x72, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x74, instruction: "NOP", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x7A, instruction: "NOP", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x7C, instruction: "NOP", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x80, instruction: "NOP", cycles: 2, addressMode: "#", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x82, instruction: "NOP", cycles: 2, addressMode: "#", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x89, instruction: "NOP", cycles: 2, addressMode: "#", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0x92, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xB2, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xC2, instruction: "NOP", cycles: 2, addressMode: "#", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xD2, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xD4, instruction: "NOP", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xDA, instruction: "NOP", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xDC, instruction: "NOP", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xE2, instruction: "NOP", cycles: 2, addressMode: "#", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xF2, instruction: "JAM", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { throw 'JAM/KIL/HLT encountered!' }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xF4, instruction: "NOP", cycles: 4, addressMode: "zpg,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xFA, instruction: "NOP", cycles: 2, addressMode: "impl", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xFC, instruction: "NOP", cycles: 4, addressMode: "abs,X", operation: (cpu, reg) => { }, read: false, write: false }),
    new OpCodeGenRule({ opCode: 0xFC, instruction: "ISC", cycles: 7, addressMode: "abs,X", operation: (cpu, reg) => { let m = cpu.setzn((reg + 1) & 0xFF); cpu.sbc(m); return m; }, read: false, write: false })

    /*
        0x03: "SLO X,ind",
        0x07: "SLO zpg",
        0x0B: "ANC #",
        0x0F: "SLO abs",
        0x13: "SLO ind,Y",
        0x17: "SLO zpg,X",
        0x1B: "SLO abs,Y",
        0x1F: "SLO abs,X",
        0x23: "RLA X,ind",
        0x27: "RLA zpg",
        0x2B: "ANC #",
        0x2F: "RLA abs",
        0x33: "RLA ind,Y",
        0x37: "RLA zpg,X",
        0x3B: "RLA abs,Y",
        0x3F: "RLA abs,X",
        0x43: "SRE X,ind",
        0x47: "SRE zpg",
        0x4B: "ASR #",
        0x4F: "SRE abs",
        0x53: "SRE ind,Y",
        0x57: "SRE zpg,X",
        0x5B: "SRE abs,Y",
        0x5F: "SRE abs,X",
        0x63: "RRA X,ind",
        0x67: "RRA zpg",
        0x6B: "ARR #",
        0x6F: "RRA abs",
        0x73: "RRA ind,Y",
        0x77: "RRA zpg,X",
        0x7B: "RRA abs,Y",
        0x7F: "RRA abs,X",
        0x83: "SAX X,ind",
        0x87: "SAX zpg",
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
        0xC3: "DCP X,ind",
        0xC7: "DCP zpg",
        0xCB: "SBX #",
        0xCF: "DCP abs",
        0xD3: "DCP ind,Y",
        0xD7: "DCP zpg,X",
        0xDB: "DCP abs,Y",
        0xDF: "DCP abs,X",
        0xE3: "ISB X,ind",
        0xE7: "ISB zpg",
        0xEB: "SBC #",
        0xEF: "ISB abs",
        0xF3: "ISB ind,Y",
        0xF7: "ISB zpg,X",
        0xFB: "ISB abs,Y",
        0xFF: "ISC abs,X"
    
        */
  ]

  /**
   * Outputs debug information for the current instruction
   */
  protected getDebugInfo(offset: number, rule: OpCodeGenRule, operand: number, REG: number): CpuDebugInfo {
    let instruction = rule.instruction;
    let addressMode = rule.addressMode;

    // change operand to signed for 'rel' address mode (branching)
    let operandSigned = operand
    if (addressMode === 'rel' && operand > 127) {
      operandSigned = operand - 256;
    }

    let addressModeRule = AddressMode.GetRule(addressMode);
    let operandHex = Utils.NumberToHex(operand);
    let bytes: Array<number> = new Array<number>();

    bytes.push(rule.opCode);
    if (addressModeRule.bytes > 1) {
      bytes.push(Utils.lsb(operand));
    }
    if (addressModeRule.bytes > 2) {
      bytes.push(Utils.msb(operand));
    }

    let mem = null;
    let memFormatted = "";
    if (rule.hasMemoryAccess) {
      let memOffset: number = this.GetMemoryOffset(addressMode, operand);
      let memValue = this.Memory.readByte(memOffset);
      mem = memOffset;
      memFormatted = `MEM: ${Utils.NumberToHex(memOffset)}: [${Utils.NumberToHex(memValue)}]`;
    }

    // Ignore PC
    let registersDebug = `SP:${Utils.NumberToHex(this.Registers.SP)} A:${Utils.NumberToHex(this.Registers.A)} X:${Utils.NumberToHex(this.Registers.X)} Y:${Utils.NumberToHex(this.Registers.Y)} ${this.Registers.P.toString()}`;

    // can do any custom debugging at this point...
    if (Utils.NumberToHex(offset) === 'FE91') {
      console.log(this.Memory);
    }

    let debug = {
      offset: offset,
      offsetFormatted: Utils.NumberToHex(offset),
      bytes: rule.bytes,
      opCode: rule.opCode,
      opCodeFormatted: Utils.NumberToHex(rule.opCode),
      instruction: instruction,
      operand: operand,
      operandSigned: operandSigned,
      operandFormatted: addressModeRule.format.replace("{value}", operandHex),
      raw: bytes,
      rawFormatted: Utils.UInt8ArrayToHex(new Uint8Array(bytes)),
      regPC: this.Registers.PC,
      regPCFormatted: Utils.NumberToHex(this.Registers.PC),
      regSP: this.Registers.SP,
      regSPFormatted: Utils.NumberToHex(this.Registers.SP),
      regA: this.Registers.A,
      regAFormatted: Utils.NumberToHex(this.Registers.A),
      regX: this.Registers.X,
      regXFormatted: Utils.NumberToHex(this.Registers.X),
      regY: this.Registers.Y,
      regYFormatted: Utils.NumberToHex(this.Registers.Y),
      processorStatus: this.Registers.P.toString(),
      registersDebug: registersDebug,
      memory: mem,
      memoryFormatted: memFormatted,
      disassembly: `${Utils.NumberToHex(offset)}: ${instruction} ${addressModeRule.format.replace("{value}", operandHex)}`.trim(),
      complete: `${Utils.NumberToHex(offset)}: ${Utils.UInt8ArrayToHex(new Uint8Array(bytes)).padEnd(8, ' ')} ${instruction} ${addressModeRule.format.replace("{value}", operandHex)}`.padEnd(27) + registersDebug + ' ' + memFormatted
    }
    return debug;
  }

  /**
   * Executes a single instruction
   */
  private executeInstruction(rule: OpCodeGenRule): void {
    // store instruction offset (for debug purposes). Note that
    // at this point pc has already been advanced one byte.
    let instructionOffset = this.Registers.PC - 1
    let operand = 0;
    if (rule.bytes === 2) {
      operand = this.Memory.readByte(this.Registers.PC);
      this.Registers.PC = (this.Registers.PC + 1) & 0xFFFF;
    }
    else if (rule.bytes === 3) {
      operand = this.Memory.readWord(this.Registers.PC);
      this.Registers.PC = (this.Registers.PC + 2) & 0xFFFF;
    }

    // Get memory if instruction read property set
    let reg = operand;
    if (rule.read) {
      reg = this.ReadMemory(rule.addressMode, operand);
    }

    // Debug (before executing instruction)
    if (this.debug) {
      let info = this.getDebugInfo(instructionOffset, rule, operand, reg);

      // Add to history
      this.history.push(info);
      if (this.history.length > this.historyMaxSize) {
        this.history.shift();
      }
    }

    // Execute operation (does not necessarily return result)
    let result = rule.operation(this, reg);

    // Write operation
    if (rule.write && result !== undefined) {
      this.WriteMemory(rule.addressMode, operand, result);
    }
  }
}
