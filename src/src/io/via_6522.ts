/**
 * The versatile interface adapter (via6522) chip emulator
 * 
 * Used as an io port controller for the 6502 cpu. The via6522 provided:
 * - 2 bidirectional 8-bit parallel IO ports
 * - 2 16-bit timers
 * - One 8-bit shift register for serial communications
 *
 * Pin Configuration - VIA6522 has 40 pins (underscore = pull down to activate):
 * - 1: Vss (system logic ground voltage)
 * - 2-9: PA0-7
 * - 10-17: PB0-7
 * - 18: CB1
 * - 19: CB2
 * - 20: Vcc (system supply voltage)
 * - 21: _IRQ_
 * - 22: R/W_
 * - 23: _CS2_
 * - 24: _CS1_
 * - 25: phi02 (input clock phase 2). Controls all transfers between R6522 and microprocessor
 * - 26-33: D7-0
 * - 34: _RES_ (clears all internal registers) 
 * - 35-38: RS3-0 (register selector)
 * - 39: CA2
 * - 40: CA1
 *  
 * The Vic20 contained 2 via6522 chips (VIA1 and VIA2)
 * 
 * Auxilliary Control Register (ACNTRL)
 * ------------------------------------
 * 
 *  |---------------------------------------------------------------------------|
 *  |   Bit     |   7   |   6   |   5   |   4   |   3   |   2   |   1   |   0   |
 *  |---------------------------------------------------------------------------|
 *  |   Use     |       T1      |   T2  |    Shift Register     |Port B |Port A |
 *  |---------------------------------------------------------------------------|
 * 
 *  T1 Values
 *  - 00:   Generate a single time-out interrupt each time timer #1 is loaded. Output pin PB7 is disabled.
 *  - 01:   Generate continuous interrupts. Output pin PB7 is disabled.
 *  - 10:   Generate a single interrupt and an output pulse on pin PB7 for timer #1 load operation.
 *  - 11:   Generate continuous interrupts and a square wave output on pin PB7.
 * 
 *  T2 Values
 *  - 0:    Interval timer mode - As an interval timer, Timer #2 operates in one-shot mode similiar to
 *          Timer #1. In this mode, Timer #2 provides a single interrupt for each T2HOC operation. After
 *          timing out, the counter will continue to decrement. However, setting of the interrupt flag
 *          will be disabled after initial time-out so that it will not be set by the counter continuing
 *          to decrement through zero. The processor must rewrite T2HOC to enable setting of the interrupt
 *          flag. The interrupt flag is cleared by reading T2LOLC or by writing T2HOC.
 *  - 1:    Pulse counting mode - This is accomplished by first loading a number into T2LOLC. Writing into
 *          T2HOC clears the interrupt flag and allows the counter to decrement each time a pulse is applied
 *          to PB6. The interrupt flag will be set when Timer #2 reaches zero. The timer will continue to
 *          down-count with each pulse on PB6. However, it is necessary to rewrite T2HOC to allow the
 *          interrupt flag to set on subsequent down-counting operations. The pulse must be low on the
 *          leading edge of the phase 2 clock.
 * 
 *  Shift Register Values
 *  - 000:  Shift register disabled
 *  - 001:  Shift-in under control of Timer #2
 *  - 010:  Shift-in at system clock rate
 *  - 011:  Shift-in under control of external pulses
 *  - 100:  Shift-out under control of Timer #2
 *  - 101:  Shift-out under control of Timer #2
 *  - 110:  Shift-out at system clock rate
 *  - 111:  Shift-out under control of external pulses
 * 
 * Peripheral Control Register (REG12)
 * -----------------------------------
 * Used for write-handshaking
 * 
 *  +-----------+-------+-------+-------+-------+-------+-------+-------+-------+
 *  |   Bit     |   7   |   6   |   5   |   4   |   3   |   2   |   1   |   0   |
 *  +-----------+-------+-------+-------+-------+-------+-------+-------+-------+
 *  |   Use     |       CB2 Control     |  CB1  |       CA2 Control     |  CA1  |
 *  +-----------+-----------------------+-------+-----------------------+-------+
 * 
 * CB2 Control / CA2 Control:
 * - 000:   Input negative active edge
 * - 001:   Independent interrupt input negative edge
 * - 010:   Input positive active edge
 * - 011:   Independent interrupt input positive edge
 * - 100:   Handshake output
 * - 101:   Pulse output
 * - 110:   Low output
 * - 111:   High output
 * 
 * CB1 Control / CA1 Control (latch/interrupt control)
 * - 0:     Negative active edge
 * - 1:     Positive active edge
 

*/

