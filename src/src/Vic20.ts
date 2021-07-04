import cpu6502 from "./Cpu/Cpu6502"
import Cpu6502 from "./Cpu/Cpu6502"
import Memory from "./Memory/Memory"
import { Vic6560 } from "./Video/Vic6560"
import Data from "./Memory/Data"
import Utils from "./Utils"

export class Vic20 {

    Memory: Memory;
    Cpu: cpu6502;
    Vic6560: Vic6560;

    constructor(canvas: HTMLCanvasElement) {
        this.Memory = new Memory();
        this.Cpu = new cpu6502(this.Memory);
        this.Vic6560 = new Vic6560(true, this.Memory, canvas);
    }
    /**
     * Initialises the Vic20 computer
     */
    init() {
        console.log("Vic20 init");
        this.reset();
        console.log(this.Memory);
        for (let i = 0; i < (71 * 312) * 50; i++)
            this.cycle();
    }

    /**
     * Resets the machine
     */
    reset() {
        console.log("Vic20 reset");

        let charROM = Utils.UInt8ArrayFromBase64(Data.character)
        this.Memory.loadData(charROM, 0x8000);

        let basicROM = Utils.UInt8ArrayFromBase64(Data.basic)
        this.Memory.loadData(charROM, 0xC000);

        let kernalROM = Utils.UInt8ArrayFromBase64(Data.kernal)
        this.Memory.loadData(charROM, 0xE000);

    }

    /**
     * Single computer cycle
     */
    cycle() {
        this.Vic6560.Cycle();
    }
}