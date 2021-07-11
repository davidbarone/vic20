export default interface OpCodeGenParams {
  instruction: string;
  addressMode: string;
  operation: string;
  write?: boolean;
  cycles: number;
}
