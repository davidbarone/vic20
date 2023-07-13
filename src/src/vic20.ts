import cpu6502 from "./cpu/cpu_6502"
import Memory from "./memory/memory"
import { Vic6560 } from "./video/vic_6560"
import Utils from "./lib/utils"
import via6522 from "./io/via_6522"
import keyboard from "./io/keyboard";
import joystick from "./io/joystick"
import OpCodeGenRule from "./cpu/op_code_gen_rule"
import Roms from "./memory/roms"
import { MemoryModel } from "./memory/memory_model"
import RomIndexInfo from "./memory/rom_index_info"
import { RomFileType } from "./memory/rom_file_type"
import { RomRegion } from "./memory/rom_region"
import { VideoRegion } from "./video/video_region"

export class Vic20 {

    canvas: HTMLCanvasElement;
    expansion: MemoryModel;
    videoRegion: VideoRegion;
    Memory: Memory;
    Cpu: cpu6502;
    Vic6560: Vic6560;
    via1: via6522;
    via2: via6522;
    keyboard: keyboard;
    joystick: joystick;
    frameDelay: number;      // configures the frame delay. Alters the speed
    startTime: number;   //
    c: number;              // used to adjust speed
    speed: number;          // speed configuration
    autoSpeed: boolean;
    break: boolean = false;         // set to true to stop execution (breakpoint)
    roms: Roms | undefined;
    cartridgeName: string = "";

    private debug: boolean = false;
    private timeoutId: number = 0;          // controls running / stopping of frames
    private actualFramesPerSecond: number = 0;    // last reported frames per second. Used to provide info to application.

    setDebug(mode: boolean) {
        this.debug = mode;
        this.Cpu.setDebug(mode);
        this.via1.setDebug(mode);
        this.via2.setDebug(mode);
    }

    setConfigMemory(expansion: MemoryModel = MemoryModel.unexpanded) {
        this.expansion = expansion;
    }

    setConfigVideo(videoRegion: VideoRegion = VideoRegion.pal) {
        this.videoRegion = videoRegion;
    }

    setConfigRoms(roms: Roms) {
        this.roms = roms;
    }

    setCartridgeName(name: string) {
        this.cartridgeName = name;
    }

    /**
     * Implement to provide custom debugging
     * @param debugInfo 
     */
    public debugHandler?(info: {
        memory: (page: number) => string,
        cpu: (history: number) => string,
        stack: () => string,
        vic: () => string,
        pc: () => number,
        via1: (history: number) => string,
        via2: (history: number) => string,
        instruction: () => OpCodeGenRule,
        instructionMemory: () => number | null
    }): void

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.expansion = MemoryModel.unexpanded;
        this.videoRegion = VideoRegion.ntsc;

