import { ProcessorStatusFlag } from "./ProcessorStatusFlag";

// -------------------------------
// 6502 ProcessorStatus Register
//
// Bit Code Description
// 0   C    Carry
// 1   Z    Zero
// 2   I    Interupt Disable
// 3   D    Decimal
// 4   B    Breakpoint
// 5   -
// 6   V    Overflow
// 7   N    Negative

export default class ProcessorStatus {
    private Flags: number;

    constructor(flags: number) {
        this.Flags = flags;
    }

    /**
     * Returns status of processor flag
     */
    IsSet(flag: ProcessorStatusFlag): boolean {
        return (this.Flags & flag) != 0 ? true : false;
    }

    /**
     * Sets a processor flag to on
     * @param flag 
     */
    Set(flag: ProcessorStatusFlag): void {
        this.Flags &= flag;
    }

    /**
     * Clears a processor flag
     * @param flag 
     */
    Clear(flag: ProcessorStatusFlag): void {
        this.Flags &= ~flag;
    }

    /**
     * Sets the value of a processor flag (on/off) based on the truthy of a value
     * @param flag 
     * @param value 
     */
    SetValue(flag: ProcessorStatusFlag, value: boolean) {
        if (value) {
            this.Set(flag);
        } else {
            this.Clear(flag);
        }
    }

    SetZero(value: number): void {
        value == 0 ? this.Set(ProcessorStatusFlag.Zero) : this.Clear(ProcessorStatusFlag.Zero);
    }

    SetNegative(value: number): void {
        value < 0 ? this.Set(ProcessorStatusFlag.Negative) : this.Clear(ProcessorStatusFlag.Negative);
    }

    // Sets the carry flag if the existing number carries into the 8th bit.
    // The input number is ANDed with 0xFF then returned.
    SetCarry(value: number): number {
        this.Clear(ProcessorStatusFlag.Carry);
        if ((value >> 8) > 0) {
            this.Set(ProcessorStatusFlag.Carry);
        }
        return value & 0xFF;
    }

    get value(): number {
        return this.Flags;
    }

    set value(value: number) {
        this.Flags = value;
    }
}