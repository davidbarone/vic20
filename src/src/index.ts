import cpu6502 from "./cpu/cpu_6502";
import Memory from "./memory/memory";
import { Vic20 } from "./vic20"
import Roms from "./memory/roms"

declare global {
  interface Window {
    vic20: any;
    roms: any;
  }
}

window.vic20 = Vic20 || {};
window.roms = Roms || {};