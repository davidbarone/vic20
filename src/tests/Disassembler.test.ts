import cpu6502 from "../src/cpu/Cpu6502";
import Memory from "../src/Memory";
import Utils from "../src/Utils"

let tests: Array<{ input: string, instructions: number, expected: string }> = [
    {
        input: 'a2 08 ca 8e 00 02 e0 03 d0 f8 8e 01 02 00',
        instructions: 7,
        expected: `LDX #$08
DEX
STX $0200
CPX #$03
BNE $A002
STX $0201
BRK`
    }
]


test('DisassembleSingle', () => {

    for (let test of tests) {
        let arr = new Array();
        let hexbytes = test.input.split(' ');
        for (let hexbyte of hexbytes) {
            let byte = Utils.HexToNumber(hexbyte);
            arr.push(byte);
        }
        let buffer = new Uint8Array(arr);

        // Load image / buffer
        let mem = new Memory();
        let cpu = new cpu6502(mem);
        cpu.Load(parseInt('A000',16), buffer )
    
        // Get Disassembly
        let result = cpu.DisassembleSingle(Utils.HexToNumber('A000'));

        expect(result.Bytes).toBe("A2 08");
        expect(result.Disassembly).toBe("LDX #$08");
    }
});

test('Disassemble', () => {
    for (let test of tests) {
        let offset: number = Utils.HexToNumber('A000');
        let arr = new Array();
        let hexbytes = test.input.split(' ');
        for (let hexbyte of hexbytes) {
            let byte = Utils.HexToNumber(hexbyte);
            arr.push(byte);
        }
        let buffer = new Uint8Array(arr);

        // Load image / buffer
        let mem = new Memory();
        let cpu = new cpu6502(mem);
        cpu.Load(parseInt('A000',16), buffer )
    
        // Get Disassembly
        let results = cpu.Disassemble(offset, test.instructions);

        expect(results.length).toBe(test.instructions);

        // Join all single disassembly output - this will effectively give source file
        let actual = results.map(r => r.Disassembly).join("\n");
        expect(actual).toBe(test.expected);
    }
});