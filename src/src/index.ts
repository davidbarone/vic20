import asm6502 from "./asm6502";

declare global {
  interface Window { asm6502: any; }
}

window.asm6502 = asm6502 || {};




