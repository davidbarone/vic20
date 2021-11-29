import cpu6502 from "./cpu_6502"
import AddressMode from "./address_mode";
import Utils from "../lib/utils"

// -------------------------------------
// 6502 with assembler / disassembler
// functionality.
// -------------------------------------
class cpu6502d extends cpu6502 {

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
        let byte = this.Memory.readByte(offset);
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
            let addressMode = AddressMode.GetRule(opCode.addressMode);
            let operandLo: number = 0;
            let operandHi: number = 0;
            let value: number = 0;
            let valueHex: string = ""
            if (addressMode.bytes > 1) {
                operandLo = this.Memory.readByte(offset + 1);
                value = operandLo;
                bytes.push(operandLo);
            }
            if (addressMode.bytes > 2) {
                operandHi = this.Memory.readByte(offset + 2);
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
                Disassembly: `${opCode.instruction} ${addressMode.format.replace("{value}", valueHex)}`.trim(),
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
                    let opCodes = this.opCodes6502Array.filter(a => a.rule.instruction === instruction && a.rule.addressMode === addressMode);
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
}