import cpu6502 from "../src/cpu/Cpu6502";
import Memory from "../src/Memory";

let parseLineTests: Array<{ input: string, expected: Uint8Array }> = [
    { input: "CLC", expected: new Uint8Array([0x18]) },
    { input: "DEX", expected: new Uint8Array([0xCA]) }
]

test('Assemble Line', () => {
    for (let test of parseLineTests) {
        let cpu = new cpu6502(new Memory());
        let actual = cpu.AssembleLine(test.input, 0, {});
        expect(actual).toEqual(test.expected);
    }
});

let AssemblerTests: Array<{ input: string, expected: string }> = [
    {
        input: `
LDA #$01
STA $0200
LDA #$05
STA $0201
LDA #$08
STA $0202
`, expected: 'A9 01 8D 00 02 A9 05 8D 01 02 A9 08 8D 02 02'
    },
    {
        input: `
    LDX #$08
decrement:
    DEX
    STX $0200
    CPX #$03
    BNE decrement
    STX $0201
    BRK        `
        , expected: 'a2 08 ca 8e 00 02 e0 03 d0 f8 8e 01 02 00'
    }
];

test('Assemble', () => {
    for (let test of AssemblerTests) {
        let cpu = new cpu6502(new Memory());
        debugger
        let actual = cpu.Assemble(test.input);
        expect(cpu.ToHex(actual)).toEqual(test.expected);
    }
});