import Utils from "../lib/utils";
import Memory from "../memory/memory";
import { Via6522RegisterEnum } from "./via_6522_register_enum";
import { Via6522InterruptFlagRegisterEnum } from "./via_6522_interrupt_flag_register_enum"
import Via6522DebugInfo  from "./via_6522_debug_info"

type byteBit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type wordBit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0xA | 0xB | 0xC | 0xD | 0xE | 0xF;

export default class via6522 {

    /**
     * History of recent CPU instructions. Used for debug purposes
     */
    private history: Array<Via6522DebugInfo> = [];

    /**
     * Number of instructions stored in cpu history.
     */
    private historySize: number = 1000;

    // pins (represent connections to peripheral devices)
    //public pinsA: number;
    //public pinsB: number;

    // name
    private name: string = "";

    // Base address
    private base: number = 0;

    // Registers
    private reg: Array<number> = new Array(16);
    private memory: Memory;

    // Specific pins
    // ?read/write 

    // Register Mappings
    private T2L: number = 0;        //  Timer 2 Latch (8-bit - only lower byte used)
    private T2C: number = 0;        //  Timer 2 Counter Value (16-bit)
    private RUNFL: number = 0;      //  Bit 7: Timer 1 will generate IRQ on underflow. Bit 6: Timer 2 will generate IRQ on underflow (8-bit)
    private SR: number = 0;         //  Shift Register Value (8-bit)
    private ACR: number = 0;        //  Auxilliary control register (8-bit)
    private PCR: number = 0;        //  Peripheral control register (8-bit)
    private PB7: number = 0;        //  Bit 7: pb7 state (8-bit)
    private SRHBITS: number = 0;    //  Number of half-bits to shift out on SR (8-bit)
    private CABSTATE: number = 0;   //  Bit 7: state of CA2 pin. Bit 6: state of CB2 pin. (8-bit)
    private ILA: number = 0;        //  Port A input latch (see ACR bit 0) (8 bit)
    private ILB: number = 0;        //  Port B input latch (see ACR bit 1) (8 bit)
    private clearedT1: boolean = false;
    private clearedT2: boolean = false;

    private lastCA1: boolean = true;
    private CA1: boolean = true;

    private lastCB1: boolean = true;
    private CB1: boolean = true;

    private debug: boolean = false;

    public constructor(name: string, memory: Memory, offset: number) {
        this.name = name;
        this.base = offset;
        this.memory = memory;
        this.debug = false;
        //this.pinsA = 255;
        //this.pinsB = 255;

        for (let i = 0; i < this.reg.length; i++) {
            let offset: number = this.base + i;
            this.memory.readFunc[offset] = (offset) => this.read(offset);
            this.memory.writeFunc[offset] = (offset, value) => { this.write(offset, value) };
        }
    }

