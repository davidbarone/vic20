import cpu6502 from "./cpu/Cpu6502";
import Memory from "./Memory";

declare global {
  interface Window { cpu6502: any; }
}

window.cpu6502 = cpu6502 || {};

new cpu6502(new Memory()).hello('sfdds');

let re = /^(?<value>(\\d+|[$][a-fA-F0-9]{2}|[A-Za-z][A-Za-z0-9_]*))$/;
let text = "DECREMENT";
console.log(text);
let results = text.match(re);
console.log(results);
