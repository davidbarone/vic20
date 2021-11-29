import cpu6502 from "./cpu/cpu_6502"
import Memory from "./memory/memory"
import { Vic6560 } from "./video/vic_6560"
import Utils from "./lib/utils"
import via6522 from "./io/via_6522"
import keyboard from "./io/keyboard";
import joystick from "./io/joystick"
import OpCodeGenRule from "./cpu/op_code_gen_rule"
import Roms from "./memory/roms"

export class Vic20 {

    canvas: HTMLCanvasElement;
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
    isPal: boolean;         //
    roms: Roms;             // ROMs

    private debug: boolean = false;
    private timeoutId: number = 0;          // controls running / stopping of frames
    private actualFramesPerSecond: number = 0;    // last reported frames per second. Used to provide info to application.

    setDebug(mode: boolean) {
        this.debug = mode;
        this.Cpu.setDebug(mode);
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
        instruction: () => OpCodeGenRule,
        instructionMemory: () => number | null
    }): void

    constructor(canvas: HTMLCanvasElement, expansion: string = 'unexpanded', isPal: boolean = false, roms: FileList) {
        this.canvas = canvas;
        this.Memory = new Memory(expansion);
        this.Cpu = new cpu6502(this.Memory);
        this.Vic6560 = new Vic6560(isPal, this.Memory, canvas, 0x9000);

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
        this.isPal = isPal;
        this.roms = new Roms(roms, this.isPal);
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

    /**
     * Initialises the Vic20 computer
     */
    init() {
        // Check all ROMs present?
        this.roms.hasAllRoms()
            .then(hasRoms => {
                if (hasRoms) {
                    console.log("Vic20 init");
                    this.reset();
                    console.log(this.Memory);
                    this.timeoutId = window.setTimeout(() => this.frameRepeat(), this.frameDelay);
                } else {
                    // Update canvas
                    let ctx: CanvasRenderingContext2D | null = this.canvas.getContext("2d");
                    if (ctx) {
                        debugger;
                        ctx.font = "8px Arial";
                        ctx.strokeStyle = "#555555";
                        ctx.fillStyle = "#555555";
                        ctx.fillText("No ROMs loaded. Use configuration to load.", 0, 8);
                    }
                }
            });
    }

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
                        mode: this.isPal ? "PAL" : "NTSC",
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

    public loadCart(data: Uint8Array) {
        // first 2 bytes  are the loading address
        let loadAddress = data[0] + (data[1] << 8);
        data = data.slice(2);   // remove first 2 bytes
        let endLocation = loadAddress + data.length;
        if (loadAddress == 0xA000) {
            // cart is autoload type
            this.Memory.loadData(data, loadAddress);
            this.reset();
        } else {
            // not autoload

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

            for (var i = 0; i < bootStrap.length; i++) this.Memory.writeByte(320 + i, bootStrap[i]);
            if (
                data[8] == 0x41 &&
                data[9] == 0x30 &&
                data[10] == 0xc3 &&
                data[11] == 0xc2 &&
                data[12] == 0xcd
            ) {
                alert("Type SYS64802 to start");
            } else {
                alert("Type SYS320 to start");
            }

            this.Memory.loadData(data, loadAddress);
        }
    }

    /**
     * Resets the machine
     */
    reset() {
        console.log("Vic20 reset");

        this.roms.getRom("character", "default")
            .then(romChar => {
                this.Memory.loadData(romChar, 0x8000);
                console.log("Loaded char ROM at 0x8000");
                return this.roms.getRom("basic", "default");
            })
            .then(romBasic => {
                this.Memory.loadData(romBasic, 0xC000);
                console.log("Loaded BASIC ROM at 0xC000");
                return this.roms.getRom("kernal", this.isPal ? "pal" : "ntsc");
            })
            .then(romKernal => {
                this.Memory.loadData(romKernal, 0xE000);
                console.log("Loaded kernal ROM at 0xE000");

                this.via1.reset();
                this.via2.reset();
                this.Cpu.reset();
            })
    }

    private lastNmi: boolean = false;

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
        //this.via1.cycleDown();
        //this.via2.cycleDown();

        if (this.debug && this.debugHandler) {
            this.debugHandler({
                memory: this.Memory.debug.bind(this.Memory),
                cpu: this.Cpu.getDebug.bind(this.Cpu),
                stack: this.Cpu.getCallStack.bind(this.Cpu),
                vic: this.Vic6560.getDebug.bind(this.Vic6560),
                pc: this.Cpu.getPC.bind(this.Cpu),
                instruction: this.Cpu.getInstruction.bind(this.Cpu),
                instructionMemory: this.Cpu.getInstructionMemory.bind(this.Cpu)
            });
        }
    }
}