    /**
     * Emulates pulling low on _RES_ (pin 34).
     * Reset (RES) clears all internal registers (except T1 and T2
     * counters and latches, and the Shift Register (SR)).
     * 
     * In the RES condition. a!l peripheral interface lines
     * (PA and PB) are placed in the input state Also, the Timers
     * (T1 and T2), SR and interrupt logic are disabled from operation
     */
    public reset() {
        // Clear all internal registers except
        // T1 and T2 counters and latches, and SR
        for (var i = Via6522RegisterEnum.R0_ORB_IRB; i <= Via6522RegisterEnum.R3_DDRA; i++) {
            this.write(i, 0);
        }
        for (var i = Via6522RegisterEnum.RB_ACR; i <= Via6522RegisterEnum.RF_ORA; i++) {
            this.write(i, 0);
        }

        for (var i = Via6522RegisterEnum.R4_T1C_L; i <= Via6522RegisterEnum.RA_SR; i++) {
          this.write(i, 0xFF);
        }

        // Timers, SR, and interrupt logic are disabled
        this.clearedT1 = true;
        this.clearedT2 = true;
    }

    private decrementTimer(index: number) {
        let timer = this.getTimer(index);
        timer--;
        this.setTimer(index, timer);
    }

    private getTimer(index: number): number {
        if (index == 1) {
            let t1c = this.getReg(Via6522RegisterEnum.R4_T1C_L) + (this.getReg(Via6522RegisterEnum.R5_T1C_H) << 8);
            return t1c;
        } else {
            let t2c = this.getReg(Via6522RegisterEnum.R8_T2C_L) + (this.getReg(Via6522RegisterEnum.R9_T2C_H) << 8);
            return t2c;
        }
    }

    private setTimer(index: number, value: number) {
        if (index == 1) {
            this.setReg(Via6522RegisterEnum.R4_T1C_L, value & 0xff);
            this.setReg(Via6522RegisterEnum.R5_T1C_H, (value >> 8) & 0xff);
        } else if (index==2) {
            this.setReg(Via6522RegisterEnum.R8_T2C_L, value & 0xff);
            this.setReg(Via6522RegisterEnum.R9_T2C_H, (value >> 8) & 0xff);
        } else {
            throw Error(`Invalid timer: T${index}.`)
        }
    }

    /**
     * Emulates functions when phi2 clock goes low.
     */
    public cycleDown() {
        this.decrementTimer(1);
        this.decrementTimer(2);
    }

    public cycleUp() {

        this.lastCA1 = this.CA1;
        this.lastCB1 = this.CB1;

        this.CA1 = true;
        this.CB1 = true;

        if (this.getTimer(1) == 0) {
            // this.setIfr(1, true);
            this.setIfr(Via6522InterruptFlagRegisterEnum.R6_T1, true);
            this.PB7 = 1;
            this.clearedT1 = false;

            // if set to continuous interrupts, set clearedT1 = true
            if (Utils.ExtractBits(this.getReg(Via6522RegisterEnum.RB_ACR), 6, 6) == 1) {
                this.clearedT1 = true;  // continuous mode
                const t1l = this.getReg(Via6522RegisterEnum.R6_T1L_L) + (this.getReg(Via6522RegisterEnum.R7_T1L_H) << 8)
                // copy latch->counter
                this.setTimer(1, t1l);
            } else {
                //this.setTimer(1, 0xffff);
            }
        } else {
            this.setIfr(Via6522InterruptFlagRegisterEnum.R6_T1, false);
        }

        if (this.getTimer(2) == 0) {
            this.setIfr(Via6522InterruptFlagRegisterEnum.R5_T2, true);
            this.setTimer(2, 0xffff);
        }

        //this.setCA1Interrupt();
        //this.setCB1Interrupt();

        // Debug?
        if (this.debug) {
            let info = this.getDebugInfo();

            // Add to history
            this.history.push(info);
            if (this.history.length > this.historySize) {
                this.history.shift();
            }

            console.log(info.complete);
        }
    }

    /**
     * Public getter for registers.
     * @param index The register to get.
     * @returns Returns the value of the register.
     */
    public getReg(index: Via6522RegisterEnum) {
        switch (index) {
            case Via6522RegisterEnum.RD_IFR:
                // set bit 7 if any of bits 0-6 set
                return ((this.reg[index] & 127) | ((this.reg[index] & 127) ? 0x80 : 0x00)) & 0xff;
                break;
            case Via6522RegisterEnum.RE_IER:
                // always set bit 7 to 1.
                return (this.reg[index] | 0x80) & 0xff;
            default:
                return this.reg[index] & 0xff;
        }
    }

