import OpCodeGenRule from "./OpCodeGenRule";
import OpCodeGenParams from "./OpCodeGenParams";
import ProcessorStatus from "./ProcessorStatus";
import Memory from "../Memory";
import { ProcessorStatusFlag } from "./ProcessorStatusFlag";
import Registers from "./Registers";
import AddressMode from "./AddressMode";

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
  //
  // **********************************

export default class cpu6502 {
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
		this.Memory.WriteByte(this.StackBase + this.Registers.SP, value);
    
    // SP loops round 8 bits
    this.Registers.SP = (this.Registers.SP - 1) & 0xFF;
	}
  
	private pop(): number {
		this.Registers.SP = (this.Registers.SP + 1) & 0xFF;
		return this.Memory.ReadByte(this.StackBase + this.Registers.SP);
	}  

  // ------------------------------------
  // Shifts a number to left or right.
  // Carry flag receives the shifted out
  // bit. If rotate: true, then existing
  // carry shifted into new/empty bit.
  // ------------------------------------
  public rotate(value: number, shiftRight: boolean, rotate: boolean) {
    let oldCarry = this.Registers.P.IsSet(ProcessorStatusFlag.Carry) ? 1 : 0;
    let newCarry = shiftRight ? (value && 1) : (value >> 7);
    let result = shiftRight ? value >> 1 : value << 1;
    if (rotate) {
      result = shiftRight ? (result & oldCarry << 7) : (result & oldCarry);
    }
    return result;
  }

  // ------------------------------------------
  // Add with carry
  //
  // returns: A + M + C
  // If d flag set, then does BCD version.
  // Carry flag set in this function. Zero +
  // Negative flags must be set separately.
  // TO DO: V flag not being set.
  // ------------------------------------------
  public adc(value: number): number {

    if (this.Registers.P.IsSet(ProcessorStatusFlag.Decimal)) {
      // bcd version
      var ah = 0;
      var tempb = (this.Registers.A + value + (this.Registers.P.IsSet(ProcessorStatusFlag.Carry) ? 1 : 0)) & 0xff;
      var al = (this.Registers.A & 0xf) + (value & 0xf) + (this.Registers.P.IsSet(ProcessorStatusFlag.Carry) ? 1 : 0);
      if (al > 9) {
          al -= 10;
          al &= 0xf;
          ah = 1;
      }

      ah += (this.Registers.A >>> 4) + (value >>> 4);
      this.Registers.P.Clear(ProcessorStatusFlag.Carry)
      if (ah > 9) {
        this.Registers.P.Set(ProcessorStatusFlag.Carry);
          ah -= 10;
          ah &= 0xf;
      }
      return ((al & 0xf) | (ah << 4)) & 0xff;
    } else {
      let result = this.Registers.A + value + (this.Registers.P.IsSet(ProcessorStatusFlag.Carry) ? 1 : 0);
      if ((result >> 8) > 0) {
        this.Registers.P.Set(ProcessorStatusFlag.Carry)
      } else {
        this.Registers.P.Clear(ProcessorStatusFlag.Carry)
      }
      result &= 0xff;
      return result;
    }
  }

  // ---------------------------------
  // Assembles 6502 assembly code
  // to 6502 machine code.
  // ---------------------------------
  public Assemble(source: string): Uint8Array {

    let lines = source.split("\n");

    // remove comments
    lines.forEach(line => {
      let code = line.split(';')[0];
    });

    return new Uint8Array();
  }

  // -------------------------------
  // Assembles 1 line.
  // -------------------------------
  public AssembleLine(line: string): Uint8Array {

    let arr = new Uint8Array();
    console.log(line);

    // Basic regex to parse line
    let re = /^(?<label>[A-Za-z][A-Za-z0-9_]*[:])*[\s]*(?<instruction>[A-Za-z]{3})(?<operand>.*)*$/;
    let results = line.match(re);
    if (results == null || typeof (results) == "undefined") {
      throw new Error("Invalid format");
    } else {
      let groups = results.groups;
      if (groups) {
        let operand = (groups["operand"]);
        if (typeof (operand) == "undefined") {
          operand = "";
        }
        operand = operand.toUpperCase().trim();
        let instruction = groups["instruction"].toUpperCase().trim();
        var addressModeResult = AddressMode.Parse(operand);

        let bytes = addressModeResult.AddressMode.bytes;
        let addressMode = addressModeResult.AddressMode.mode;
        let value = addressModeResult.Value;

        // Find op code
        let opCodes = this.opCodes6502Array.filter(a => a.rule.Instruction === instruction && a.rule.AddressMode === addressMode);

        if (opCodes.length > 0) {
            // Found the op code
            switch (bytes) {
              case 1:
                return new Uint8Array([opCodes[0].key]);
                break;
              case 2:
                let byte = (value ?? 0) & 0xFF;
                return new Uint8Array([opCodes[0].key, byte]);
                break;
              case 3:
                // little-endian format
                let lo = (value ?? 0) & 0xFF;
                let hi = ((value ?? 0) >> 8) & 0xFF;
                return new Uint8Array([opCodes[0].key, lo, hi]);
              default:
                throw new Error("Op code should be 1,2 or 3 bytes long.");
            }
        } else {
          throw new Error("Cannot find single op code");
        }
      } else {
        throw new Error("Invalid format");
      }
    }
  }

  // ------------------------------------
  // Compare
  //
  // Used for CMP, CPX, CPY instructions
  // Compares A/X/Y with memory, and sets
  // flags as follows:
  // C: If A/X/Y >= M
  // Z: If A/X/Y == M
  // N: If A/X/Y < M
  // ------------------------------------
  public compare(register: number, memory: number) {
    this.Registers.P.Clear(ProcessorStatusFlag.Carry);
    this.Registers.P.Clear(ProcessorStatusFlag.Zero);
    this.Registers.P.Clear(ProcessorStatusFlag.Negative);
    let result: number = register - memory
    if (result == 0) {
      this.Registers.P.Set(ProcessorStatusFlag.Zero);
    }
    if (result >= 0) {
      this.Registers.P.Set(ProcessorStatusFlag.Carry);
    }
    if (result < 0) {
      this.Registers.P.Set(ProcessorStatusFlag.Negative);
    }
  }

  private FetchInstruction(): number {
    let instruction = this.Memory.ReadByte(this.Registers.PC);
    this.Registers.PC = (this.Registers.PC++) & 0xFFFF;
    return instruction;
  }

  // ---------------------------
  // Executes next op code
  // ---------------------------
  Execute() {

  }

  // Gets the memory offset relating to a particular addressing mode
  private GetMemoryOffset(addressMode: string, operand: number | null): number | null {
    operand = operand ?? 0;
    switch (addressMode) {
      case "#":       // immediate
        return null;
        break;
      case "A":       // A register
        return null;
        break;
      case "abs":     // absolute
        return operand;
        break;
      case "abs,X":   // absolute, X-indexed
        return operand + this.Registers.X;
        break;
      case "abs,Y":   // absolute, Y-indexed
        return operand + this.Registers.Y;
        break;
      case "impl":    // implied
        return null;
        break;
      case "ind":     // indirect
        return operand; // location stores a 16-bit address
        break;
      case "X,ind":   // X-indexed, indirect
        let idx = this.Memory.ReadWord(operand + this.Registers.X);
        return idx;
        break;
      case "ind,Y":   // Indirect, Y-indexed
        let idy = this.Memory.ReadWord(operand) + this.Registers.Y;
        return idy;
        break;
      case "rel":     // relative branch / jump (relative to PC)
        return this.Registers.PC + operand;
        break;
      case "zpg":     // zero page
        return operand && 0xFF;
        break;
      case "zpg,X":   // zero page, X-indexed
        return (operand + this.Registers.X) && 0xFF;
        break;
      case "zpg,Y":   // zero page, Y-indexed
        return (operand + this.Registers.Y) && 0xFF;
        break;
      default:  // should not get here
        throw new Error(`Invalid addressing mode: ${addressMode}`);
    }
  }

  private ReadMemory(addressMode: string, operand: number | null): number | null {
    operand = operand ?? 0;
    let offset = this.GetMemoryOffset(addressMode, operand) ?? 0;
    switch (addressMode) {
      case "#":       // immediate
        return operand;
        break;
      case "A":       // A register
        return this.Registers.A
        break;
      case "abs":     // absolute
        return this.Memory.ReadByte(offset);
        break;
      case "abs,X":   // absolute, X-indexed
        return this.Memory.ReadByte(offset);
        break;
      case "abs,Y":   // absolute, Y-indexed
        return this.Memory.ReadByte(offset);
        break;
      case "impl":    // implied
        return null;
        break;
      case "ind":     // indirect
        return this.Memory.ReadWord(offset); // location stores a 16-bit address
        break;
      case "X,ind":   // X-indexed, indirect
        return this.Memory.ReadByte(offset);
        break;
      case "ind,Y":   // Indirect, Y-indexed
        return this.Memory.ReadByte(offset);
        break;
      case "rel":     // relative branch / jump (relative to PC)
        return this.Registers.PC + operand;
        break;
      case "zpg":     // zero page
        return this.Memory.ReadByte(offset);
        break;
      case "zpg,X":   // zero page, X-indexed
        return this.Memory.ReadByte(offset);
        break;
      case "zpg,Y":   // zero page, Y-indexed
        return this.Memory.ReadByte(offset);
        break;
      default:  // should not get here
        throw new Error(`Invalid addressing mode: ${addressMode}`);
    }
  }

  private WriteMemory(offset: number, value: number): void {
    this.Memory.WriteByte(offset, value);
  }

  // -----------------------------
  // Returns op codes as an array.
  // -----------------------------
  get opCodes6502Array(): Array<{ key: number, rule: OpCodeGenRule }> {
    let rules = [];
    for (const [key, value] of Object.entries(this.opCodes6502)) {
      rules.push({
        key: parseInt(key),
        rule: value
      });
    }
    return rules;
  }

  get opCodes6502(): { [key: number]: OpCodeGenRule } {
    return this.opCodes6502Documented;
  }

  private opCodes6502Documented: { [key: number]: OpCodeGenRule } = {
    //0x00: "BRK impl",
    0x01: new OpCodeGenRule({ instruction: "ORA", addressMode: "X,ind", operation: "cpu.Registers.A = cpu.Registers.A | OPERAND", affectNFlag: true, affectZFlag: true }),
    0x05: new OpCodeGenRule({ instruction: "ORA", addressMode: "zpg", operation: "cpu.Registers.A = cpu.Registers.A | OPERAND", affectNFlag: true, affectZFlag: true }),
    0x06: new OpCodeGenRule({ instruction: "ASL", addressMode: "zpg", operation: "OPERAND = rotate(OPERAND, false, false);", affectNFlag: true, affectZFlag: true, write: true }),
    0x08: new OpCodeGenRule({ instruction: "PHP", addressMode: "impl", operation: "cpu.push(this.Registers.P.value);" }),
    0x09: new OpCodeGenRule({ instruction: "ORA", addressMode: "#", operation: "cpu.Registers.A = cpu.Registers.A | OPERAND", affectNFlag: true, affectZFlag: true }),
    0x0A: new OpCodeGenRule({ instruction: "ASL", addressMode: "A", operation: "cpu.Registers.A = rotate(cpu.Registers.A, false, false);", affectNFlag: true, affectZFlag: true }),
    0x0D: new OpCodeGenRule({ instruction: "ORA", addressMode: "abs", operation: "cpu.Registers.A = cpu.Registers.A | OPERAND", affectNFlag: true, affectZFlag: true }),
    0x0E: new OpCodeGenRule({ instruction: "ASL", addressMode: "abs", operation: "OPERAND = rotate(OPERAND, false, false);", affectNFlag: true, affectZFlag: true, write: true }),
    //0x10: "BPL rel",
    0x11: new OpCodeGenRule({ instruction: "ORA", addressMode: "ind,Y", operation: "cpu.Registers.A = cpu.Registers.A | OPERAND", affectNFlag: true, affectZFlag: true }),
    0x15: new OpCodeGenRule({ instruction: "ORA", addressMode: "zpg,X", operation: "cpu.Registers.A = cpu.Registers.A | OPERAND", affectNFlag: true, affectZFlag: true }),
    0x16: new OpCodeGenRule({ instruction: "ASL", addressMode: "zpg,X", operation: "OPERAND = rotate(OPERAND, false, false);", affectNFlag: true, affectZFlag: true, write: true }),
    0x18: new OpCodeGenRule({ instruction: "CLC", addressMode: "impl", operation: "cpu.Registers.P.Clear(ProcessorStatusFlag.Carry);" }),
    0x19: new OpCodeGenRule({ instruction: "ORA", addressMode: "abs,Y", operation: "cpu.Registers.A = cpu.Registers.A | OPERAND", affectNFlag: true, affectZFlag: true }),
    0x1D: new OpCodeGenRule({ instruction: "ORA", addressMode: "abs,X", operation: "cpu.Registers.A = cpu.Registers.A | OPERAND", affectNFlag: true, affectZFlag: true }),
    0x1E: new OpCodeGenRule({ instruction: "ASL", addressMode: "abs,X", operation: "OPERAND = rotate(OPERAND, false, false);", affectNFlag: true, affectZFlag: true, write: true }),
    //0x20: "JSR abs",
    0x21: new OpCodeGenRule({ instruction: "AND", addressMode: "X,ind", operation: "cpu.Registers.A &= OPERAND;", affectNFlag: true, affectZFlag: true }),
    //0x24: "BIT zpg",
    0x25: new OpCodeGenRule({ instruction: "AND", addressMode: "zpg", operation: "cpu.Registers.A &= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x26: new OpCodeGenRule({ instruction: "ROL", addressMode: "zpg", operation: "OPERAND = rotate(OPERAND, false, true);", affectNFlag: true, affectZFlag: true, write: true }),
    0x28: new OpCodeGenRule({ instruction: "PLP", addressMode: "impl", operation: "cpu.Registers.P.value = cpu.pop();" }),
    0x29: new OpCodeGenRule({ instruction: "AND", addressMode: "#", operation: "cpu.Registers.A &= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x2A: new OpCodeGenRule({ instruction: "ROL", addressMode: "A", operation: "cpu.Registers.A = rotate(cpu.Registers.A, false, true);", affectNFlag: true, affectZFlag: true }),
    //0x2C: "BIT abs",
    0x2D: new OpCodeGenRule({ instruction: "AND", addressMode: "abs", operation: "cpu.Registers.A &= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x2E: new OpCodeGenRule({ instruction: "ROL", addressMode: "abs", operation: "OPERAND = rotate(OPERAND, false, true);", affectNFlag: true, affectZFlag: true, write: true }),
    //0x30: "BMI rel",
    0x31: new OpCodeGenRule({ instruction: "AND", addressMode: "ind,Y", operation: "cpu.Registers.A &= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x35: new OpCodeGenRule({ instruction: "AND", addressMode: "zpg,X", operation: "cpu.Registers.A &= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x36: new OpCodeGenRule({ instruction: "ROL", addressMode: "zpg,X", operation: "OPERAND = rotate(OPERAND, false, true);", affectNFlag: true, affectZFlag: true, write: true }),
    //0x38: "SEC impl",
    0x39: new OpCodeGenRule({ instruction: "AND", addressMode: "abs,Y", operation: "cpu.Registers.A &= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x3D: new OpCodeGenRule({ instruction: "AND", addressMode: "abs,X", operation: "cpu.Registers.A &= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x3E: new OpCodeGenRule({ instruction: "ROL", addressMode: "abs,X", operation: "OPERAND = rotate(OPERAND, false, true);", affectNFlag: true, affectZFlag: true, write: true }),
    //0x40: "RTI impl",
    0x41: new OpCodeGenRule({ instruction: "EOR", addressMode: "X,ind", operation: "cpu.Registers.A ^= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x45: new OpCodeGenRule({ instruction: "EOR", addressMode: "zpg", operation: "cpu.Registers.A ^= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x46: new OpCodeGenRule({ instruction: "LSR", addressMode: "zpg", operation: "OPERAND = rotate(OPERAND, true, false);", affectNFlag: true, affectZFlag: true, write: true }),
    0x48: new OpCodeGenRule({ instruction: "PHA", addressMode: "impl", operation: "cpu.push(this.Registers.A);" }),
    0x49: new OpCodeGenRule({ instruction: "EOR", addressMode: "#", operation: "cpu.Registers.A ^= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x4A: new OpCodeGenRule({ instruction: "LSR", addressMode: "A", operation: "cpu.Registers.A = rotate(cpu.Registers.A, true, false);", affectNFlag: true, affectZFlag: true }),
    //0x4C: "JMP abs",
    0x4D: new OpCodeGenRule({ instruction: "EOR", addressMode: "abs", operation: "cpu.Registers.A ^= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x4E: new OpCodeGenRule({ instruction: "LSR", addressMode: "abs", operation: "OPERAND = rotate(OPERAND, true, false);", affectNFlag: true, affectZFlag: true, write: true }),
    //0x50: "BVC rel",
    0x51: new OpCodeGenRule({ instruction: "EOR", addressMode: "ind,Y", operation: "cpu.Registers.A ^= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x55: new OpCodeGenRule({ instruction: "EOR", addressMode: "zpg,X", operation: "cpu.Registers.A ^= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x56: new OpCodeGenRule({ instruction: "LSR", addressMode: "zpg,X", operation: "OPERAND = rotate(OPERAND, true, false);", affectNFlag: true, affectZFlag: true, write: true }),
    0x58: new OpCodeGenRule({ instruction: "CLI", addressMode: "impl", operation: "cpu.Registers.P.Clear(ProcessorStatusFlag.Interrupt);" }),
    0x59: new OpCodeGenRule({ instruction: "EOR", addressMode: "abs,Y", operation: "cpu.Registers.A ^= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x5D: new OpCodeGenRule({ instruction: "EOR", addressMode: "abs,X", operation: "cpu.Registers.A ^= OPERAND;", affectNFlag: true, affectZFlag: true }),
    0x5E: new OpCodeGenRule({ instruction: "LSR", addressMode: "abs,X", operation: "OPERAND = rotate(OPERAND, true, false);", affectNFlag: true, affectZFlag: true, write: true }),
    //0x60: "RTS impl",
    0x61: new OpCodeGenRule({ instruction: "ADC", addressMode: "X,ind", operation: "cpu.Registers.A = cpu.adc(OPERAND);", affectNFlag: true, affectZFlag: true }),
    0x65: new OpCodeGenRule({ instruction: "ADC", addressMode: "zpg", operation: "cpu.Registers.A = cpu.adc(OPERAND);", affectNFlag: true, affectZFlag: true }),
    0x66: new OpCodeGenRule({ instruction: "ROR", addressMode: "zpg", operation: "OPERAND = rotate(OPERAND, true, true);", affectNFlag: true, affectZFlag: true, write: true }),
    0x68: new OpCodeGenRule({ instruction: "PLA", addressMode: "impl", operation: "cpu.Registers.A = cpu.pop();", affectNFlag: true, affectZFlag: true }),
    0x69: new OpCodeGenRule({ instruction: "ADC", addressMode: "#", operation: "cpu.Registers.A = cpu.adc(OPERAND);", affectNFlag: true, affectZFlag: true }),
    0x6A: new OpCodeGenRule({ instruction: "ROR", addressMode: "A", operation: "cpu.Registers.A = rotate(cpu.Registers.A, true, true);", affectNFlag: true, affectZFlag: true }),
    //0x6C: "JMP ind",
    0x6D: new OpCodeGenRule({ instruction: "ADC", addressMode: "abs", operation: "cpu.Registers.A = cpu.adc(OPERAND);", affectNFlag: true, affectZFlag: true }),
    0x6E: new OpCodeGenRule({ instruction: "ROR", addressMode: "abs", operation: "OPERAND = rotate(OPERAND, true, true);", affectNFlag: true, affectZFlag: true, write: true }),
    //0x70: "BVS rel",
    0x71: new OpCodeGenRule({ instruction: "ADC", addressMode: "ind,Y", operation: "cpu.Registers.A = cpu.adc(OPERAND);", affectNFlag: true, affectZFlag: true }),
    0x75: new OpCodeGenRule({ instruction: "ADC", addressMode: "zpg,X", operation: "cpu.Registers.A = cpu.adc(OPERAND);", affectNFlag: true, affectZFlag: true }),
    0x76: new OpCodeGenRule({ instruction: "ROR", addressMode: "zpg,X", operation: "OPERAND = rotate(OPERAND, true, true);", affectNFlag: true, affectZFlag: true, write: true }),
    //0x78: "SEI impl",
    0x79: new OpCodeGenRule({ instruction: "ADC", addressMode: "abs,Y", operation: "cpu.Registers.A = cpu.adc(OPERAND);", affectNFlag: true, affectZFlag: true }),
    0x7D: new OpCodeGenRule({ instruction: "ADC", addressMode: "abs,X", operation: "cpu.Registers.A = cpu.adc(OPERAND);", affectNFlag: true, affectZFlag: true }),
    0x7E: new OpCodeGenRule({ instruction: "ROR", addressMode: "abs,X", operation: "OPERAND = rotate(OPERAND, true, true);", affectNFlag: true, affectZFlag: true, write: true }),
    0x81: new OpCodeGenRule({ instruction: "STA", addressMode: "X,ind", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x84: new OpCodeGenRule({ instruction: "STY", addressMode: "zpg", operation: "OPERAND = cpu.Registers.Y;", write: true }),
    0x85: new OpCodeGenRule({ instruction: "STA", addressMode: "zpg", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x86: new OpCodeGenRule({ instruction: "STX", addressMode: "zpg", operation: "OPERAND = cpu.Registers.X;", write: true }),
    0x88: new OpCodeGenRule({ instruction: "DEY", addressMode: "impl", operation: "cpu.Registers.Y = (cpu.Registers.Y - 1) & 0xFF;", affectNFlag: true, affectZFlag: true }),
    0x8A: new OpCodeGenRule({ instruction: "TXA", addressMode: "impl", operation: "cpu.Registers.A = cpu.Registers.X;", affectZFlag: true, affectNFlag: true }),
    0x8C: new OpCodeGenRule({ instruction: "STY", addressMode: "abs", operation: "OPERAND = cpu.Registers.Y;", write: true }),
    0x8D: new OpCodeGenRule({ instruction: "STA", addressMode: "abs", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x8E: new OpCodeGenRule({ instruction: "STX", addressMode: "abs", operation: "OPERAND = cpu.Registers.X;", write: true }),
    //0x90: "BCC rel",
    0x91: new OpCodeGenRule({ instruction: "STA", addressMode: "ind,Y", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x94: new OpCodeGenRule({ instruction: "STY", addressMode: "zpg,X", operation: "OPERAND = cpu.Registers.Y;", write: true }),
    0x95: new OpCodeGenRule({ instruction: "STA", addressMode: "zpg,X", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x96: new OpCodeGenRule({ instruction: "STX", addressMode: "zpg,Y", operation: "OPERAND = cpu.Registers.X;", write: true }),
    0x98: new OpCodeGenRule({ instruction: "TYA", addressMode: "impl", operation: "cpu.Registers.A = cpu.Registers.Y;", affectZFlag: true, affectNFlag: true }),
    0x99: new OpCodeGenRule({ instruction: "STA", addressMode: "abs,Y", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x9A: new OpCodeGenRule({ instruction: "TXS", addressMode: "impl", operation: "cpu.Registers.SP = cpu.Registers.X;" }),
    0x9D: new OpCodeGenRule({ instruction: "STA", addressMode: "abs,X", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0xA0: new OpCodeGenRule({ instruction: "LDY", addressMode: "#", operation: "cpu.Registers.Y = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xA1: new OpCodeGenRule({ instruction: "LDA", addressMode: "X,ind", operation: "cpu.Registers.A = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xA2: new OpCodeGenRule({ instruction: "LDX", addressMode: "#", operation: "cpu.Registers.X = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xA4: new OpCodeGenRule({ instruction: "LDY", addressMode: "zpg", operation: "cpu.Registers.Y = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xA5: new OpCodeGenRule({ instruction: "LDA", addressMode: "zpg", operation: "cpu.Registers.A = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xA6: new OpCodeGenRule({ instruction: "LDX", addressMode: "zpg", operation: "cpu.Registers.X = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xA8: new OpCodeGenRule({ instruction: "TAY", addressMode: "impl", operation: "cpu.Registers.Y = cpu.Registers.A;", affectZFlag: true, affectNFlag: true }),
    0xA9: new OpCodeGenRule({ instruction: "LDA", addressMode: "#", operation: "cpu.Registers.A = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xAA: new OpCodeGenRule({ instruction: "TAX", addressMode: "impl", operation: "cpu.Registers.X = cpu.Registers.A;", affectZFlag: true, affectNFlag: true }),
    0xAC: new OpCodeGenRule({ instruction: "LDY", addressMode: "abs", operation: "cpu.Registers.Y = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xAD: new OpCodeGenRule({ instruction: "LDA", addressMode: "abs", operation: "cpu.Registers.A = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xAE: new OpCodeGenRule({ instruction: "LDX", addressMode: "abs", operation: "cpu.Registers.X = OPERAND;", affectZFlag: true, affectNFlag: true }),
    //0xB0: "BCS rel",
    0xB1: new OpCodeGenRule({ instruction: "LDA", addressMode: "ind,Y", operation: "cpu.Registers.A = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xB4: new OpCodeGenRule({ instruction: "LDY", addressMode: "zpg,X", operation: "cpu.Registers.Y = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xB5: new OpCodeGenRule({ instruction: "LDA", addressMode: "zpg,X", operation: "cpu.Registers.A = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xB6: new OpCodeGenRule({ instruction: "LDX", addressMode: "zpg,Y", operation: "cpu.Registers.X = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xB8: new OpCodeGenRule({ instruction: "CLV", addressMode: "impl", operation: "cpu.Registers.P.Clear(ProcessorStatusFlag.Overflow);" }),
    0xB9: new OpCodeGenRule({ instruction: "LDA", addressMode: "abs,Y", operation: "cpu.Registers.A = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xBA: new OpCodeGenRule({ instruction: "TSX", addressMode: "impl", operation: "cpu.Registers.X = cpu.Registers.SP;", affectZFlag: true, affectNFlag: true }),
    0xBC: new OpCodeGenRule({ instruction: "LDY", addressMode: "abs,X", operation: "cpu.Registers.Y = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xBD: new OpCodeGenRule({ instruction: "LDA", addressMode: "abs,X", operation: "cpu.Registers.A = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xBE: new OpCodeGenRule({ instruction: "LDX", addressMode: "abs,Y", operation: "cpu.Registers.X = OPERAND;", affectZFlag: true, affectNFlag: true }),
    0xC0: new OpCodeGenRule({ instruction: "CPY", addressMode: "#", operation: "cpu.compare(cpu.Registers.Y, OPERAND);" }),
    0xC1: new OpCodeGenRule({ instruction: "CMP", addressMode: "x,ind", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xC4: new OpCodeGenRule({ instruction: "CPY", addressMode: "zpg", operation: "cpu.compare(cpu.Registers.Y, OPERAND);" }),
    0xC5: new OpCodeGenRule({ instruction: "CMP", addressMode: "zpg", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xC6: new OpCodeGenRule({ instruction: "DEC", addressMode: "zpg", operation: "OPERAND = (OPERAND - 1) & 0xFF;", affectNFlag: true, affectZFlag: true, write: true }),
    0xC8: new OpCodeGenRule({ instruction: "INY", addressMode: "impl", operation: "cpu.Registers.Y = (cpu.Registers.Y + 1) & 0xFF;", affectNFlag: true, affectZFlag: true }),
    0xC9: new OpCodeGenRule({ instruction: "CMP", addressMode: "#", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xCA: new OpCodeGenRule({ instruction: "DEX", addressMode: "impl", operation: "cpu.Registers.X = (cpu.Registers.X - 1) & 0xFF;", affectNFlag: true, affectZFlag: true }),
    0xCC: new OpCodeGenRule({ instruction: "CPY", addressMode: "abs", operation: "cpu.compare(cpu.Registers.Y, OPERAND);" }),
    0xCD: new OpCodeGenRule({ instruction: "CMP", addressMode: "abs", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xCE: new OpCodeGenRule({ instruction: "DEC", addressMode: "abs", operation: "OPERAND = (OPERAND - 1) & 0xFF;", affectNFlag: true, affectZFlag: true, write: true }),
    //0xD0: "BNE rel",
    0xD1: new OpCodeGenRule({ instruction: "CMP", addressMode: "ind,Y", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xD5: new OpCodeGenRule({ instruction: "CMP", addressMode: "zpg,X", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xD6: new OpCodeGenRule({ instruction: "DEC", addressMode: "zpg,X", operation: "OPERAND = (OPERAND - 1) & 0xFF;", affectNFlag: true, affectZFlag: true, write: true }),
    0xD8: new OpCodeGenRule({ instruction: "CLD", addressMode: "impl", operation: "cpu.Registers.P.Clear(ProcessorStatusFlag.Decimal);" }),
    0xD9: new OpCodeGenRule({ instruction: "CMP", addressMode: "abs,Y", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xDD: new OpCodeGenRule({ instruction: "CMP", addressMode: "abs,X", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xDE: new OpCodeGenRule({ instruction: "DEC", addressMode: "abs,X", operation: "OPERAND = (OPERAND - 1) & 0xFF;", affectNFlag: true, affectZFlag: true, write: true }),
    0xE0: new OpCodeGenRule({ instruction: "CPX", addressMode: "#", operation: "cpu.compare(cpu.Registers.X, OPERAND);" }),
    //0xE1: "SBC X,ind",
    0xE4: new OpCodeGenRule({ instruction: "CPX", addressMode: "zpg", operation: "cpu.compare(cpu.Registers.X, OPERAND);" }),
    //0xE5: "SBC zpg",
    0xE6: new OpCodeGenRule({ instruction: "INC", addressMode: "zpg", operation: "OPERAND = (OPERAND + 1) & 0xFF;", affectNFlag: true, affectZFlag: true, write: true }),
    0xE8: new OpCodeGenRule({ instruction: "INX", addressMode: "impl", operation: "cpu.Registers.X = (cpu.Registers.X + 1) & 0xFF;", affectNFlag: true, affectZFlag: true }),
    //0xE9: "SBC #",
    0xEA: new OpCodeGenRule({ instruction: "NOP", addressMode: "impl", operation: "" }),
    0xEC: new OpCodeGenRule({ instruction: "CPX", addressMode: "abs", operation: "cpu.compare(cpu.Registers.X, OPERAND);" }),
    //0xED: "SBC abs",
    0xEE: new OpCodeGenRule({ instruction: "INC", addressMode: "abs", operation: "OPERAND = (OPERAND + 1) & 0xFF;", affectNFlag: true, affectZFlag: true, write: true }),
    //0xF0: "BEQ rel",
    //0xF1: "SBC ind,Y",
    //0xF5: "SBC zpg,X",
    0xF6: new OpCodeGenRule({ instruction: "INC", addressMode: "zpg,X", operation: "OPERAND = (OPERAND + 1) & 0xFF;", affectNFlag: true, affectZFlag: true, write: true }),
    //0xF8: "SED impl",
    //0xF9: "SBC abs,Y",
    //0xFD: "SBC abs,X",
    0xFE: new OpCodeGenRule({ instruction: "INC", addressMode: "abs,X", operation: "OPERAND = (OPERAND + 1) & 0xFF;", affectNFlag: true, affectZFlag: true, write: true }),
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

  // -------------------------------
  // CreateOpCodeFunction
  //
  // Creates the function to execute
  // the op code.
  // --------------------------------
  private CreateOpCodeFunction(rule: OpCodeGenRule) {

    let code = `

let OPERAND = cpu.ReadMemory('${rule.AddressMode}', operand);
${rule.Operation};
if (${rule.AffectNFlag}) {

}
// Write
if (${rule.Write}) {
  cpu.WriteMemory('${rule.AddressMode}', operand);
  }

    `;
    return new Function("cpu", "operand", code)

  }

  public hello(str: string) {
    alert(str);
  }

}  

