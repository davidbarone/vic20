import cpu6502 from "./cpu_6502";

/**
 * Parameters used to create an OpCodeGenRule
 */
export default interface OpCodeGenParams {
  instruction: string;
  addressMode: string;
  operation: (cpu: cpu6502, reg: number) => number | void;
  read?: boolean;
  write?: boolean;
  cycles: number;
  opCode: number
}
