import Memory from "../memory/memory";
import Registers from "./registers";
import ProcessorStatus from "./processor_status";
import Utils from "../lib/utils";

/**
 * Provides internal services of 6502 cpu.
 */
export default class cpu6502Internal {
    protected Memory: Memory;
    protected Registers: Registers;
    protected StackBase = 0x100; // Base of stack
    protected Cycles: number = 0; // number of cycles remaining on current instruction

    /**
     * Constructor
     * @param memory 64K addressable memory
     */
    constructor(
        memory: Memory
    ) {
        this.Memory = memory;
        this.Registers = {
            PC: 0,
            SP: 0,
            A: 0,
            X: 0,
            Y: 0,
            P: new ProcessorStatus(0)
        }
    }

    /**
     * Push a byte onto the stack
     * @param value byte to push
     */
    protected push(value: number): void {
        this.Memory.writeByte(this.StackBase + this.Registers.SP, value);

        // SP loops round 8 bits
        this.Registers.SP = (this.Registers.SP - 1) & 0xFF;
    }

    /**
     * Pops a byte from the stack
     * @returns byte
     */
    protected pop(): number {
        this.Registers.SP = (this.Registers.SP + 1) & 0xFF;
        return this.Memory.readByte(this.StackBase + this.Registers.SP);
    }

    /**
     * Shifts a number to left or right. Carry
     * flag receives the shifted out bit.
     * @param value original value
     * @param shiftRight If set to true, then right shift, else left shift
     * @param rotate If set to true, then existing carry shifted into new/empty bit
     * @returns shifted number
     */
    protected rotate(value: number, shiftRight: boolean, rotate: boolean) {
        let oldCarry = this.Registers.P.isSetC() ? 1 : 0;
        let newCarry = shiftRight ? (value & 1) : (value >> 7);
        let result = shiftRight ? value >> 1 : value << 1;
        if (rotate) {
            result = shiftRight ? (result | (oldCarry << 7)) : (result | oldCarry);
        }
        if (newCarry) {
            this.Registers.P.setC();
        } else {
            this.Registers.P.clearC();
        }
        return result;
    }

    /**
     * A,Z,C,N = A + M + C
     * If overflow occurs, carry bit is set
     * Note setnz() called in this method too.
     * @param value value to be added to register A
     */
    protected adc(value: number): void {
        if (this.Registers.P.isSetD()) {
            this.adcBcd(value);
        } else {
            this.adcNonBcd(value);
        }
    }

    protected adcNonBcd(value: number): void {
        let carryIn = this.Registers.P.isSetC() ? 1 : 0;
        let result = this.Registers.A + value + carryIn;
        let carryOut = Utils.ShiftRight((result & 0x100), 8);
        if (carryOut) {
            this.Registers.P.setC();
        } else {
            this.Registers.P.clearC();
        }

        // Set overflow flag:
        // The definition of the 6502 overflow flag is that it is set if the result of a signed addition or subtraction doesn't fit into a signed byte.
        // http://www.righto.com/2012/12/the-6502-overflow-flag-explained.html
        let c6 = Utils.ShiftRight((Utils.ExtractBits(value, 0, 6) + Utils.ExtractBits(this.Registers.A, 0, 6) + carryIn) & 0x80, 7);
        let c7 = carryOut;
        let v = c6 ^ c7;
        if (v) {
            this.Registers.P.setV()
        } else {
            this.Registers.P.clearV()
        }

        this.Registers.A = result & 0xFF;
        this.setzn(this.Registers.A);
    }

    /**
     * Add with carry. Returns A + M + C.
     * If d flag set, then does BCD add. This
     * function normally used to update accumulator.
     * 
     * Note c flag is set in this function. zn flags
     * must be set outside this function.
     * @param value 
     * @returns 
     */
    protected adcBcd(value: number): void {
        var ah = 0;
        var tempb = (this.Registers.A + value + (this.Registers.P.isSetC() ? 1 : 0)) & 0xff;
        if (!tempb) {
            this.Registers.P.setZ();
        } else {
            this.Registers.P.clearZ();
        }
        var al = (this.Registers.A & 0xf) + (value & 0xf) + (this.Registers.P.isSetC() ? 1 : 0);
        if (al > 9) {
            al -= 10;
            al &= 0xf;
            ah = 1;
        }
        ah += (this.Registers.A >>> 4) + (value >>> 4);
        if (!!(ah & 8)) {
            this.Registers.P.setN();
        } else {
            this.Registers.P.clearN();
        }

        if (!((this.Registers.A ^ value) & 0x80) && !!((this.Registers.A ^ (ah << 4)) & 0x80)) {
            this.Registers.P.setV();
        } else {
            this.Registers.P.clearV();
        }

        this.Registers.P.clearC();
        if (ah > 9) {
            this.Registers.P.setC();
            ah -= 10;
            ah &= 0xf;
        }
        this.Registers.A = ((al & 0xf) | (ah << 4)) & 0xff;
    }

