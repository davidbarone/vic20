import cpu6502 from "./cpu/cpu6502";
import Memory from "./Memory";

declare global {
  interface Window { cpu6502: any; }
}

window.cpu6502 = cpu6502 || {};

new cpu6502(new Memory()).hello('sfdds');

let hexByte = '[\$][a-fA-f0-9]{2}';
let hexWord = '[\$][a-fA-f0-9]{4}';
let decimal = '\\d+';
let immediateHexByte = `[#][\$]${hexByte}`;
let immediateHexWord = `[#][\$]${hexWord}`;
let immediateDecimal = `[#]${decimal}`;

let operandRegex = [
  { mode: "Accumulator", re: '^[A]$' },
  { mode: "Immediate", re: `^(?<value>(${immediateDecimal}|${immediateHexByte}))$` }, // 8 bit
  { mode: "ZeroPage", re: `^(${decimal}|${hexByte})$`},  // 8 bit
  { mode: "ZeroPageX", re: `^(?<value>(${decimal}|${hexByte}))(,X)$` },
  { mode: "ZeroPageY", re: `^(${decimal}|${hexByte})(,Y)$` },
  { mode: "Relative", re: `^(${decimal}|${hexByte})$` }, // 8 bit
  { mode: "Absolute", re: `^(${decimal}|${hexWord})$` },  // 16 bit
  { mode: "AbsoluteX", re: `^(${decimal}|${hexWord})(,X)$` },  // 16 bit
  { mode: "AbsoluteY", re: `^(${decimal}|${hexWord})(,Y)$` },  // 16 bit
  { mode: "Indirect", re: `^\((${decimal}|${hexWord})\)$` },
  { mode: "IndexedIndirect", re: `^\((${decimal}|${hexWord})(,X\))$` },
  { mode: "IndirectIndexed", re: `^\((${decimal}|${hexWord})(\),Y)$` },
  { mode: "Implied", re: "^$" }
]

let text = "mylabel: ABC #10  ; This is a line";
text = "mylabel: ABC \$10,X  ; This is a line";
parseLine(text);

function parseLine(line: string) {

  if (!line) {
    return "empty string";
  }

  // remove comments
  let code = line.split(';')[0];
  
  // Basic regex to parse line
  let re = /^(?<label>[A-Za-z][A-Za-z0-9_]*[:])[\s]*(?<instruction>[A-Za-z]{3})(?<operand>.*)$/;
  
  let results = code.match(re);
  if (results == null || typeof (results) == "undefined") {
    throw new Error("Invalid format");
  } else {
    let groups = results.groups;
    if (groups) {
      let operand = groups["operand"].toUpperCase().trim();
      console.log(operand);

      // Find out which addressing mode is being used
      for (const rule of operandRegex) {
        let regex = new RegExp(rule.re);
        if (regex.test(operand)) {
          console.log(rule.mode);
          console.log(rule.re);
          let match = operand.match(regex);
          console.log(match);
          if (match != null && match.groups) {
            console.log(match.groups["value"]);
          }
          break;
        }
      }
    }
  }
 
  console.log(results);
}

