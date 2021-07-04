// ---------------------------------
// memory.ts
// =========
//
// emulates the 65K Vic20 memory model.
//
// 6502 cpu can address max 65K RAM. Standard Vic20 had:
// - 20K ROM Built in
// - 5K RAM
//
// A page = 256 bytes (base address divisible by 256)
// A block = 8K. There are total of 8 blocks available.
//
// High level memory map (http://sleepingelephant.com/denial/wiki/index.php?title=Memory_Map)
// ------------------------------------------------------------------------------------------
//
// Block #0:
// ---------
// 1KB Low Memory RAM (Built-in):
// - $0000-$00FF: Zeropage
// - $0100-$01FF: CPU Stack
// - $0200-$03FF: KERNAL and BASIC working areas
//
// 3 KB open area:
// - $0400-$07FF: 1 KB, accessed by RAM1 line
// - $0800-$0BFF: 1 KB, accessed by RAM2 line
// - $0C00-$0FFF: 1 KB, accessed by RAM3 line
//
// 4 KB Main RAM (built-in) in Block 0
// - $1000-$1FFF: 4 KB, Main RAM
//
// Block #1:
// ---------
// - $2000 - $3FFF: Block #1 (BLK1) - 8K expansion block 1, accessed by BLK1 line
//
// Block #2:
// ---------
// - $4000 - $5FFF: Block #2 (BLK2) - 8K expansion block 2, accessed by BLK2 line
//
// Block #3:
// ---------
// - $6000 - $7FFF: Block #3 (BLK3) - 8K expansion block 3, accessed by BLK3 line
//
// Block #4:
// ---------
// 4 KB Character ROMs
// - $8000-$83FF: 1 KB uppercase/glyphs
// - $8400-$87FF: 1 KB uppercase/lowercase
// - $8800-$8BFF: 1 KB inverse uppercase/glyphs
// - $8C00-$8FFF: 1 KB inverse uppercase/lowercase
// 4 KB I/O Blocks
// I/O Block 0: VIC/VIA chips
// - $9000-$900F: VIC Registers
// - $9110-$911F: VIA #1 Registers
// - $9120-$912F: VIA #2 Registers
// - $9130-$93FF: Unused[A]
// I/O Block 1: Color RAM
// - $9400-$97FF: Color RAM (1K of 4 bit nibbles)[B]
// I/O Blocks 2-3: Expansion port
// - $9800-$9BFF: 1 KB, I/O Expansion 2, accessed by I/O2 line
// - $9C00-$9FFF: 1 KB, I/O Expansion 3, accessed by I/O3 line
//
// Block #5:
// ---------
// - $A000 - $BFFF: Block #5 (BLK5) - 8K expansion block 5, accessed by BLK3 line. Often used by ROM cartridges
// Allows autostart sequence
//
// Block #6:
// ---------
// System ROM
// - $C000 - $DFFF: Block #6 - BASIC Interpreter ROM
//
// Block #6:
// ---------
// System ROM
// - $E000 - $FFFF: Block #7 - KERNAL ROM
// The top six bytes of the entire memory space are special to the 6502. They form three pairs which contain vectors:
// - $FFFA–$FFFB: Non-maskable interrupt
// - $FFFC–$FFFD: Reset vector; contains the address where the processor will start running on boot
// - $FFFE–$FFFF: Interrupt request
//
// Detailed memory maps can be found at:
// - http://www.zimmers.net/cbmpics/cbm/vic/memorymap.txt

export default class Memory {
    private Mem: Uint8Array;
    private Size: number = 65536;
    private ReadFunc: Array<Function>;
    private WriteFunc: Array<Function>;

    constructor() {
        this.Mem = new Uint8Array(this.Size);
        this.ReadFunc = new Array(this.Size);
        this.WriteFunc = new Array(this.Size);
        this.Reset();
    }


    /**
     * Loads data (e.g. ROM) into memory at given location/offset.
     * @param dataBase64 
     * @param offset 
     */
    loadData(data: Uint8Array, offset: number): void {
        let size = data.length;
        for (let i = 0; i < size; i++) {
            this.WriteMem(offset + i, data[i]);
        }
    }

    // I/O functions for different parts of memory
    private ReadMem(mem: Uint8Array, offset: number): number {
        return this.Mem[offset];
    }

    private ReadNull(mem: Uint8Array, offset: number): number {
        return this.Mem[offset];
    }

    private ReadVia1(mem: Uint8Array, offset: number): number {
        return 0;
    }

    private ReadVia2(mem: Uint8Array, offset: number): number {
        return 0;
    }

    private WriteMem(offset: number, value: number): void {
        this.Mem[offset] = value;
    }

    private WriteNull(mem: Uint8Array, offset: number, value: number): void {

    }


    // Reset memory
    Reset() {
        for (let i = 0; i < this.Size; i++) {
            this.ReadFunc[i] = this.ReadMem;
            this.WriteFunc[i] = this.WriteMem;
        }
    }

    // Reads a byte of memory
    ReadByte(offset: number): number {
        return this.ReadFunc[offset](this.Mem, offset);
    }

    // Reads a word of memory (little-endian)
    ReadWord(offset: number): number {
        var lo = this.ReadFunc[offset](offset);
        var hi = this.ReadFunc[offset + 1](offset + 1);
        return lo | (hi << 8);
    }

    // Writes a byte of memory
    WriteByte(offset: number, value: number): void {
        this.WriteFunc[offset](this.Mem, offset, value);
    }

}