        this.Memory = new Memory(this.expansion);
        this.Cpu = new cpu6502(this.Memory);
        this.Vic6560 = new Vic6560(this.videoRegion, this.Memory, this.canvas, 0x9000);
        this.via1 = new via6522("VIA1", this.Memory, 0x9110);   // nmi
        this.via2 = new via6522("VIA2", this.Memory, 0x9120);   // irq
        this.keyboard = new keyboard(this.via2);
        this.joystick = new joystick(this.via1, this.via2);
        this.via1.setDebug(false);
        this.via2.setDebug(false);
        this.frameDelay = 20;            // PAL = 50Hz, NTSC = 60Hz, so set default delay to 20/1000 seconds
        this.startTime = new Date().getTime();    // milliseconds after epoch
        this.c = 0;
        this.speed = 80;
        this.autoSpeed = false;
    }

    /**
     * Sets the speed
     * @param speed A number between 0 (slow) to 100 (fast). Used to create the frameDelay value. A value of -1 denotes auto speed (100%)
     */
    setSpeed(speed: number) {
        this.speed = speed;
        this.frameDelay = (100 - speed)
    }

    setAutoSpeed(autoSpeed: boolean) {
        this.autoSpeed = autoSpeed;
    }

    /**
     * Provides information to the caller. Application can specify a handler optionally
     */
    infoEvent?: (info: { mode: string, speed: number, targetFramesPerSecond: number, actualFramesPerSecond: number }) => void;

    stop() {
        this.break = true;
        window.clearTimeout(this.timeoutId);
    }

    start() {
        this.break = false;
        this.timeoutId = window.setTimeout(() => this.frameRepeat(), this.frameDelay);
    }

    stepCycle() {
        this.cycle();
    }

    stepInstruction() {
        this.cycle();
        while (!this.Cpu.instructionComplete) {
            this.cycle();
        }
    }

    public get targetFramesPerSecond() {
        return this.Vic6560.busFrequency / this.Vic6560.cyclesPerFrame;
    }

    frame() {
        for (let i = 0; i < this.Vic6560.cyclesPerFrame; i++) {
            if (!this.break) {
                this.cycle();
            }
        }
    }

    frameRepeat() {

        this.frame();
        this.c++;

        // Every 50 frames, we recalculate the speed, and adjust frameDelay:
        if (this.c == 50) {

            let endTime = new Date().getTime();
            let duration = endTime - this.startTime;
            this.startTime = endTime;

            // recalculate delay (PAL typically 50, NTSC typically 60)

            // Actual
            this.actualFramesPerSecond = this.c / (duration / 1000);

            if (this.autoSpeed) {
                // Recalibrate
                if (this.frameDelay == 0) this.frameDelay = 1;  // cannot calibrate if zero
                this.frameDelay = this.frameDelay * this.actualFramesPerSecond / this.targetFramesPerSecond;
                if (this.frameDelay < 0) this.frameDelay = 0;
                if (this.frameDelay > 100) this.frameDelay = 100;
                this.speed = 100 - this.frameDelay;
            }

            this.c = 0;

            // information event
            if (this.infoEvent)
                this.infoEvent(
                    {
                        mode: this.videoRegion,
                        targetFramesPerSecond: this.targetFramesPerSecond,
                        actualFramesPerSecond: Math.round(this.actualFramesPerSecond),
                        speed: this.speed
                    }
                );
        }

        if (!this.break) {
            this.timeoutId = window.setTimeout(() => this.frameRepeat(), this.frameDelay);
        }
    }

    public manualloadCart(data: Uint8Array, loadAddress: number): void {
        // first 2 bytes  are the loading address
        let endLocation = loadAddress + data.length;
        var bootStrap = [
            0x20,
            0x33,
            0xc5,
            0xa9,
            endLocation & 0xff,
            0x85,
            45,
            0xa9,
            endLocation >> 8,
            0x85,
            46,
            0x20,
            0x59,
            0xc6,
            0x4c,
            0xae,
            0xc7,
            0x60,
        ];

        let startAddress: number = 320;

        for (var i = 0; i < bootStrap.length; i++) this.Memory.writeByte(320 + i, bootStrap[i]);
        if (
            data[8] == 0x41 &&
            data[9] == 0x30 &&
            data[10] == 0xc3 &&
            data[11] == 0xc2 &&
            data[12] == 0xcd
        ) {
            startAddress = 64802;
        } else {
            this.Memory.loadData(data, loadAddress);
            this.sendKeys("SYS320\r");
        }
    }

    /**
     * Resets the machine
     */
    public reset(): void {
        clearInterval(this.timeoutId);
        this.Memory = new Memory(this.expansion);
        this.Cpu = new cpu6502(this.Memory);
        this.Vic6560.reset();
        this.Vic6560 = new Vic6560(this.videoRegion, this.Memory, this.canvas, 0x9000);
        this.via1 = new via6522("VIA1", this.Memory, 0x9110);   // nmi
        this.via2 = new via6522("VIA2", this.Memory, 0x9120);   // irq
        this.keyboard = new keyboard(this.via2);
        this.joystick = new joystick(this.via1, this.via2);
        this.via1.setDebug(false);
        this.via2.setDebug(false);
        this.startTime = new Date().getTime();    // milliseconds after epoch
        this.c = 0;

        console.log("Checking ROMs...");

        if (this.roms && this.roms.isValid()) {

            console.log("ROMs OK.");
            console.log("Starting Vic20 reset...");

            let romChar = this.roms.roms().find(r => r.fileType == RomFileType.character && r.region == RomRegion.default);
            if (!romChar) {
                throw Error("Missing char ROM.");
            }
            this.Memory.loadData(romChar.data[0], 0x8000);
            console.log("Loaded char ROM at 0x8000.");

            let romBasic = this.roms.roms().find(r => r.fileType == RomFileType.basic && r.region == RomRegion.default);
            if (!romBasic) {
                throw Error("Missing BASIC ROM.");
            }
            this.Memory.loadData(romBasic.data[0], 0xC000);
            console.log("Loaded BASIC ROM at 0xC000.");

            let romKernal = this.roms.roms().find(r => r.fileType == RomFileType.kernal && r.region === ((this.videoRegion === VideoRegion.pal) ? RomRegion.pal : RomRegion.ntsc));
            if (!romKernal) {
                throw Error("Missing kernal ROM.");
            }
            this.Memory.loadData(romKernal.data[0], 0xE000);
            console.log("Loaded kernal ROM at 0xE000.");

            if (this.cartridgeName) {
                let cart = this.roms.cartridges().find(c => c.name === this.cartridgeName);
                if (cart) {
                    let unpackedCart = this.roms.unpack(cart);
                    if (this.roms.isAutoLoad(unpackedCart)) {
                        // cart is autoload type - don't need start address for reset
                        // reset will automatically check A000
                        unpackedCart.forEach(c => {
                            this.Memory.loadData(c.data, c.loadAddress);
                        });
                    } else if (unpackedCart.length == 1) {
                        // manual load with single part.
                        setTimeout(() => {
                            this.manualloadCart(unpackedCart[0].data, unpackedCart[0].loadAddress);
                        }, 5000);
                    } else {
                        throw new Error(`Error! Cannot perform manual load of multi-part rom.`);
                    }
                }
            }

            // Reset all components
            this.via1.reset();
            this.via2.reset();
            this.Cpu.reset();

            // Start timer
            this.timeoutId = window.setTimeout(() => this.frameRepeat(), this.frameDelay);
        } else {
            // Update canvas
            let ctx: CanvasRenderingContext2D | null = this.canvas.getContext("2d");
            if (ctx) {
                ctx.font = "8px Arial";
                ctx.strokeStyle = "#aaa";
                ctx.fillStyle = "#aaa";
                ctx.fillText("No ROMs loaded. Use configuration to load.", 2, 10);
            }
        }
    }

    private lastNmi: boolean = false;

    /**
     * Sends keystrokes to the Vic20.
     * 0x0277-0x0280: 10 byte keyboard buffer
     * 0x00C6: number of keys in the buffer
     * @param keys 
     */
    public sendKeys(keys: string): void {

        var keyboardBufferAddress = 0x277;
        for (var i = 0; i < keys.length; i++) {
            this.Memory.writeByte(keyboardBufferAddress + i, keys.charCodeAt(i));
        }
        this.Memory.writeByte(0xc6, keys.length);
    }

    /**
     * Single computer cycle
     */
    cycle() {

        this.lastNmi = this.via1.irq
        this.via1.cycleUp();
        this.via2.cycleUp();

        // NMI triggered on a falling edge (i.e. nmi pin goes from high to low)
        // In our case, if previous via1.irq = false, and current via1.irq = true;
        if (this.via1.irq && !this.Cpu.requiresNmi && this.lastNmi == false) {
            this.Cpu.requiresNmi = true;
        }

        if (this.via2.irq && !this.Cpu.requiresIrq) {
            this.Cpu.requiresIrq = true;
        }

        this.Cpu.cycle();
        this.Vic6560.Cycle();
        this.via1.cycleDown();
        this.via2.cycleDown();

        if (this.debug && this.debugHandler) {
            this.debugHandler({
                memory: this.Memory.debug.bind(this.Memory),
                cpu: this.Cpu.getDebug.bind(this.Cpu),
                stack: this.Cpu.getCallStack.bind(this.Cpu),
                vic: this.Vic6560.getDebug.bind(this.Vic6560),
                via1: this.via1.getDebug.bind(this.via1),
                via2: this.via2.getDebug.bind(this.via2),
                pc: this.Cpu.getPC.bind(this.Cpu),
                instruction: this.Cpu.getInstruction.bind(this.Cpu),
                instructionMemory: this.Cpu.getInstructionMemory.bind(this.Cpu)
            });
        }
    }
}