    /**
     * Sets the value of a register.
     * @param index The index (0-15)
     * @param value The value (0x00-0xff)
     */
    public setReg(index: Via6522RegisterEnum, value: number) {
        this.reg[index & 0xF] = (value & 0xFF);
    }

    /**
     * Sets the Interrupt flag register
     */
    private setIfr(bit: Via6522InterruptFlagRegisterEnum, status: boolean) {
        const ifr = this.getReg(Via6522RegisterEnum.RD_IFR);
        const newValue = ((ifr & ~(1 << bit)) | ((status ? 1 : 0) << bit)) & 0xFF;
        this.setReg(Via6522RegisterEnum.RD_IFR, newValue)
    }

    /**
     * Set to true when the via6522 interrupt register is set. Represents the IRQ line going low.
     */
    public get irq(): boolean {
        let ifr = this.getReg(Via6522RegisterEnum.RD_IFR);
        const ier = this.getReg(Via6522RegisterEnum.RE_IER);
        // T1 interrupt can only be set if clearedT1 = true
        //ifr = ifr & (this.clearedT1 ? 0xFF : ~0x40);
        // Bit 7 is always set to 1,so we ignore
        let result: boolean = ((ifr & ier & 0x7F) > 0);
        return result;
    }

    /**
     * Reads from port A. Note that port A is 8-bit bi-directional port, using pins PA0-PA7
     */
    public getPortA?: () => number

    /**
     * Writes to port A. Note that port A is 8-bit bi-directional port, using pins PA0-PA7
     */
    public setPortA?: (value: number) => void

    /**
     * Reads from port B. Note that port B is 8-bit bi-directional port, using pins PB0-PB7
     */
    public getPortB?: () => number

    /**
     * Writes to port B. Note that port B is 8-bit bi-directional port, using pins PB0-PB7
     */
    public setPortB?: (value: number) => void

    setDebug(mode: boolean) {
        this.debug = mode;
    }



    private setCA1Interrupt(): void {
        // Check PCR register, bit 0
        switch (Utils.ExtractBits(this.reg[0xC], 0, 0)) {
            case 0: // high to low transition
                if (this.CA1 === false && this.lastCA1 === true) {
                    this.setIfr(1, true);   // Set IFR, bit 1 (CA1)
                }
                break;
            case 1: // low to high transition
                if (this.CA1 === true && this.lastCA1 === false) {
                    this.setIfr(1, true);   // Set IFR, bit 1 (CA1)
                }
                break;
        }
    }

    private setCB1Interrupt(): void {
        // Check PCR register, bit 4
        switch (Utils.ExtractBits(this.reg[0xC], 4, 4)) {
            case 0: // high to low transition
                if (this.CB1 == false && this.lastCB1 == true) {
                    this.setIfr(4, true);   // Set IFR, bit 4 (CB1)
                }
                break;
            case 1: // low to high transition
                if (this.CB1 == true && this.lastCB1 == false) {
                    this.setIfr(4, true);   // Set IFR, bit 1 (CB1)
                }
                break;
        }
    }

    private getAcrStatus(ACR: number): string {
        ACR = ACR & 0xff;
        var pa = Utils.ExtractBits(ACR, 0, 0);
        var pb = Utils.ExtractBits(ACR, 1, 1);
        var sr = Utils.ExtractBits(ACR, 2, 4);
        var t2 = Utils.ExtractBits(ACR, 5, 5);
        var t1 = Utils.ExtractBits(ACR, 6, 7);

        const latchingStatuses: string[] = [
            'off',
            'on'
        ]

        const SRStatuses: string[] = [
            'Disabled',
            'S/in T2',
            'S/in phi02',
            'S/in ext clk',
            'S/out F/run T2',
            'S/out T2',
            'S/out phi02',
            'S/out ext clk'
        ]

        const T2Statuses: string[] = [
            'Timed',
            'Pulse PB6'
        ]

        const T1Statuses: string[] = [
            'Timed (PB7 off)',
            'Cont. (PB7 off)',
            'Timed (PB7 1-shot)',
            'Cont. (PB7 s/wave)'
        ]

        return `T1:[${T1Statuses[t1]}] T2:[${T2Statuses[t2]}] SR:[${SRStatuses[sr]}] PA:[${latchingStatuses[pa]}] PB:[${latchingStatuses[pb]}]`
    }


