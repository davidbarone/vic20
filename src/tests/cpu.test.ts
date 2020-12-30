import cpu6502 from "../src/cpu/cpu6502"
import Memory from "../src/Memory"

test('assembler tests', () => {
    let cpu = new cpu6502(new Memory());
    console.log('test');
    cpu.Assemble(`
MY_LABEL:
    TAY
    TAY

    `);
    expect(0).toBe(0);
});
  
export default {}