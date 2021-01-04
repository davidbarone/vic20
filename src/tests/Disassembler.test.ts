import cpu6502 from "../src/cpu/Cpu6502";
import Memory from "../src/Memory";

let tests: Array<{ input: string, expected: string }> = [
    {
        input: 'a2 08 ca 8e 00 02 e0 03 d0 f8 8e 01 02 00',
        expected: 'sdfs'
    }
]


test('Disassemble', () => {

    for (let test of tests) {
        let arr = new Array();
        let hexbytes = test.input.split(' ');
        for (let hexbyte of hexbytes) {
            let byte = parseInt(hexbyte, 16);
            arr.push(byte);
        }
        let buffer = new Uint8Array(arr);

        // Load image / buffer
        let mem = new Memory();
        let cpu = new cpu6502(mem);
        cpu.Load(parseInt('A000',16), buffer )
    
        // Get Disassembly
        console.log(cpu.Disassemble(parseInt('A000', 16)));
    }
});