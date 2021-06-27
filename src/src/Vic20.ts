import cpu6502 from "./Cpu/Cpu6502"
import Cpu6502 from "./Cpu/Cpu6502"
import Memory from "./Memory/Memory"
import { Vic6560 } from "./Video/Vic6560"

export class Vic20 {

    Cpu: cpu6502;
    Vic6560: Vic6560;

    constructor(canvas: HTMLCanvasElement) {
        let memory: Memory = new Memory();
        this.Cpu = new cpu6502(memory);
        this.Vic6560 = new Vic6560(canvas);
    }
    /**
     * Initialises the Vic20 computer
     */
    init() {
        alert('vic20 init');

        for (let i = 0; i < (71 * 312) * 50; i++)
            this.cycle();


    }

    /**
     * Single computer cycle
     */
    cycle() {
        this.Vic6560.Cycle();
    }
}