import cpu6502 from "./cpu_6502";
import OpCodeGenParams from "./op_code_gen_params";

export default class OpCodeGenRule {
  public constructor({ opCode, instruction, addressMode, operation, cycles, read = false, write = false }: OpCodeGenParams) {
    this.opCode = opCode;
    this.instruction = instruction;
    this.addressMode = addressMode;
    this.operation = operation;
    this.read = read;
    this.write = write;
    this.cycles = cycles;
    this.bytes = this.getBytes(addressMode);
    this.hasMemoryAccess = this.getMemoryAccess(addressMode);
  }
  public opCode: number                       // The single-byte opcode
  public instruction: string = ""             // The 3-letter instruction
  public addressMode: string = ""             // The address mode
  public operation: (cpu: cpu6502, reg: number) => number | void    // The operation / logic to execute
  public read: boolean = false;               // does instruction perform a read operation
  public write: boolean = false;              // does instruction perform a write operation?
  public cycles: number = 0;                  // default cycle count for instruction (can be varied in code)
  public bytes: number = 0;                   // Bytes for opcode
  public hasMemoryAccess: boolean = false;

  private getBytes(addressMode: string): number {
    let bytes: { [key: string]: number } = {};
    bytes["A"] = 1;     // accmulator
    bytes["abs"] = 3;   // absolute
    bytes["abs,X"] = 3; // absolute, X
    bytes["abs,Y"] = 3; // absolute, Y
    bytes["#"] = 2;     // immediate
    bytes["impl"] = 1;  // implied
    bytes["ind"] = 3;   // indirect
    bytes["X,ind"] = 2; // (indirect, X)
    bytes["ind,Y"] = 2; // (indirect), Y
    bytes["rel"] = 2;   // relative
    bytes["zpg"] = 2;   // zeropage
    bytes["zpg,X"] = 2; // zeropage, X
    bytes["zpg,Y"] = 2; // zeropage, Y
    return bytes[addressMode];
  }

  private getMemoryAccess(addressMode: string): boolean {
    let memoryAccess: { [key: string]: boolean } = {};
    // addressModeIsMemory
    memoryAccess["A"] = false;     // accmulator
    memoryAccess["abs"] = true;   // absolute
    memoryAccess["abs,X"] = true; // absolute, X
    memoryAccess["abs,Y"] = true; // absolute, Y
    memoryAccess["#"] = false;     // immediate
    memoryAccess["impl"] = false  // implied
    memoryAccess["ind"] = true;   // indirect
    memoryAccess["X,ind"] = true; // (indirect, X)
    memoryAccess["ind,Y"] = true; // (indirect), Y
    memoryAccess["rel"] = true;   // relative
    memoryAccess["zpg"] = true;   // zeropage
    memoryAccess["zpg,X"] = true; // zeropage, X
    memoryAccess["zpg,Y"] = true; // zeropage, Y
    return memoryAccess[addressMode];
  }
}
