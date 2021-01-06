import cpu6502 from "../src/cpu/Cpu6502";
import Memory from "../src/Memory";
import Utils from "../src/Utils";

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
        , expected: 'A2 08 CA 8E 00 02 E0 03 D0 F8 8E 01 02 00'
    },
    {
        input: `  
        LDX #$00
        LDY #$00
      firstloop:
        TXA
        STA $0200,Y
        PHA
        INX
        INY
        CPY #$10
        BNE firstloop ;loop until Y is $10
      secondloop:
        PLA
        STA $0200,Y
        INY
        CPY #$20      ;loop until Y is $20
        BNE secondloop`,
        expected: 'A2 00 A0 00 8A 99 00 02 48 E8 C8 C0 10 D0 F5 68 99 00 02 C8 C0 20 D0 F7'
    }
];

test('Assemble', () => {
    for (let test of AssemblerTests) {
        let cpu = new cpu6502(new Memory());
        let actual = cpu.Assemble(test.input);
        expect(Utils.UInt8ArrayToHex(actual)).toEqual(test.expected);
    }
});