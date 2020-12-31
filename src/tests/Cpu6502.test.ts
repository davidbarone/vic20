import cpu6502 from "../src/cpu/cpu6502";
import Memory from "../src/Memory";

let parseLineTests: Array<{ input: string, output: Uint8Array }> = [
    { input: "CLC", output: new Uint8Array([0x18]) },
    { input: "DEX", output: new Uint8Array([0xCA]) }
]

test('Assemble Line', () => {
    for (let test of parseLineTests) {
        let cpu = new cpu6502(new Memory());
        let actual = cpu.AssembleLine(test.input);
        expect(test.output).toEqual(actual);
    }
});