    /**
     * Substract with carry. Returns A-M-(1-C). Generally
     * used to update accumulator.
     * SBC is defined, so that it is equilavent to ADC with
     * ones complement of the second value.
     * @param value value to subtract from register A
     */
    protected sbc(value: number): void {
        if (this.Registers.P.isSetD()) {
            this.sbcBcd(value);
        } else {
            this.adcNonBcd(value ^ 0xFF);
        }
    }

    protected sbcBcd(value: number): void {
        var carry = this.Registers.P.isSetC() ? 0 : 1;
        var al = (this.Registers.A & 0xf) - (value & 0xf) - carry;
        var ah = (this.Registers.A >>> 4) - (value >>> 4);
        if (al & 0x10) {
            al = (al - 6) & 0xf;
            ah--;
        }
        if (ah & 0x10) {
            ah = (ah - 6) & 0xf;
        }

        var result = this.Registers.A - value - carry;

        if (!!(result & 0x80)) {
            this.Registers.P.setN();
        } else {
            this.Registers.P.clearN();
        }

        if (!(result & 0xff)) {
            this.Registers.P.setZ();
        } else {
            this.Registers.P.clearZ();
        }

        if (!!((this.Registers.A ^ result) & (value ^ this.Registers.A) & 0x80)) {
            this.Registers.P.setV();
        } else {
            this.Registers.P.clearV();
        }

        if (!(result & 0x100)) {
            this.Registers.P.setC();
        } else {
            this.Registers.P.clearC();
        }
        this.Registers.A = al | (ah << 4);
    }

    /**
     * Executes an interrupt request (IRQ)
     */
    protected irq() {
        let pc = this.Registers.PC;
        this.push(Utils.msb(pc));
        this.push(Utils.lsb(pc));
        this.push(this.Registers.P.Flags);
        this.Registers.P.setI();

        // Get IRQ vector
        let VCTRIRQ = 0xFFFE;
        this.Registers.PC = this.Memory.readWord(VCTRIRQ);
    }

    /**
     * Executes a non-maskable interrupt (NMI)
     */
    protected nmi() {
        let pc = this.Registers.PC;
        this.push(Utils.msb(pc));
        this.push(Utils.lsb(pc));
        this.push(this.Registers.P.Flags);
        this.Registers.P.setI();

        // Get NMI vector
        let VCTRNMI = 0xFFFA;
        this.Registers.PC = this.Memory.readWord(VCTRNMI);
    }

    /**
     * Initiates a software interrupt similar to hardware interrupt (IRQ).
     * The return address pushed to the stack is PC+2, providing an extra
     * byte of spacing for a break mark (identifying a reason for the break.)
     * The status register will be pushed to the stack with the break flag
     * set to 1. However, when retrieved during RTI or by a PLP instruction,
     * the break flag will be ignored. The interrupt disable flag is not set
     * automatically.
     */
    protected brk() {
        let pc = this.Registers.PC + 1;     // note that pc already advanced 1. Add 1 more byte padding for 'reason for break'
        this.push(Utils.msb(pc));
        this.push(Utils.lsb(pc));

        /**
         * Set the break flag (bit 4) and bit 5 (which denotes standard stack frame)
         */
        let status: number = this.Registers.P.Flags | (1 << 4) | (1 << 5);

        this.push(status);
        this.Registers.P.setI()
        let vector: number = this.Memory.readWord(0xFFFE);      // IRQ vector
        this.Registers.PC = vector;
    }

    /**
     * Return from interrupt.
     */
    protected rti() {
        let flags = this.pop();
        this.Registers.P.Flags = flags;
        let lsb: number = this.pop();
        let msb: number = this.pop();
        let offset: number = Utils.ShiftLeft(msb, 8) | lsb
        this.Registers.PC = offset;
    }

    /**
     * Sets the zero and negative status flags
     * @param v value being checked
     * @returns modified value. zn flags implicitly modified too.
     */
    protected setzn(v: number) {
        v &= 0xff;  // single byte
        let a = !v;

        (!v) ? this.Registers.P.setZ() : this.Registers.P.clearZ();
        (!!(v & 0x80)) ? this.Registers.P.setN() : this.Registers.P.clearN();

        return v | 0;
    };

