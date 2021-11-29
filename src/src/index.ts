import cpu6502 from "./cpu/cpu_6502";
import Memory from "./memory/memory";
import { Vic20 } from "./vic20"

declare global {
  interface Window { vic20: any; }
}

window.vic20 = Vic20 || {};