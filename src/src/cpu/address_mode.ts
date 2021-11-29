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
    pattern: RegExp,
    format: string
}

class AddressMode {
    private static hexByte: string = '[$][a-fA-F0-9]{2}';
    private static hexWord: string = '[$][a-fA-F0-9]{4}';
    private static decimal: string = '\\d+';
    private static label: string = '[A-Za-z][A-Za-z0-9_]*'  // can be label or defined symbol

    private static addressModes: Array<AddressModeRule> = [
        { mode: "A", desc: "Accumulator", bytes: 2, pattern: new RegExp('^[A]$'), format: 'A' },
        { mode: "#", desc: "Immediate", bytes: 2, pattern: new RegExp(`^[#](?<value>(${AddressMode.decimal}|${AddressMode.hexByte}))$`), format: '#${value}' }, // 8 bit
        { mode: "zpg", desc: "ZeroPage", bytes: 2, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexByte}))$`), format: '${value}' },  // 8 bit
        { mode: "zpg,X", desc: "ZeroPageX", bytes: 2, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexByte}))(,X)$`), format: '${value},X' },
        { mode: "zpg,Y", desc: "ZeroPageY", bytes: 2, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexByte}))(,Y)$`), format: '${value},Y' },
        { mode: "rel", desc: "Relative", bytes: 2, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexByte}|${AddressMode.label}))$`), format: '${value}' }, // 8 bit
        { mode: "abs", desc: "Absolute", bytes: 3, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))$`), format: '${value}' },
        { mode: "abs,X", desc: "AbsoluteX", bytes: 3, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))(,X)$`), format: '${value},X' },  // 16 bit
        { mode: "abs,Y", desc: "AbsoluteY", bytes: 3, pattern: new RegExp(`^(?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))(,Y)$`), format: '${value},Y' },  // 16 bit
        { mode: "ind", desc: "Indirect", bytes: 3, pattern: new RegExp(`^[(](?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))[)]$`), format: '(${value})' },
        { mode: "X,ind", desc: "IndexedIndirect", bytes: 2, pattern: new RegExp(`^[(](?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))(,X[)])$`), format: '(${value},X)' },
        { mode: "ind,Y", desc: "IndirectIndexed", bytes: 2, pattern: new RegExp(`^[(](?<value>(${AddressMode.decimal}|${AddressMode.hexWord}))([)],Y)$`), format: '(${value}),Y' },
        { mode: "impl", desc: "Implied", bytes: 1, pattern: new RegExp("^$"), format: '' }
    ];

    private static ParseNumber(input: string, labels: { [name: string]: number; }, pc: number): number {
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
                return number - pc;
            } else {
                // literal number
                return number;
            }
        }
    }

    // ---------------------------------------------
    // Returns an address mode by name
    // ---------------------------------------------
    static GetRule(mode: string): AddressModeRule {
        let modes = this.addressModes.filter(am => am.mode === mode);
        if (modes.length !== 1) {
            throw new Error(`Invalid address mode: ${mode}`);
        }
        return modes[0];
    }

    // ------------------------------------
    // Parses a string input and returns
    // the address mode that matches the
    // syntax. Used to parse assembly code.
    // ------------------------------------
    static Parse(operand: string, labels: { [name: string]: number; }, pc: number): { AddressMode: AddressModeRule; Value: number | null; } {


        operand = operand.toUpperCase().trim();

        for (const rule of AddressMode.addressModes) {
            let regex = rule.pattern;
            if (regex.test(operand)) {
                let match = operand.match(regex);
                let value: number | null = null
                if (match != null) {
                    if (match.groups) {
                        value = AddressMode.ParseNumber(match.groups["value"], labels, pc + rule.bytes);
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