    /**
     * bit M6 -> overflow flag (v)
     * bit M7 -> negative flag (n)
     * A & MEM -> zero flag (z)
     * 
     * Note: nv flags not affected when addressMode is 'imm'
     */
    protected bit(memory: number, addressMode: string) {

        if (addressMode !== "imm") {
            let overflow = Utils.ExtractBits(memory, 6, 6);
            if (overflow) {
                this.Registers.P.setV();
            } else {
                this.Registers.P.clearV();
            }

            let negative = Utils.ExtractBits(memory, 7, 7);
            if (negative) {
                this.Registers.P.setN();
            } else {
                this.Registers.P.clearN();
            }
        }

        let zero = !(this.Registers.A & memory)
        if (zero) {
            this.Registers.P.setZ();
        } else {
            this.Registers.P.clearZ();
        }
    }

    /**
     * Performs a compare. Used for CMP, CPX, CPY instructions.
     * Compares A/X/Y with memory, and sets flags as follows:
     * C: If A/X/Y >= M
     * Z: If A/X/Y == M
     * N: If A/X/Y < M or A/X/Y > M then set to bit(7) of A/X/Y - M
     * @param register register value
     * @param memory memory value
     */
    protected compare(register: number, memory: number) {
        this.setzn(register - memory);
        if (register >= memory) {
            this.Registers.P.setC();
        } else {
            this.Registers.P.clearC();
        }
    }

    /**
     * Performs a branch by setting pc register.
     * @param condition Condition to check
     * @param offset Offset to branch to, if condition is true. Offset is 1 byte in length
     */
    protected branch(condition: { (): boolean }, offset: number): void {
        var doBranch = condition();

        // branch is signed offset
        offset = Utils.signedByte(offset);

        if (doBranch) {
            // Note at this point, this.Registers.PC should be pointing to the next instruction already
            let nextInstructionOffset = (this.Registers.PC) & 0xFFFF;
            let branchOffset = (nextInstructionOffset + offset) & 0xffff;
            this.Registers.PC = branchOffset

            // branch instruction takes 2 cycles if branch not taken (default).
            // Add one cycle if branch taken. Add another cycle if page boundary
            // crossed.
            this.Cycles++;

            if (this.getPage(nextInstructionOffset) !== this.getPage(branchOffset)) {
                this.Cycles++;
            }
        }
    }

    /**
     * JSR (jump to subroutine)
     * Pushes the [address-1] of the next operation to the stack before transferring program
     * control to the following subaddress. Subroutine normally terminated by RTS operation.
     * Address is a word.
     */
    protected jsr(address: number) {
        // PC already pointing to next instruction. Need [address - 1]
        let nextInstOffset = (this.Registers.PC - 1) & 0xFFFF;
        this.push(Utils.msb((nextInstOffset) & 0xFFFF))
        this.push(Utils.lsb((nextInstOffset) & 0xFFFF))
        this.Registers.PC = address;
    }

    /**
     * RTS (return from sub routine)
     * 
     */
    protected rts() {
        let low = this.pop();
        let high = this.pop();
        let address = Utils.ShiftLeft(high, 8) | low;
        // transfers program control to [address + 1], as JSR pushed [next instruction - 1] originally
        this.Registers.PC = address + 1;
    }

    /**
     * JMP can be either abs or ind. JMP is the only instruction that uses ind mode.
     */
    protected jmp(offset: number, isAbs: boolean) {
        if (isAbs) {
            // abs address mode
            this.Registers.PC = offset;
        } else {
            // ind addresss mode - get word at offset. This stores the real offset to set PC to.
            offset = this.Memory.readWord(offset);
            this.Registers.PC = offset;
        }
    }

    /**
     * The 6502 CPU groups memory together into 256 byte pages.
     * This function returns the page number / high byte
     * @param offset 
     */
    protected getPage(offset: number) {
        get: {
            return Utils.ShiftRight((offset & 0xFFFF), 8);
        }
    }

    /**
     * Fetches next byte at pc, and moves pc on 1 byte
     * @returns instruction. pc is automatically moved on 1 byte
     */
    protected FetchInstruction(): number {
        let instruction = this.Memory.readByte(this.Registers.PC);
        this.Registers.PC = (this.Registers.PC + 1) & 0xFFFF;
        return instruction;
    }
}