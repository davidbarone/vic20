import cpu6502 from "./cpu6502";

declare global {
  interface Window { cpu6502: any; }
}

window.cpu6502 = cpu6502 || {};




