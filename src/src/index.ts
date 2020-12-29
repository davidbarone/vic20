import cpu6502 from "./cpu6502";
import Memory from "./memory";

declare global {
  interface Window { cpu6502: any; }
}

window.cpu6502 = cpu6502 || {};

new cpu6502(new Memory()).hello('sfdds');

