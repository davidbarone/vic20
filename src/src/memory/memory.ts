import Utils from "../lib/utils";
import { MemoryModel } from "./memory_model";

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

interface ReadFuncType {
    (offset: number): number
}
interface WriteFuncType {
    (offset: number, value: number): void
}

export default class Memory {
    public mem: Uint8Array;
    private size: number = 65536;
    public readFunc: Array<ReadFuncType>;
    public writeFunc: Array<WriteFuncType>;
    private expansion: string = "unexpanded";      // The memory model used (unexpanded, full)

    /**
     * constructor
     * @param model The memory model (unexpanded, full)
     */
    constructor(expansion: MemoryModel = MemoryModel.unexpanded) {
        this.mem = new Uint8Array(this.size);
        this.readFunc = new Array(this.size);
        this.writeFunc = new Array(this.size);
        this.expansion = expansion;
        console.log(expansion);

        // Set up memory
        for (let i = 0x0000; i <= 0xFFFF; i++) {
            this.mem[i] = 0x00;
            this.readFunc[i] = this.readMem;
            this.writeFunc[i] = this.writeMem;
        }

        if (this.expansion !== MemoryModel.test) {
            for (let i = 0x9000; i <= 0x90FF; i++) this.writeFunc[i] = this.writeNull;  // VIC6560
            for (let i = 0x9110; i <= 0x911F; i++) this.writeFunc[i] = this.writeNull;  // VIA1
            for (let i = 0x9120; i <= 0x912F; i++) this.writeFunc[i] = this.writeNull;  // VIA2

            // Clear RAM1,2,3 and BLK1,2,3,5 - By default you cannot write to these areas
            for (let i = 0x0400; i <= 0x0FFF; i++) this.writeFunc[i] = this.writeNull;  // RAM1,2,3
            for (let i = 0x2000; i <= 0x3FFF; i++) this.writeFunc[i] = this.writeNull;  // BLK1
            for (let i = 0x4000; i <= 0x5FFF; i++) this.writeFunc[i] = this.writeNull;  // BLK2
            for (let i = 0x6000; i <= 0x7FFF; i++) this.writeFunc[i] = this.writeNull;  // BLK3
            for (let i = 0x8000; i <= 0x8FFF; i++) this.writeFunc[i] = this.writeNull;  // Character ROM
            for (let i = 0xA000; i <= 0xBFFF; i++) this.writeFunc[i] = this.writeNull;  // BLK5

            // Add in expansion memory
            // Note that RAM must be contiguous for BASIC
            // BLK 5 is generally not accessible
            if (this.expansion === MemoryModel.expanded_3k) for (let i = 0x0400; i <= 0x0FFF; i++) this.writeFunc[i] = this.writeMem;  // RAM1,2,3
            if (this.expansion === MemoryModel.expanded_11k) for (let i = 0x0400; i <= 0x0FFF; i++) this.writeFunc[i] = this.writeMem;  // RAM1,2,3
            if (this.expansion === MemoryModel.expanded_8k) for (let i = 0x2000; i <= 0x3FFF; i++) this.writeFunc[i] = this.writeMem;  // BLK1
            if (this.expansion === MemoryModel.expanded_11k) for (let i = 0x2000; i <= 0x3FFF; i++) this.writeFunc[i] = this.writeMem;  // BLK1
            if (this.expansion === MemoryModel.expanded_16k) for (let i = 0x2000; i <= 0x5FFF; i++) this.writeFunc[i] = this.writeMem;  // BLK1,2
            if (this.expansion === MemoryModel.expanded_24k) for (let i = 0x2000; i <= 0x7FFF; i++) this.writeFunc[i] = this.writeMem;  // BLK11,2,3
            if (this.expansion === MemoryModel.expanded_32k) {
                // BLK11,2,3,5
                for (let i = 0x2000; i <= 0x7FFF; i++) this.writeFunc[i] = this.writeMem;
                for (let i = 0xA000; i <= 0xBFFF; i++) this.writeFunc[i] = this.writeMem;
            }
            if (this.expansion === MemoryModel.expanded_35k) {
                // BLK11,2,3,5, RAM1,2,3
                for (let i = 0x2000; i <= 0x7FFF; i++) this.writeFunc[i] = this.writeMem;
                for (let i = 0xA000; i <= 0xBFFF; i++) this.writeFunc[i] = this.writeMem;
                for (let i = 0x0400; i <= 0x0FFF; i++) this.writeFunc[i] = this.writeMem;  // RAM1,2,3
            }
        }

        this.Reset();
    }

    // I/O functions for different parts of memory
    private readMem: ReadFuncType = (offset: number) => this.mem[offset];

    private readNull: ReadFuncType = (offset: number) => this.mem[offset];

    private writeMem: WriteFuncType = (offset: number, value: number) => { this.mem[offset] = value; }

    private writeNull: WriteFuncType = (offset: number, value: number) => { }


    /**
    * Loads data (e.g. ROM) into memory at given location/offset.
    * @param dataBase64 
    * @param offset 
    */
    loadData(data: Uint8Array, offset: number): void {
        let size = data.length;
        for (let i = 0; i < size; i++) {
            this.writeMem(offset + i, data[i]);
        }
    }

    // Reset memory
    Reset() {
    }

    public debug(page: number): string {
        if (page < 0 || page > 255) {
            throw "Invalid page number.";
        }
        let text = "";
        // return page of memory in debug format
        for (let row = 0; row < 16; row++) {
            let start: number = (page << 8) + (row << 4);
            let rowMem: Uint8Array = new Uint8Array(16);;
            for (let i = 0; i < 16; i++) {
                rowMem[i] = this.readByte(start + i);
            }
            text += `${Utils.NumberToHex(start, true)}:${Utils.UInt8ArrayToHex(rowMem.slice(0, 16), " ")}\n`;
        }
        return text;
    }

    // Reads a byte of memory
    public readByte: ReadFuncType = (offset: number) => this.readFunc[offset](offset);

    // Writes a byte of memory
    public writeByte: WriteFuncType = (offset: number, value: number) => { this.writeFunc[offset](offset, value); }

    // Reads a word of memory (little-endian)
    public readWord: ReadFuncType = (offset: number) => {
        var lo = this.readFunc[offset](offset);
        var hi = this.readFunc[offset + 1](offset + 1);
        return lo + (hi << 8);
    }

    // Writes a word of memory (little-endian)
    public writeWord: WriteFuncType = (offset: number, value: number) => {
        var lo = Utils.ExtractBits(value, 0, 7);
        var hi = Utils.ExtractBits(value, 8, 15);
        this.writeByte(offset, lo);
        this.writeByte(offset + 1, hi);
    }
}