    /**
      * Gets last n instructions executed
      * @param history Number of instructions, n, to keep in history. Can be between 1 and historyMaxSize
      * @returns Debug string showing last instructions
      */
    public getDebug(history: number): string {
        if (history < 1 || history > this.historySize) {
            throw "Invalid history value.";
        }
        let text = "";

        let frameEnd: number = this.history.length;
        let frameStart: number = this.history.length - history;
        if (frameStart < 0) {
            frameStart = 0;
        }

        // return via frame in debug format
        for (let row = frameStart; row < frameEnd; row++) {
            text += `Name:   ${this.history[row].name}
Base:   0x${Utils.NumberToHex(this.history[row].base)} (${this.history[row].base})
Reg:    ${this.history[row].regString}
T1:     ${this.history[row].t1}
T2:     ${this.history[row].t2}
L1:     ${this.history[row].l1}
L2:     ${this.history[row].l2}
ACR:    ${this.history[row].acrStatus}`;
        }
        return text;
    }

    private getDebugInfo(): Via6522DebugInfo {
        let acrString: string = Utils.byteToBinaryString(this.getReg(Via6522RegisterEnum.RB_ACR));
        let pcrString: string = Utils.byteToBinaryString(this.getReg(Via6522RegisterEnum.RC_PCR));
        let ifrString: string = Utils.byteToBinaryString(this.getReg(Via6522RegisterEnum.RD_IFR));
        let ierString: string = Utils.byteToBinaryString(this.getReg(Via6522RegisterEnum.RE_IER));
        let debug: Via6522DebugInfo = {
            name: this.name,
            base: this.base,
            reg: this.reg,
            regString: this.reg.map((r, i) => `${Utils.NumberToHex(r)}` ).join(' '),
            t1: this.getTimer(1),
            t2: this.getTimer(2),
            l1: this.getReg(Via6522RegisterEnum.R6_T1L_L) + (this.getReg(Via6522RegisterEnum.R7_T1L_H) << 8),
            l2: this.getReg(Via6522RegisterEnum.R8_T2C_L) + (this.getReg(Via6522RegisterEnum.R9_T2C_H) << 8),
            acrStatus: this.getAcrStatus(this.getReg(Via6522RegisterEnum.RB_ACR)), 
            acr: acrString,
            pcr: pcrString,
            ifr: ifrString,
            ier: ierString,
            complete: `${this.name}: ACR[${acrString}] PCR[${pcrString}] IFR[${ifrString}] IER[${ierString}] ${this.reg[0xD]} ${this.reg[0xE]}`
        }
        return debug;
    }

