import cpu6502 from "./Cpu/Cpu6502";
import Memory from "./Memory/Memory";
import { Vic20 } from "./Vic20"

declare global {
  interface Window { vic20: any; }
}

window.vic20 = Vic20 || {};