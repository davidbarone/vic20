import OpCodeGenParams from "./OpCodeGenParams";

export default class OpCodeGenRule {
  public constructor({ instruction, addressMode, operation, cycles, write = false }: OpCodeGenParams) {
    this.Instruction = instruction;
    this.AddressMode = addressMode;
    this.Operation = operation;
    this.Write = write;
    this.Cycles = cycles;
  }
  public Instruction: string = "" // The 3-letter instruction
  public AddressMode: string = "" // The address mode
  public Operation: string = "" // The operation / logic to execute
  public Write: boolean = false;    // does instruction perform a write operation?
  public Cycles: number = 0;
}
