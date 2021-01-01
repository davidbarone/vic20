// -------------------------------------
// AddressModes
//
// Encapsulates the 13 addressing modes
// on the 6502.
// -------------------------------------

interface AddressModeRule {
    mode: string,
    desc: string,
    bytes: number,
    pattern: RegExp
}

class AddressMode {
    private static hexByte: string = '[$][a-fA-F0-9]{2}';
    private static hexWord: string = '[$][a-fA-F0-9]{4}';
    private static decimal: string = '\\d+';
    private static label: string = '[A-Za-z][A-Za-z0-9_]*'  // can be label or defined symbol

    private static addressModes: Array<AddressModeRule> = [
        { mode: "A", desc: "Accumulator", bytes: 2, pattern: new RegExp('^[A]$') },
        { mode: "#", desc: "Immediate", bytes: 2, pattern: new RegExp(`^[#](?<value>(${AddressMode.decimal}|${AddressMode.hexByte}))$`) }, // 8 bit
        { mode: "zpg", desc: "ZeroPage", bytes: 2, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexByte}))$`) },  // 8 bit
        { mode: "zpg,X", desc: "ZeroPageX", bytes: 2, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexByte}))(,X)$`) },
        { mode: "zpg,Y", desc: "ZeroPageY", bytes: 2, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexByte}))(,Y)$`) },
        { mode: "rel", desc: "Relative", bytes: 2, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexByte}|${AddressMode.label}}))$`) }, // 8 bit
        { mode: "abs", desc: "Absolute", bytes: 3, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))$`) },
        { mode: "abs,X", desc: "AbsoluteX", bytes: 3, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))(,X)$`) },  // 16 bit
        { mode: "abs,Y", desc: "AbsoluteY", bytes: 3, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))(,Y)$`) },  // 16 bit
        { mode: "ind", desc: "Indirect", bytes: 3, pattern: new RegExp(`^[(](?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))[)]$`) },
        { mode: "X,ind", desc: "IndexedIndirect", bytes: 2, pattern: new RegExp(`^[(](?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))(,X[)])$`) },
        { mode: "ind,Y", desc: "IndirectIndexed", bytes: 2, pattern: new RegExp(`^[(](?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))([)],Y)$`) },
        { mode: "impl", desc: "Implied", bytes: 1, pattern: new RegExp("^$") }
    ];

    private static ParseNumber(input: string, labels: { [name: string]: number; }): number {
        if (input.substr(0, 1) === "$") {
            // hex number
            return parseInt(input.substr(1), 16);
        } else {
            let number = parseInt(input);
            if (isNaN(number)) {
                // label
                number = labels[input];
                if (typeof (number) === "undefined") {
                    throw new Error(`Label [${input}] not found.`);
                }
                return number;
            } else {
                // literal number
                return number;
            }
        }
    }

    // ------------------------------------
    // Parses a string input and returns
    // the address mode that matches the
    // syntax. Used to parse assembly code.
    // ------------------------------------
    static Parse(operand: string, labels: { [name: string]: number; }): { AddressMode: AddressModeRule; Value: number | null; } {
        

        operand = operand.toUpperCase().trim();
        
        for (const rule of AddressMode.addressModes) {
            let regex = rule.pattern;
            if (regex.test(operand)) {
                let match = operand.match(regex);
                let value: number | null = null
                if (match != null) {
                    if (match.groups) {
                        value = AddressMode.ParseNumber(match.groups["value"], labels);
                    }
                    
                    return {
                        AddressMode: rule,
                        Value: value
                    }
                }
                break;
            }
        }
        throw new Error("Should not get here!");
    }
}

export default AddressMode;