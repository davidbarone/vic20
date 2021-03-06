import OpCodeGenRule from "./OpCodeGenRule";
import OpCodeGenParams from "./OpCodeGenParams";
import ProcessorStatus from "./ProcessorStatus";
import Memory from "../Memory/Memory";
import { ProcessorStatusFlag } from "./ProcessorStatusFlag";
import Registers from "./Registers";
import AddressMode from "./AddressMode";
import Utils from "../Utils"

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
  //
  // Generally used to update accumulator.
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

  // ------------------------------------------
  // Subtract with carry
  //
  // returns: A-M-(1-C)
  // If d flag set, then does BCD version.
  // Carry flag set in this function. Zero +
  // Negative flags must be set separately.
  // TO DO: V flag not being set.
  //
  // Generally used to update accumulator.
  // ------------------------------------------
  public sbc(value: number): number {

    var carry = this.Registers.P.IsSet(ProcessorStatusFlag.Carry) ? 1 : 0;

    if (this.Registers.P.IsSet(ProcessorStatusFlag.Decimal)) {
      // bcd version
      let al = (this.Registers.A & 0xf) - (value & 0xf) - carry;

      let ah = (this.Registers.A >>> 4) - (value >>> 4);

      if (al & 0x10) {
        al = (al - 6) & 0xf;
        ah--;
      }
      if (ah & 0x10) {
        ah = (ah - 6) & 0xf;
      }

      let result = this.Registers.A - value - carry;
      //this.Registers.P.Negative = !!(result & 0x80);
      //this.Registers.P.Zero = !(result & 0xff);
      //this.Registers.P.Overflow = !!((cpu.a ^ result) & (subend ^ cpu.a) & 0x80);
      //this.Registers.P.Carry = !(result & 0x100);
      return al | (ah << 4);
    } else {
      // one's complement
      return this.adc(value ^ 0xff);
    }
  }

  // ----------------------------------
  // branch()
  // 
  // sets PC
  // ----------------------------------
  public branch(condition: { (): boolean }, offset: number) {
    if (condition()) {
      this.Registers.PC = (this.Registers.PC + offset) & 0xffff;
    }
    // TODO: Page boundary crossed? Need to add timing
  }

  public brk() {
    // TODO
  }

  // -------------------------------------------
  // Loads image / data into memory
  // -------------------------------------------
  public Load(offset: number, data: Uint8Array): void {
    for (let i = 0; i < data.length; i++) {
      this.Memory.WriteByte(offset + i, data[i])
    }
  }

  /**
   * Sets the zero and negative status flags
   * @param v 
   * @returns 
   */
  public setzn(v: number) {
    v &= 0xff;  // single byte
    let a = !v;

    this.Registers.P.SetValue(ProcessorStatusFlag.Zero, !v);
    this.Registers.P.SetValue(ProcessorStatusFlag.Negative, !!(v & 0x80));

    return v | 0;
  };

  // ----------------------------------
  // Disassembles block of instructions
  // ----------------------------------
  public Disassemble(offset: number, limit: number): Array<{ Address: string, Bytes: string, Disassembly: string; NextInstruction: number; }> {

    let results: Array<{ Address: string, Bytes: string, Disassembly: string; NextInstruction: number; }> = new Array();
    while (limit > 0) {
      let result = this.DisassembleSingle(offset);
      results.push(result);
      limit--;
      offset = result.NextInstruction;
    }
    return results;
  }

  // -------------------------------
  // Disassembles single instruction
  // -------------------------------
  public DisassembleSingle(offset: number): { Address: string, Bytes: string, Disassembly: string; NextInstruction: number; } {

    let bytes: Array<number> = new Array<number>();
    let byte = this.Memory.ReadByte(offset);
    bytes.push(byte);
    let opCode = this.opCodes6502[byte];

    if (!opCode) {
      return {
        Address: Utils.NumberToHex(offset),
        Bytes: Utils.UInt8ArrayToHex(new Uint8Array([byte])),
        Disassembly: '???',
        NextInstruction: offset + 1
      }
    } else {
      // valid opcode
      let addressMode = AddressMode.GetRule(opCode.AddressMode);
      let operandLo: number = 0;
      let operandHi: number = 0;
      let value: number = 0;
      let valueHex: string = ""
      if (addressMode.bytes > 1) {
        operandLo = this.Memory.ReadByte(offset + 1);
        value = operandLo;
        bytes.push(operandLo);
      }
      if (addressMode.bytes > 2) {
        operandHi = this.Memory.ReadByte(offset + 2);
        value = (operandHi << 8) + operandLo;
        bytes.push(operandHi);
      }

      // For relative address mode, we replace the relative operand with an 
      // absolute 16-bit memory value. Normally, the operand would be a
      // label anyway.
      if (addressMode.mode === "rel") {
        let valueUint8 = (value & 0xff);
        let valueSigned = valueUint8 > 0x7f ? valueUint8 - 0x100 : valueUint8;
        value = offset + addressMode.bytes + valueSigned;
      }

      valueHex = Utils.NumberToHex(value);

      return {
        Address: Utils.NumberToHex(offset),
        Bytes: Utils.UInt8ArrayToHex(new Uint8Array(bytes)),
        Disassembly: `${opCode.Instruction} ${addressMode.format.replace("{value}", valueHex)}`.trim(),
        NextInstruction: offset + addressMode.bytes
      }
    }
  }

  // ---------------------------------
  // Assembles 6502 assembly code
  // to 6502 machine code.
  // ---------------------------------
  public Assemble(source: string): Uint8Array {

    let bytes = new Uint8Array();
    let lines = source.split("\n");
    let pc: number = 0;   // program counter
    let labels = {} // branching labels

    // remove comments
    lines.forEach(line => {
      let code = line.split(';')[0].trim().toUpperCase();
      if (code !== "") {
        let newBytes = this.AssembleLine(code, pc, labels);
        pc += newBytes.length;
        var mergedArray = new Uint8Array(bytes.length + newBytes.length);
        mergedArray.set(bytes);
        mergedArray.set(newBytes, bytes.length);
        bytes = mergedArray;
      }
    });

    return bytes;
  }

  // -------------------------------
  // Assembles 1 line.
  // -------------------------------
  public AssembleLine(line: string, pc: number, labels: { [name: string]: number; }): Uint8Array {

    let arr = new Uint8Array();

    if (!line) {
      // nothing on line.
      return new Uint8Array([]);
    }

    // Basic regex to parse line
    let re = /^(?<label>[A-Za-z][A-Za-z0-9_]*[:])*[\s]*(?<instruction>[A-Za-z]{3})*(?<operand>.*)*$/;
    let results = line.match(re);
    if (results == null || typeof (results) == "undefined") {
      throw new Error("Invalid format");
    } else {
      let groups = results.groups;
      if (groups) {
        let label = groups["label"];
        let operand = groups["operand"];
        let instruction = groups["instruction"];

        // add label?
        if (typeof (label) !== "undefined" && label) {
          label = label.toUpperCase().trim();
          label = label.substr(0, label.length - 1);  // remove ':'
          if (labels.hasOwnProperty(label)) {
            throw new Error(`Label ${label} already exists in code.`);
          }
          // add label
          labels[label] = pc;
        }

        // Process instruction on line?
        if (typeof (instruction) !== "undefined" && instruction) {
          instruction = instruction.toUpperCase().trim();
          if (typeof (operand) == "undefined") {
            operand = "";
          }
          operand = operand.toUpperCase().trim();

          // Address mode?
          var addressModeResult = AddressMode.Parse(operand, labels, pc);
          let bytes = addressModeResult.AddressMode.bytes;
          let addressMode = addressModeResult.AddressMode.mode;
          let value = addressModeResult.Value;

          // If the address mode is relative (branching), then the value
          // is relative 
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
          // No instruction on this line.
          if (operand) {
            throw new Error("Invalid format - operand specified without instruction.");
          } else {
            // Only a label specified. Don't return any bytes of code
            return new Uint8Array([]);
          }
        }
      } else {
        throw new Error("Invalid format.");
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
  // Cpu cycle
  // ---------------------------
  Cycle() {
    let instruction = this.FetchInstruction();
    let opcode = this.opCodes6502[instruction];
    let bytes = this.getOpcodeBytes(opcode.AddressMode);
    let operand: number = 0;
    if (bytes == 2)
      operand = this.Memory.ReadByte(this.Registers.PC++);
    else if (bytes == 3) {
      operand = this.Memory.ReadWord(this.Registers.PC);
      this.Registers.PC += 2;
    }
    if (bytes > 1) {
      let OPERAND = this.ReadMemory(opcode.AddressMode, operand);
    }



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

  /**
   * Gets the value based on the address mode and operand
   * @param addressMode 
   * @param operand 
   * @returns 
   */
  private ReadMemory(addressMode: string, operand: number | null): number {
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
        throw "No need to call ReadMemory function if address mode is impl";
        //return null;
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

  /**
   * Gets the number of bytes for the instruction based on the address mode
   * @param addressMode 
   */
  private getOpcodeBytes(addressMode: string) {
    let addressModes: any = {};
    addressModes["A"] = 1;     // accmulator
    addressModes["abs"] = 3;   // absolute
    addressModes["abs,X"] = 3; // absolute, X
    addressModes["abs,Y"] = 3; // absolute, Y
    addressModes["#"] = 2;     // immediate
    addressModes["impl"] = 1;  // implied
    addressModes["ind"] = 3;   // indirect
    addressModes["X,ind"] = 2; // (indirect, X)
    addressModes["ind,Y"] = 2; // (indirect), Y
    addressModes["rel"] = 2;   // relative
    addressModes["zpg"] = 2;   // zeropage
    addressModes["zpg,X"] = 2; // zeropage, X
    addressModes["zpg,Y"] = 2; // zeropage, Y

    if (!(addressMode in addressModes)) {
      throw `Invalid address mode: ${addressMode}`;
    } else {
      return addressModes[addressMode];
    }
  }

  private opCodes6502Documented: { [key: number]: OpCodeGenRule } = {
    0x00: new OpCodeGenRule({ instruction: "BRK", cycles: 7, addressMode: "impl", operation: "cpu.brk();" }),
    0x01: new OpCodeGenRule({ instruction: "ORA", cycles: 6, addressMode: "X,ind", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A | OPERAND);" }),
    0x05: new OpCodeGenRule({ instruction: "ORA", cycles: 3, addressMode: "zpg", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A | OPERAND);" }),
    0x06: new OpCodeGenRule({ instruction: "ASL", cycles: 5, addressMode: "zpg", operation: "OPERAND = cpu.setnz(rotate(OPERAND, false, false));", write: true }),
    0x08: new OpCodeGenRule({ instruction: "PHP", cycles: 3, addressMode: "impl", operation: "cpu.push(this.Registers.P.value);" }),
    0x09: new OpCodeGenRule({ instruction: "ORA", cycles: 2, addressMode: "#", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A | OPERAND);" }),
    0x0A: new OpCodeGenRule({ instruction: "ASL", cycles: 2, addressMode: "A", operation: "cpu.Registers.A = cpu.setnz(rotate(cpu.Registers.A, false, false));" }),
    0x0D: new OpCodeGenRule({ instruction: "ORA", cycles: 4, addressMode: "abs", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A | OPERAND);" }),
    0x0E: new OpCodeGenRule({ instruction: "ASL", cycles: 6, addressMode: "abs", operation: "OPERAND = cpu.setnz(rotate(OPERAND, false, false));", write: true }),
    0x10: new OpCodeGenRule({ instruction: "BPL", cycles: 2, addressMode: "rel", operation: "cpu.branch(() => {!cpu.Registers.P.IsSet(ProcessorStatusFlag.Negative), OPERAND);" }),
    0x11: new OpCodeGenRule({ instruction: "ORA", cycles: 5, addressMode: "ind,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A | OPERAND);" }),
    0x15: new OpCodeGenRule({ instruction: "ORA", cycles: 4, addressMode: "zpg,X", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A | OPERAND);" }),
    0x16: new OpCodeGenRule({ instruction: "ASL", cycles: 6, addressMode: "zpg,X", operation: "OPERAND = cpu.setnz(rotate(OPERAND, false, false));", write: true }),
    0x18: new OpCodeGenRule({ instruction: "CLC", cycles: 2, addressMode: "impl", operation: "cpu.Registers.P.Clear(ProcessorStatusFlag.Carry);" }),
    0x19: new OpCodeGenRule({ instruction: "ORA", cycles: 4, addressMode: "abs,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A | OPERAND);" }),
    0x1D: new OpCodeGenRule({ instruction: "ORA", cycles: 4, addressMode: "abs,X", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A | OPERAND);" }),
    0x1E: new OpCodeGenRule({ instruction: "ASL", cycles: 7, addressMode: "abs,X", operation: "OPERAND = cpu.setnz(rotate(OPERAND, false, false));", write: true }),
    //0x20: "JSR abs",
    0x21: new OpCodeGenRule({ instruction: "AND", cycles: 6, addressMode: "X,ind", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A & OPERAND);" }),
    //0x24: "BIT zpg",
    0x25: new OpCodeGenRule({ instruction: "AND", cycles: 3, addressMode: "zpg", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A & OPERAND);" }),
    0x26: new OpCodeGenRule({ instruction: "ROL", cycles: 5, addressMode: "zpg", operation: "OPERAND = cpu.setnz(rotate(OPERAND, false, true));", write: true }),
    0x28: new OpCodeGenRule({ instruction: "PLP", cycles: 4, addressMode: "impl", operation: "cpu.Registers.P.value = cpu.pop();" }),
    0x29: new OpCodeGenRule({ instruction: "AND", cycles: 2, addressMode: "#", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A & OPERAND);" }),
    0x2A: new OpCodeGenRule({ instruction: "ROL", cycles: 2, addressMode: "A", operation: "cpu.Registers.A = cpu.setnz(rotate(cpu.Registers.A, false, true));" }),
    //0x2C: "BIT abs",
    0x2D: new OpCodeGenRule({ instruction: "AND", cycles: 4, addressMode: "abs", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A & OPERAND);" }),
    0x2E: new OpCodeGenRule({ instruction: "ROL", cycles: 6, addressMode: "abs", operation: "OPERAND = cpu.setnz(rotate(OPERAND, false, true));", write: true }),
    0x30: new OpCodeGenRule({ instruction: "BMI", cycles: 2, addressMode: "rel", operation: "cpu.branch(() => {cpu.Registers.P.IsSet(ProcessorStatusFlag.Negative), OPERAND);" }),
    0x31: new OpCodeGenRule({ instruction: "AND", cycles: 5, addressMode: "ind,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A & OPERAND);" }),
    0x35: new OpCodeGenRule({ instruction: "AND", cycles: 4, addressMode: "zpg,X", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A & OPERAND);" }),
    0x36: new OpCodeGenRule({ instruction: "ROL", cycles: 6, addressMode: "zpg,X", operation: "OPERAND = cpu.setnz(rotate(OPERAND, false, true));", write: true }),
    0x38: new OpCodeGenRule({ instruction: "SEC", cycles: 2, addressMode: "impl", operation: "cpu.Registers.P.Set(ProcessorStatusFlag.Carry);" }),
    0x39: new OpCodeGenRule({ instruction: "AND", cycles: 4, addressMode: "abs,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A & OPERAND);" }),
    0x3D: new OpCodeGenRule({ instruction: "AND", cycles: 4, addressMode: "abs,X", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A & OPERAND);" }),
    0x3E: new OpCodeGenRule({ instruction: "ROL", cycles: 7, addressMode: "abs,X", operation: "OPERAND = cpu.setnz(rotate(OPERAND, false, true));", write: true }),
    //0x40: "RTI impl",
    0x41: new OpCodeGenRule({ instruction: "EOR", cycles: 6, addressMode: "X,ind", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A ^ OPERAND);" }),
    0x45: new OpCodeGenRule({ instruction: "EOR", cycles: 3, addressMode: "zpg", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A ^ OPERAND);" }),
    0x46: new OpCodeGenRule({ instruction: "LSR", cycles: 5, addressMode: "zpg", operation: "OPERAND = cpu.setnz(rotate(OPERAND, true, false));", write: true }),
    0x48: new OpCodeGenRule({ instruction: "PHA", cycles: 3, addressMode: "impl", operation: "cpu.push(this.Registers.A);" }),
    0x49: new OpCodeGenRule({ instruction: "EOR", cycles: 2, addressMode: "#", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A ^ OPERAND);" }),
    0x4A: new OpCodeGenRule({ instruction: "LSR", cycles: 2, addressMode: "A", operation: "cpu.Registers.A = cpu.setnz(rotate(cpu.Registers.A, true, false));" }),
    //0x4C: "JMP abs",
    0x4D: new OpCodeGenRule({ instruction: "EOR", cycles: 4, addressMode: "abs", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A ^ OPERAND);" }),
    0x4E: new OpCodeGenRule({ instruction: "LSR", cycles: 6, addressMode: "abs", operation: "OPERAND = cpu.setnz(rotate(OPERAND, true, false));", write: true }),
    0x50: new OpCodeGenRule({ instruction: "BVC", cycles: 2, addressMode: "rel", operation: "cpu.branch(() => {!cpu.Registers.P.IsSet(ProcessorStatusFlag.Overflow), OPERAND);" }),
    0x51: new OpCodeGenRule({ instruction: "EOR", cycles: 5, addressMode: "ind,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A ^ OPERAND);" }),
    0x55: new OpCodeGenRule({ instruction: "EOR", cycles: 4, addressMode: "zpg,X", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A ^ OPERAND);" }),
    0x56: new OpCodeGenRule({ instruction: "LSR", cycles: 6, addressMode: "zpg,X", operation: "OPERAND = cpu.setnz(rotate(OPERAND, true, false));", write: true }),
    0x58: new OpCodeGenRule({ instruction: "CLI", cycles: 2, addressMode: "impl", operation: "cpu.Registers.P.Clear(ProcessorStatusFlag.Interrupt);" }),
    0x59: new OpCodeGenRule({ instruction: "EOR", cycles: 4, addressMode: "abs,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A ^ OPERAND);" }),
    0x5D: new OpCodeGenRule({ instruction: "EOR", cycles: 4, addressMode: "abs,X", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.A ^ OPERAND);" }),
    0x5E: new OpCodeGenRule({ instruction: "LSR", cycles: 7, addressMode: "abs,X", operation: "OPERAND = cpu.setnz(rotate(OPERAND, true, false));", write: true }),
    //0x60: "RTS impl",
    0x61: new OpCodeGenRule({ instruction: "ADC", cycles: 6, addressMode: "X,ind", operation: "cpu.Registers.A = cpu.setnz(cpu.adc(OPERAND));" }),
    0x65: new OpCodeGenRule({ instruction: "ADC", cycles: 3, addressMode: "zpg", operation: "cpu.Registers.A = cpu.setnz(cpu.adc(OPERAND));" }),
    0x66: new OpCodeGenRule({ instruction: "ROR", cycles: 5, addressMode: "zpg", operation: "OPERAND = cpu.setnz(rotate(OPERAND, true, true));", write: true }),
    0x68: new OpCodeGenRule({ instruction: "PLA", cycles: 4, addressMode: "impl", operation: "cpu.Registers.A = cpu.setnz(cpu.pop());" }),
    0x69: new OpCodeGenRule({ instruction: "ADC", cycles: 2, addressMode: "#", operation: "cpu.Registers.A = cpu.setnz(cpu.adc(OPERAND));" }),
    0x6A: new OpCodeGenRule({ instruction: "ROR", cycles: 2, addressMode: "A", operation: "cpu.Registers.A = cpu.setnz(rotate(cpu.Registers.A, true, true));" }),
    //0x6C: "JMP ind",
    0x6D: new OpCodeGenRule({ instruction: "ADC", cycles: 4, addressMode: "abs", operation: "cpu.Registers.A = cpu.setnz(cpu.adc(OPERAND));" }),
    0x6E: new OpCodeGenRule({ instruction: "ROR", cycles: 6, addressMode: "abs", operation: "OPERAND = cpu.setnz(rotate(OPERAND, true, true));", write: true }),
    0x70: new OpCodeGenRule({ instruction: "BVS", cycles: 2, addressMode: "rel", operation: "cpu.branch(() => {cpu.Registers.P.IsSet(ProcessorStatusFlag.Overflow), OPERAND);" }),
    0x71: new OpCodeGenRule({ instruction: "ADC", cycles: 5, addressMode: "ind,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.adc(OPERAND));" }),
    0x75: new OpCodeGenRule({ instruction: "ADC", cycles: 4, addressMode: "zpg,X", operation: "cpu.Registers.A = cpu.setnz(cpu.adc(OPERAND));" }),
    0x76: new OpCodeGenRule({ instruction: "ROR", cycles: 6, addressMode: "zpg,X", operation: "OPERAND = cpu.setnz(rotate(OPERAND, true, true));", write: true }),
    0x78: new OpCodeGenRule({ instruction: "SEI", cycles: 2, addressMode: "impl", operation: "cpu.Registers.P.Set(ProcessorStatusFlag.Interrupt);" }),
    0x79: new OpCodeGenRule({ instruction: "ADC", cycles: 4, addressMode: "abs,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.adc(OPERAND));" }),
    0x7D: new OpCodeGenRule({ instruction: "ADC", cycles: 4, addressMode: "abs,X", operation: "cpu.Registers.A = cpu.setnz(cpu.adc(OPERAND));" }),
    0x7E: new OpCodeGenRule({ instruction: "ROR", cycles: 7, addressMode: "abs,X", operation: "OPERAND = cpu.setnz(rotate(OPERAND, true, true));", write: true }),
    0x81: new OpCodeGenRule({ instruction: "STA", cycles: 6, addressMode: "X,ind", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x84: new OpCodeGenRule({ instruction: "STY", cycles: 3, addressMode: "zpg", operation: "OPERAND = cpu.Registers.Y;", write: true }),
    0x85: new OpCodeGenRule({ instruction: "STA", cycles: 3, addressMode: "zpg", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x86: new OpCodeGenRule({ instruction: "STX", cycles: 3, addressMode: "zpg", operation: "OPERAND = cpu.Registers.X;", write: true }),
    0x88: new OpCodeGenRule({ instruction: "DEY", cycles: 2, addressMode: "impl", operation: "cpu.Registers.Y = cpu.setnz((cpu.Registers.Y - 1) & 0xFF);" }),
    0x8A: new OpCodeGenRule({ instruction: "TXA", cycles: 2, addressMode: "impl", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.X);" }),
    0x8C: new OpCodeGenRule({ instruction: "STY", cycles: 4, addressMode: "abs", operation: "OPERAND = cpu.Registers.Y;", write: true }),
    0x8D: new OpCodeGenRule({ instruction: "STA", cycles: 4, addressMode: "abs", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x8E: new OpCodeGenRule({ instruction: "STX", cycles: 4, addressMode: "abs", operation: "OPERAND = cpu.Registers.X;", write: true }),
    0x90: new OpCodeGenRule({ instruction: "BCC", cycles: 2, addressMode: "rel", operation: "cpu.branch(() => {!cpu.Registers.P.IsSet(ProcessorStatusFlag.Carry), OPERAND);" }),
    0x91: new OpCodeGenRule({ instruction: "STA", cycles: 6, addressMode: "ind,Y", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x94: new OpCodeGenRule({ instruction: "STY", cycles: 4, addressMode: "zpg,X", operation: "OPERAND = cpu.Registers.Y;", write: true }),
    0x95: new OpCodeGenRule({ instruction: "STA", cycles: 4, addressMode: "zpg,X", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x96: new OpCodeGenRule({ instruction: "STX", cycles: 4, addressMode: "zpg,Y", operation: "OPERAND = cpu.Registers.X;", write: true }),
    0x98: new OpCodeGenRule({ instruction: "TYA", cycles: 2, addressMode: "impl", operation: "cpu.Registers.A = cpu.setnz(cpu.Registers.Y);" }),
    0x99: new OpCodeGenRule({ instruction: "STA", cycles: 5, addressMode: "abs,Y", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0x9A: new OpCodeGenRule({ instruction: "TXS", cycles: 2, addressMode: "impl", operation: "cpu.Registers.SP = cpu.Registers.X;" }),
    0x9D: new OpCodeGenRule({ instruction: "STA", cycles: 5, addressMode: "abs,X", operation: "OPERAND = cpu.Registers.A;", write: true }),
    0xA0: new OpCodeGenRule({ instruction: "LDY", cycles: 2, addressMode: "#", operation: "cpu.Registers.Y = cpu.setnz(OPERAND);" }),
    0xA1: new OpCodeGenRule({ instruction: "LDA", cycles: 6, addressMode: "X,ind", operation: "cpu.Registers.A = cpu.setnz(OPERAND);" }),
    0xA2: new OpCodeGenRule({ instruction: "LDX", cycles: 2, addressMode: "#", operation: "cpu.Registers.X = cpu.setnz(OPERAND);" }),
    0xA4: new OpCodeGenRule({ instruction: "LDY", cycles: 3, addressMode: "zpg", operation: "cpu.Registers.Y = cpu.setnz(OPERAND);" }),
    0xA5: new OpCodeGenRule({ instruction: "LDA", cycles: 3, addressMode: "zpg", operation: "cpu.Registers.A = cpu.setnz(OPERAND);" }),
    0xA6: new OpCodeGenRule({ instruction: "LDX", cycles: 3, addressMode: "zpg", operation: "cpu.Registers.X = cpu.setnz(OPERAND);" }),
    0xA8: new OpCodeGenRule({ instruction: "TAY", cycles: 2, addressMode: "impl", operation: "cpu.Registers.Y = cpu.setnz(cpu.Registers.A);" }),
    0xA9: new OpCodeGenRule({ instruction: "LDA", cycles: 2, addressMode: "#", operation: "cpu.Registers.A = cpu.setnz(OPERAND);" }),
    0xAA: new OpCodeGenRule({ instruction: "TAX", cycles: 2, addressMode: "impl", operation: "cpu.Registers.X = cpu.setnz(cpu.Registers.A);" }),
    0xAC: new OpCodeGenRule({ instruction: "LDY", cycles: 4, addressMode: "abs", operation: "cpu.Registers.Y = cpu.setnz(OPERAND);" }),
    0xAD: new OpCodeGenRule({ instruction: "LDA", cycles: 4, addressMode: "abs", operation: "cpu.Registers.A = cpu.setnz(OPERAND);" }),
    0xAE: new OpCodeGenRule({ instruction: "LDX", cycles: 4, addressMode: "abs", operation: "cpu.Registers.X = cpu.setnz(OPERAND);" }),
    0xB0: new OpCodeGenRule({ instruction: "BCS", cycles: 2, addressMode: "rel", operation: "cpu.branch(() => {cpu.Registers.P.IsSet(ProcessorStatusFlag.Carry), OPERAND);" }),
    0xB1: new OpCodeGenRule({ instruction: "LDA", cycles: 5, addressMode: "ind,Y", operation: "cpu.Registers.A = cpu.setnz(OPERAND);" }),
    0xB4: new OpCodeGenRule({ instruction: "LDY", cycles: 4, addressMode: "zpg,X", operation: "cpu.Registers.Y = cpu.setnz(OPERAND);" }),
    0xB5: new OpCodeGenRule({ instruction: "LDA", cycles: 4, addressMode: "zpg,X", operation: "cpu.Registers.A = cpu.setnz(OPERAND);" }),
    0xB6: new OpCodeGenRule({ instruction: "LDX", cycles: 4, addressMode: "zpg,Y", operation: "cpu.Registers.X = cpu.setnz(OPERAND);" }),
    0xB8: new OpCodeGenRule({ instruction: "CLV", cycles: 2, addressMode: "impl", operation: "cpu.Registers.P.Clear(ProcessorStatusFlag.Overflow);" }),
    0xB9: new OpCodeGenRule({ instruction: "LDA", cycles: 4, addressMode: "abs,Y", operation: "cpu.Registers.A = cpu.setnz(OPERAND);" }),
    0xBA: new OpCodeGenRule({ instruction: "TSX", cycles: 2, addressMode: "impl", operation: "cpu.Registers.X = cpu.setnz(cpu.Registers.SP);" }),
    0xBC: new OpCodeGenRule({ instruction: "LDY", cycles: 4, addressMode: "abs,X", operation: "cpu.Registers.Y = cpu.setnz(OPERAND);" }),
    0xBD: new OpCodeGenRule({ instruction: "LDA", cycles: 4, addressMode: "abs,X", operation: "cpu.Registers.A = cpu.setnz(OPERAND);" }),
    0xBE: new OpCodeGenRule({ instruction: "LDX", cycles: 4, addressMode: "abs,Y", operation: "cpu.Registers.X = cpu.setnz(OPERAND);" }),
    0xC0: new OpCodeGenRule({ instruction: "CPY", cycles: 2, addressMode: "#", operation: "cpu.compare(cpu.Registers.Y, OPERAND);" }),
    0xC1: new OpCodeGenRule({ instruction: "CMP", cycles: 6, addressMode: "x,ind", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xC4: new OpCodeGenRule({ instruction: "CPY", cycles: 3, addressMode: "zpg", operation: "cpu.compare(cpu.Registers.Y, OPERAND);" }),
    0xC5: new OpCodeGenRule({ instruction: "CMP", cycles: 3, addressMode: "zpg", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xC6: new OpCodeGenRule({ instruction: "DEC", cycles: 5, addressMode: "zpg", operation: "OPERAND = cpu.setnz((OPERAND - 1) & 0xFF);", write: true }),
    0xC8: new OpCodeGenRule({ instruction: "INY", cycles: 2, addressMode: "impl", operation: "cpu.Registers.Y = cpu.setnz((cpu.Registers.Y + 1) & 0xFF);" }),
    0xC9: new OpCodeGenRule({ instruction: "CMP", cycles: 2, addressMode: "#", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xCA: new OpCodeGenRule({ instruction: "DEX", cycles: 2, addressMode: "impl", operation: "cpu.Registers.X = cpu.setnz((cpu.Registers.X - 1) & 0xFF);" }),
    0xCC: new OpCodeGenRule({ instruction: "CPY", cycles: 4, addressMode: "abs", operation: "cpu.compare(cpu.Registers.Y, OPERAND);" }),
    0xCD: new OpCodeGenRule({ instruction: "CMP", cycles: 4, addressMode: "abs", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xCE: new OpCodeGenRule({ instruction: "DEC", cycles: 3, addressMode: "abs", operation: "OPERAND = cpu.setnz((OPERAND - 1) & 0xFF);", write: true }),
    0xD0: new OpCodeGenRule({ instruction: "BNE", cycles: 2, addressMode: "rel", operation: "cpu.branch(() => {!cpu.Registers.P.IsSet(ProcessorStatusFlag.Zero), OPERAND);" }),
    0xD1: new OpCodeGenRule({ instruction: "CMP", cycles: 5, addressMode: "ind,Y", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xD5: new OpCodeGenRule({ instruction: "CMP", cycles: 4, addressMode: "zpg,X", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xD6: new OpCodeGenRule({ instruction: "DEC", cycles: 6, addressMode: "zpg,X", operation: "OPERAND = cpu.setnz((OPERAND - 1) & 0xFF);", write: true }),
    0xD8: new OpCodeGenRule({ instruction: "CLD", cycles: 2, addressMode: "impl", operation: "cpu.Registers.P.Clear(ProcessorStatusFlag.Decimal);" }),
    0xD9: new OpCodeGenRule({ instruction: "CMP", cycles: 4, addressMode: "abs,Y", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xDD: new OpCodeGenRule({ instruction: "CMP", cycles: 4, addressMode: "abs,X", operation: "cpu.compare(cpu.Registers.A, OPERAND);" }),
    0xDE: new OpCodeGenRule({ instruction: "DEC", cycles: 7, addressMode: "abs,X", operation: "OPERAND = cpu.setnz((OPERAND - 1) & 0xFF);", write: true }),
    0xE0: new OpCodeGenRule({ instruction: "CPX", cycles: 2, addressMode: "#", operation: "cpu.compare(cpu.Registers.X, OPERAND);" }),
    0xE1: new OpCodeGenRule({ instruction: "SBC", cycles: 6, addressMode: "X,ind", operation: "cpu.Registers.A = cpu.setnz(cpu.sbc(OPERAND));" }),
    0xE4: new OpCodeGenRule({ instruction: "CPX", cycles: 3, addressMode: "zpg", operation: "cpu.compare(cpu.Registers.X, OPERAND);" }),
    0xE5: new OpCodeGenRule({ instruction: "SBC", cycles: 3, addressMode: "zpg", operation: "cpu.Registers.A = cpu.setnz(cpu.sbc(OPERAND));" }),
    0xE6: new OpCodeGenRule({ instruction: "INC", cycles: 5, addressMode: "zpg", operation: "OPERAND = cpu.setnz((OPERAND + 1) & 0xFF);", write: true }),
    0xE8: new OpCodeGenRule({ instruction: "INX", cycles: 2, addressMode: "impl", operation: "cpu.Registers.X = cpu.setnz((cpu.Registers.X + 1) & 0xFF);" }),
    0xE9: new OpCodeGenRule({ instruction: "SBC", cycles: 2, addressMode: "#", operation: "cpu.Registers.A = cpu.setnz(cpu.sbc(OPERAND));" }),
    0xEA: new OpCodeGenRule({ instruction: "NOP", cycles: 2, addressMode: "impl", operation: "" }),
    0xEC: new OpCodeGenRule({ instruction: "CPX", cycles: 4, addressMode: "abs", operation: "cpu.compare(cpu.Registers.X, OPERAND);" }),
    0xED: new OpCodeGenRule({ instruction: "SBC", cycles: 4, addressMode: "abs", operation: "cpu.Registers.A = cpu.setnz(cpu.sbc(OPERAND));" }),
    0xEE: new OpCodeGenRule({ instruction: "INC", cycles: 6, addressMode: "abs", operation: "OPERAND = cpu.setnz((OPERAND + 1) & 0xFF);", write: true }),
    0xF0: new OpCodeGenRule({ instruction: "BEQ", cycles: 2, addressMode: "rel", operation: "cpu.branch(() => {cpu.Registers.P.IsSet(ProcessorStatusFlag.Zero), OPERAND);" }),
    0xF1: new OpCodeGenRule({ instruction: "SBC", cycles: 5, addressMode: "ind,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.sbc(OPERAND));" }),
    0xF5: new OpCodeGenRule({ instruction: "SBC", cycles: 4, addressMode: "zpg,X", operation: "cpu.Registers.A = cpu.setnz(cpu.sbc(OPERAND));" }),
    0xF6: new OpCodeGenRule({ instruction: "INC", cycles: 6, addressMode: "zpg,X", operation: "OPERAND = cpu.setnz((OPERAND + 1) & 0xFF);", write: true }),
    0xF8: new OpCodeGenRule({ instruction: "SED", cycles: 2, addressMode: "impl", operation: "cpu.Registers.P.Set(ProcessorStatusFlag.Decimal);" }),
    0xF9: new OpCodeGenRule({ instruction: "SBC", cycles: 4, addressMode: "abs,Y", operation: "cpu.Registers.A = cpu.setnz(cpu.sbc(OPERAND));" }),
    0xFD: new OpCodeGenRule({ instruction: "SBC", cycles: 4, addressMode: "abs,X", operation: "cpu.Registers.A = cpu.setnz(cpu.sbc(OPERAND));" }),
    0xFE: new OpCodeGenRule({ instruction: "INC", cycles: 7, addressMode: "abs,X", operation: "OPERAND = cpu.setnz((OPERAND + 1) & 0xFF);", write: true }),
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