    /**
     * Reading from memory
     * @param idx 
     */
    public read(offset: number): number {
        const register: Via6522RegisterEnum = (offset - this.base) & 0xF;    // must be nibble
        let rowInput: number;
        switch (register) {
            case Via6522RegisterEnum.R0_ORB_IRB:
                var ddrb = this.getReg(Via6522RegisterEnum.R2_DDRB);    // 1 = pin is output, 0 = pin is input
                var pins_in = (this.getPortB ? this.getPortB() : 255) & ~ddrb;
                var reg_in = this.getReg(Via6522RegisterEnum.R0_ORB_IRB) & ddrb;
                this.setIfr(Via6522InterruptFlagRegisterEnum.R3_CB2, false);
                this.setIfr(Via6522InterruptFlagRegisterEnum.R4_CB1, false);
                return (pins_in | reg_in) & 0xFF;
            //let value: number = this.getPortA ? this.getPortA() : 0;
            //return value & 0xFF;
            case Via6522RegisterEnum.R1_ORA_IRA:
                var ddra = this.getReg(Via6522RegisterEnum.R3_DDRA);
                this.setIfr(Via6522InterruptFlagRegisterEnum.R0_CA2, false);
                this.setIfr(Via6522InterruptFlagRegisterEnum.R1_CA1, false);
                rowInput = (this.getPortA ? this.getPortA() : 255) & ~ddra;
                return rowInput;
            case Via6522RegisterEnum.R2_DDRB:
                return this.getReg(Via6522RegisterEnum.R2_DDRB);
            case Via6522RegisterEnum.R3_DDRA:
                return this.getReg(Via6522RegisterEnum.R3_DDRA);
            case Via6522RegisterEnum.R4_T1C_L:       // DONE
                // Read from low-order counter and reset interrupt
                this.setIfr(Via6522InterruptFlagRegisterEnum.R6_T1, false);
                return this.getReg(Via6522RegisterEnum.R4_T1C_L);
            case Via6522RegisterEnum.R5_T1C_H:       // DONE
                // Read from high-order counter
                return this.getReg(Via6522RegisterEnum.R5_T1C_H);
            case Via6522RegisterEnum.R6_T1L_L:   // DONE
                // Read from low-order latch
                return this.getReg(Via6522RegisterEnum.R6_T1L_L);
            case Via6522RegisterEnum.R7_T1L_H:   // DONE
                // Read from high-order latch
                return this.getReg(Via6522RegisterEnum.R7_T1L_H);
            case Via6522RegisterEnum.R8_T2C_L:   // DONE
                // Read from low-order counter and reset interrupt
                this.setIfr(Via6522InterruptFlagRegisterEnum.R5_T2, false);
                return (this.getReg(Via6522RegisterEnum.R8_T2C_L));
            case Via6522RegisterEnum.R9_T2C_H:   // DONE
                // Read from high-order counter
                return this.getReg(Via6522RegisterEnum.R9_T2C_H);
            case Via6522RegisterEnum.RA_SR:   // DONE
                return this.getReg(Via6522RegisterEnum.RA_SR);
            case Via6522RegisterEnum.RB_ACR:   // DONE
                return this.getReg(Via6522RegisterEnum.RB_ACR);
            case Via6522RegisterEnum.RC_PCR:   // DONE
                return this.getReg(Via6522RegisterEnum.RC_PCR);
            case Via6522RegisterEnum.RD_IFR:   // DONE
                return this.getReg(Via6522RegisterEnum.RD_IFR);
            case Via6522RegisterEnum.RE_IER:   // DONE
                return this.getReg(Via6522RegisterEnum.RE_IER);
            case Via6522RegisterEnum.RF_ORA:   // ???
                var ddra = this.getReg(Via6522RegisterEnum.R3_DDRA);
                rowInput = (this.getPortA ? this.getPortA() : 255) & ~ddra;
                return rowInput;
            default:
                return 0;
            //throw new Error("Error in via.read()");
        }
    }

