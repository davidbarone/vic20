import { ProcessorStatusFlag } from "./processor_status_flag";

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
    public Flags: number;

    constructor(flags: number) {
        this.Flags = flags;
    }

    public toString() {

        return `${this.isSetN() ? 'N' : '.'}${this.isSetV() ? 'V' : '.'}-${this.isSetB() ? 'B' : '.'}${this.isSetD() ? 'D' : '.'}${this.isSetI() ? 'I' : '.'}${this.isSetZ() ? 'Z' : '.'}${this.isSetC() ? 'C' : '.'}`;
    }

    public isSetC(): boolean { get: { return (this.Flags & ProcessorStatusFlag.Carry) ? true : false } }
    public isSetZ(): boolean { get: { return (this.Flags & ProcessorStatusFlag.Zero) ? true : false } }
    public isSetI(): boolean { get: { return (this.Flags & ProcessorStatusFlag.Interrupt) ? true : false } }
    public isSetD(): boolean { get: { return (this.Flags & ProcessorStatusFlag.Decimal) ? true : false } }
    public isSetB(): boolean { get: { return (this.Flags & ProcessorStatusFlag.Break) ? true : false } }
    public isSetV(): boolean { get: { return (this.Flags & ProcessorStatusFlag.Overflow) ? true : false } }
    public isSetN(): boolean { get: { return (this.Flags & ProcessorStatusFlag.Negative) ? true : false } }

    public setC() { this.Flags |= ProcessorStatusFlag.Carry }
    public setZ() { this.Flags |= ProcessorStatusFlag.Zero }
    public setI() { this.Flags |= ProcessorStatusFlag.Interrupt }
    public setD() { this.Flags |= ProcessorStatusFlag.Decimal }
    public setB() { this.Flags |= ProcessorStatusFlag.Break }
    public setV() { this.Flags |= ProcessorStatusFlag.Overflow }
    public setN() { this.Flags |= ProcessorStatusFlag.Negative }

    public clearC() { this.Flags &= ~ProcessorStatusFlag.Carry }
    public clearZ() { this.Flags &= ~ProcessorStatusFlag.Zero }
    public clearI() { this.Flags &= ~ProcessorStatusFlag.Interrupt }
    public clearD() { this.Flags &= ~ProcessorStatusFlag.Decimal }
    public clearB() { this.Flags &= ~ProcessorStatusFlag.Break }
    public clearV() { this.Flags &= ~ProcessorStatusFlag.Overflow }
    public clearN() { this.Flags &= ~ProcessorStatusFlag.Negative }
}