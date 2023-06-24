/**
 * The versatile interface adapter (via6522) chip emulator
 * 
 * Used as an io port controller for the 6502 cpu. The via6522 provided:
 * - 2 bidirectional 8-bit parallel IO ports
 * - 2 16-bit timers
 * - One 8-bit shift register for serial communications
 * 
 * The Vic20 contained 2 via6522 chips (VIA1 and VIA2)
 * 
 *    |-------------------------------------------------------------------------------------|
 *    |     |               |                   Register Description                        |
 *    | Idx |   Register    |       Write (R/W = Low)       |       Read (R/W = High)       |
 *    |     |   (All 8-bit) |                               |                               |                    
 *    |-------------------------------------------------------------------------------------|
 *    | 0x0 |   ORB/IRB     |       Output Register B       |       Input Register B        |
 *    | 0x1 |   ORA/IRA     |       Output Register A       |       Input Register A        |
 *    | 0x2 |   DDRB        |                   Data Direction Register B                   |
 *    | 0x3 |   DDRA        |                   Data Direction Register A                   |
 *    | 0x4 |   T1C-L       |       T1 Low Order Latches    |       T1 Low Order Counter    |
 *    | 0x5 |   T1C-H       |                   T1 High Order Counter                       |
 *    | 0x6 |   T1L-L       |                   T1 Low Order Latches                        |
 *    | 0x7 |   T1L-H       |                   T1 High Order Latches                       |
 *    | 0x8 |   T2C-L       |       T2 Low Order Latches    |       T2 Low Order Counter    |
 *    | 0x9 |   T2C-H       |                   T2 High Order Counter                       |
 *    | 0xA |   SR          |                   Shift Register                              |
 *    | 0xB |   ACR         |                   Auxilliary Control Register                 |
 *    | 0xC |   PCR         |                   Peripheral Control Register                 |
 *    | 0xD |   IFR         |                   Interrupt Flag Register                     |
 *    | 0xE |   IER         |                   Interrupt Enable Register                   |
 *    | 0xF |   ORA*        |       Output Register A*      |       Input Register A*       |
 *    |-------------------------------------------------------------------------------------|
 *      * Sames as ORA, but with no handshake
 * 
 * Interrupt flag register
 * -----------------------
 * One of several conditions may set an internal interrupt in the IFR register. The bits
 * 
 *  |---------------------------------------------------------------------------|
 *  |   Bit     |   7   |   6   |   5   |   4   |   3   |   2   |   1   |   0   |
 *  |---------------------------------------------------------------------------|
 *  |   Hex     | 0x80  | 0x40  | 0x20  | 0x10  | 0x08  | 0x04  | 0x02  | 0x01  |
 *  |---------------------------------------------------------------------------|
 *  |   Source  |IRQ(R) |   T1  |   T2  |   CB1 |   CB2 |   SR  |   CA1 |   CA2 |
 *  |           |EN(R)  |       |       |       |       |       |       |       |
 *  |---------------------------------------------------------------------------|
 *  Note the program checks successively bit 6,5,4,3,2,1,0.
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

type byteBit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type wordBit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0xA | 0xB | 0xC | 0xD | 0xE | 0xF;

export default class via6522 {

    // pins (represent connections to peripheral devices)
    //public pinsA: number;
    //public pinsB: number;

    // name
    private name: string = "";

    // history
    private history: Array<string> = [];
    private historySize: number = 200;

    // Base address
    private base: number = 0;

    // Registers
    private reg: Array<number> = new Array(16);
    private memory: Memory;

    // Register Mappings
    private T1L: number = 0;        //  Timer 1 Latch (16-bit)
    private T1C: number = 0;        //  Timer 1 Counter Value (16-bit)
    private T2L: number = 0;        //  Timer 2 Latch (8-bit - only lower byte used)
    private T2C: number = 0;        //  Timer 2 Counter Value (16-bit)
    private RUNFL: number = 0;      //  Bit 7: Timer 1 will generate IRQ on underflow. Bit 6: Timer 2 will generate IRQ on underflow (8-bit)
    private SR: number = 0;         //  Shift Register Value (8-bit)
    private ACR: number = 0;        //  Auxilliary control register (8-bit)
    private PCR: number = 0;        //  Peripheral control register (8-bit)
    private IFR: number = 0;        //  Active interrupts (8-bit)
    private IER: number = 0;        //  Interrupt mask (8-bit)
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
        //this.pinsA = 255;
        //this.pinsB = 255;

        for (let i = 0; i < this.reg.length; i++) {
            let offset: number = this.base + i;
            this.memory.readFunc[offset] = (offset) => this.read(offset);
            this.memory.writeFunc[offset] = (offset, value) => { this.write(offset, value) };
        }
    }

    /**
     * Public getter for registers.
     * @param index 
     * @returns 
     */
    public getReg(index: number) {
        return this.reg[index];
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

    public cycleUp() {

        this.lastCA1 = this.CA1;
        this.lastCB1 = this.CB1;

        this.CA1 = true;
        this.CB1 = true;

        // Trigger T2
        this.T1C--;

        if (this.T1C == 0) {
            // Test keyboard
            // fire ca1 and ca2
            // this.setIfr(1, true);

            this.setIfr(6, true);
            this.PB7 = 1;
            this.clearedT1 = false;

            // if set to continuous interrupts, set clearedT1 = true
            if (Utils.ExtractBits(this.ACR, 6, 6) == 1) {
                this.clearedT1 = true;  // continuous mode
                this.T1C = this.T1L;
            } {
                this.T1C = 0xfffe;
            }
        } else {
            // this.setIfr(6, false);
        }

        this.T2C--;
        if (this.T2C == 0) {
            this.setIfr(5, true);
            this.T2C = 0xfffe;
        }

        //this.setCA1Interrupt();
        //this.setCB1Interrupt();

        // Debug?
        if (this.debug) {
            let info = this.getDebugInfo();

            // Add to history
            this.history.push(info.complete);
            if (this.history.length > this.historySize) {
                this.history.shift();
            }

            console.log(info.complete);
        }
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

    public cycleDown() {

    }

    /**
     * Set to true when the via6522. Represents the IRQ line going low.
     */
    public get irq(): boolean {
        let ifr = this.IFR;
        // T1 interrupt can only be set if clearedT1 = true
        ifr = ifr & (this.clearedT1 ? 0xFF : ~0x40);
        // Bit 7 is always set to 1,so we ignore
        let result: boolean = ((ifr & this.IER & 0x7F) > 0);
        return result;
    }

    private getDebugInfo() {
        let acrString: string = Utils.byteToBinaryString(this.reg[0xB]);
        let pcrString: string = Utils.byteToBinaryString(this.reg[0xC]);
        let ifrString: string = Utils.byteToBinaryString(this.reg[0xD]);
        let ierString: string = Utils.byteToBinaryString(this.getIer());
        let debug = {
            reg: this.reg,
            acr: acrString,
            pcr: pcrString,
            ifr: ifrString,
            ier: ierString,
            complete: `${this.name}: ACR[${acrString}] PCR[${pcrString}] IFR[${ifrString}] IER[${ierString}] ${this.reg[0xD]} ${this.reg[0xE]}`
        }
        return debug;
    }

    public reset() {
        // Clear all internal registers except
        // T1 and T2 counters and latches, and SR
        for (var i = 0; i < 4; i++) {
            this.write(i, 0);
        }
        for (var i = 0xA; i < 0xF; i++) {
            this.write(i, 0);
        }

        /*
        for (var i = 4; i < 0xA; i++) {
          this.write(i, 0xFF);
        }
        */

        // Timers, SR, and interrupt logic are disabled
        this.clearedT1 = true;
        this.clearedT2 = true;
    }

    /**
     * Sets the Interrupt flag register
     */
    private setIfr(bit: byteBit, status: boolean) {
        this.reg[0xD] = ((this.IFR & ~(1 << bit)) | ((status ? 1 : 0) << bit)) & 0xFF;
        this.IFR = this.reg[0xD];
    }

    /**
     * Sets the Interrupt enabled register
     */
    private setIer(value: number) {
        this.reg[0xE] = value;
        this.IER = this.reg[0xE];
    }

    /**
     * Gets the value of the Interrupt enabled register.
     * Note: Always set bit 7 to 1.
     * @returns value
     */
    private getIer(): number {
        // Bits 0-6 specify the interrupt source
        return this.reg[0xE] | 0x80;
    }

    /**
     * Reading from memory
     * @param idx 
     */
    public read(offset: number): number {
        offset = (offset - this.base) & 0xF;    // must be nibble
        switch (offset) {
            case 0x0:
                var ddrb = this.reg[2];    // 1 = pin is output, 0 = pin is input
                var pins_in = (this.getPortB ? this.getPortB() : 255) & ~ddrb;
                var reg_in = this.reg[0] & ddrb;
                this.setIfr(3, false);      // Clear CB2 bit
                this.setIfr(4, false);      // Clear CB1 bit
                return (pins_in | reg_in) & 0xFF;
            //let value: number = this.getPortA ? this.getPortA() : 0;
            //return value & 0xFF;
            case 0x1:
                var ddra = this.reg[3];
                this.setIfr(0, false);      // Clear CA2 bit
                this.setIfr(1, false);      // Clear CA1 bit
                let rowInput = (this.getPortA ? this.getPortA() : 255) & ~ddra;
                return rowInput;
            case 0x2:
                return this.reg[0x2];   // DDRB
            case 0x3:
                return this.reg[0x3];   // DDRA
            case 0x4:       // DONE
                // Read from low-order counter and reset interrupt
                this.setIfr(6, false);
                return this.T1C & 0xFF;
            case 0x5:       // DONE
                // Read from high-order counter
                return (this.T1C >> 8) & 0xFF;
            case 0x6:   // DONE
                // Read from low-order latch
                return this.T1L & 0xFF;
            case 0x7:   // DONE
                // Read from high-order latch
                return (this.T1L >> 8) & 0xFF
            case 0x8:   // DONE
                // Read from low-order counter and reset interrupt
                this.setIfr(5, false);
                return (this.T2C & 0xFF);
            case 0x9:   // DONE
                // Read from high-order counter
                return (this.T2C >> 8) & 0xFF;
            case 0xA:   // DONE
                return this.reg[offset];
            case 0xB:   // DONE
                return this.reg[offset];
            case 0xC:   // DONE
                return this.reg[offset];
            case 0xD:   // DONE
                var result = this.reg[offset] & 0x7f;   // bits 0-6 store individual flags
                return result ? result | 0x80 : result; // bit7 set set to 1 if any bits 0-6 set
            case 0xE:   // DONE
                return this.getIer();
            case 0xF:   // ???
                var ddra = this.reg[3];
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
        offset = (offset - this.base) & 0xF;    // must be nibble
        switch (offset) {
            case 0: // ORB
                this.reg[offset] = value & 0xFF;
                this.setIfr(3, false);      // Clear CA2 bit;
                this.setIfr(4, false);      // Clear CA1 bit
                break;
            case 1: // ORA
                this.reg[offset] = value & 0xFF;
                this.setIfr(0, false);      // Clear CA2 bit;
                this.setIfr(1, false);      // Clear CA1 bit
                break;
            case 2: // DDRB
                this.reg[offset] = value & 0xFF;
                break;
            case 3: // DDRA
                this.reg[offset] = value & 0xFF;
                break;
            case 4: // DONE
                this.reg[offset] = value & 0xFF;
                this.T1L = (this.T1L & ~0xFF) | value;
                break;
            case 5: // DONE
                // Write into high-order latch, transfer latches to counter and reset interrupt
                this.reg[offset] = value & 0xFF;
                this.T1L = (this.T1L & 0xFF) | (value << 8);
                this.T1C = this.T1L;
                this.setIfr(6, false)
                this.clearedT1 = true;  // T1 reset
                break;
            case 6: // DONE
                // Write into low-order latch
                this.reg[offset] = value & 0xFF;
                this.T1L = (this.T1L & ~0xFF) | value;
                break;
            case 7: // DONE
                // Write into high-order latch and reset timer #1 interrupt
                this.reg[offset] = value & 0xFF;
                this.T1L = (this.T1L & 0xFF) | (value << 8);
                this.setIfr(6, false);
                break;
            case 8: // DONE
                // Write into low-order latch
                this.reg[offset] = value & 0xFF;
                this.T2L = (this.T2L & ~0xFF) | value;
                break;
            case 9: // DONE
                // Write into high-order latch, transfer latches to counter and reset interrupt
                this.reg[offset] = value & 0xFF;
                this.T2L = (this.T2L & 0xFF) | (value << 8);
                this.T2C = this.T2L;
                this.setIfr(5, false);
                break;
            case 0xA:
                this.reg[offset] = value & 0xFF;
                this.SR = this.reg[offset];
                break;
            case 0xB:
                this.reg[offset] = value & 0xFF;
                this.ACR = this.reg[offset];
                break;
            case 0xC:
                this.reg[offset] = value & 0xFF;
                this.PCR = this.reg[offset];
                break;
            case 0xD:
                this.reg[offset] &= ~value;
                this.IFR = this.reg[offset];
                break;
            case 0xE:   // DONE
                // Enabling flags - When writing to the Interrupt enable register ($D00E) and bit 7 is set, then each
                //                  1 in bits 6 through 0 sets the corresponding bit in the Interrupt enable register.
                // Disabling flags - When writing to the Interrupt enable register ($D00E) and bit 7 is cleared, then each
                //                  1 in bits 6 through 0 clears the corresponding bit in the Interrupt enable register.
                if (Utils.ExtractBits(value, 7, 7) == 1) {
                    // Set bits
                    this.setIer(this.IER | value);
                } else {
                    // Clear bits
                    this.setIer(this.IER & ~value);
                }
                break;
            case 0xF:   // DONE
                this.reg[offset] = value & 0xFF;
                this.reg[1] = value & 0xFF;     // Copy of ORA
                break;
        }
    }
}