    /**
     * Writing to a memory location - results in update to register(s)
     * @param idx 
     * @param value 
     */
    public write(offset: number, value: number): void {
        const register: Via6522RegisterEnum = (offset - this.base) & 0xF;    // must be nibble
        switch (register) {
            case Via6522RegisterEnum.R0_ORB_IRB: // ORB
                this.setReg(Via6522RegisterEnum.R0_ORB_IRB, value);
                this.setIfr(Via6522InterruptFlagRegisterEnum.R3_CB2, false);
                this.setIfr(Via6522InterruptFlagRegisterEnum.R4_CB1, false);
                break;
            case Via6522RegisterEnum.R1_ORA_IRA: // ORA
                this.setReg(Via6522RegisterEnum.R1_ORA_IRA, value);
                this.setIfr(Via6522InterruptFlagRegisterEnum.R0_CA2, false);
                this.setIfr(Via6522InterruptFlagRegisterEnum.R1_CA1, false);
                break;
            case Via6522RegisterEnum.R2_DDRB: // DDRB
                this.setReg(Via6522RegisterEnum.R2_DDRB, value);
                break;
            case Via6522RegisterEnum.R3_DDRA: // DDRA
                this.setReg(Via6522RegisterEnum.R3_DDRA, value);
                break;
            case Via6522RegisterEnum.R4_T1C_L: // DONE
                this.setReg(Via6522RegisterEnum.R6_T1L_L, value);
                break;
            case Via6522RegisterEnum.R5_T1C_H: // DONE
                // Write into high-order latch, transfer latches to counter and reset interrupt
                this.setReg(Via6522RegisterEnum.R7_T1L_H, value);
                this.setReg(Via6522RegisterEnum.R4_T1C_L, this.getReg(Via6522RegisterEnum.R6_T1L_L));
                this.setReg(Via6522RegisterEnum.R5_T1C_H, this.getReg(Via6522RegisterEnum.R7_T1L_H));
                this.setIfr(Via6522InterruptFlagRegisterEnum.R6_T1, false)
                this.clearedT1 = true;  // T1 reset
                break;
            case Via6522RegisterEnum.R6_T1L_L: // DONE
                // Write into low-order latch
                this.setReg(Via6522RegisterEnum.R6_T1L_L, value);
                break;
            case Via6522RegisterEnum.R7_T1L_H: // DONE
                // Write into high-order latch. No latch->counter transfer takes place.
                this.setReg(Via6522RegisterEnum.R7_T1L_H, value);
                this.setIfr(Via6522InterruptFlagRegisterEnum.R6_T1, false)
                this.clearedT1 = true;  // T1 reset
                break;
            case Via6522RegisterEnum.R8_T2C_L: // DONE
                // Write into low-order latch
                this.setReg(Via6522RegisterEnum.R8_T2C_L, value);
                break;
            case Via6522RegisterEnum.R9_T2C_H: // DONE
                // Write into high-order latch, transfer latches to counter and reset interrupt
                this.setReg(Via6522RegisterEnum.R9_T2C_H, value);
                this.setIfr(Via6522InterruptFlagRegisterEnum.R5_T2, false);
                break;
            case Via6522RegisterEnum.RA_SR:
                this.setReg(Via6522RegisterEnum.RA_SR, value);
                break;
            case Via6522RegisterEnum.RB_ACR:
                this.setReg(Via6522RegisterEnum.RB_ACR, value);
                break;
            case Via6522RegisterEnum.RC_PCR:
                this.setReg(Via6522RegisterEnum.RC_PCR, value);
                break;
            case Via6522RegisterEnum.RD_IFR:
                const newValue = this.getReg(Via6522RegisterEnum.RD_IFR) & ~value;
                this.setReg(Via6522RegisterEnum.RD_IFR, newValue);
                break;
            case Via6522RegisterEnum.RE_IER:   // DONE
                // Enabling flags - When writing to the Interrupt enable register ($D00E) and bit 7 is set, then each
                //                  1 in bits 6 through 0 sets the corresponding bit in the Interrupt enable register.
                // Disabling flags - When writing to the Interrupt enable register ($D00E) and bit 7 is cleared, then each
                //                  1 in bits 6 through 0 clears the corresponding bit in the Interrupt enable register.
                const ier = this.getReg(Via6522RegisterEnum.RE_IER);
                if (Utils.ExtractBits(value, 7, 7) == 1) {
                    // Set bits
                    this.setReg(Via6522RegisterEnum.RE_IER, ier | value);
                } else {
                    // Clear bits
                    this.setReg(Via6522RegisterEnum.RE_IER, ier & ~value);
                }
                break;
            case Via6522RegisterEnum.RF_ORA:   // DONE
                this.setReg(Via6522RegisterEnum.RF_ORA, value);
                this.setReg(Via6522RegisterEnum.R1_ORA_IRA, value);     // Copy of ORA
                break;
        }
    }
}