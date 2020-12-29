import OpCodeGenParams from "./OpCodeGenParams";

export default class OpCodeGenRule {
    public constructor({ instruction, addressMode, operation, affectZFlag = false, affectNFlag = false, affectVFlag = false, write = false, CFlagFunc = null }: OpCodeGenParams) {
      this.Instruction = instruction;
      this.AddressMode = addressMode;
      this.Operation = operation;
      this.AffectNFlag = affectNFlag;
      this.AffectVFlag = affectVFlag;
      this.AffectZFlag = affectZFlag;
      this.CFlagFunc = CFlagFunc;
      this.Write = write;
    }
    public Instruction: string = "" // The 3-letter instruction
    public AddressMode: string = "" // The address mode
    public Operation: string = "" // The operation / logic to execute
    public AffectZFlag?: boolean = false // Does the operation affect the zero flag?
    public AffectNFlag: boolean = false // Does the operation affect the negative flag?
    public AffectVFlag: boolean = false // Does the operation affect the overflow flag?
    public CFlagFunc: Function | null // Does the operation affect the negative flag?
    public Write: boolean = false;    // does instruction perform a write operation?
  }
  