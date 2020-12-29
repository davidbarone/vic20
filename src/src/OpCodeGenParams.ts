export default interface OpCodeGenParams {
    instruction: string;
    addressMode: string;
    operation: string;
    affectZFlag?: boolean;
    affectNFlag?: boolean;
    affectVFlag?: boolean;
    CFlagFunc?: Function | null;
    write?: boolean;
  }
  