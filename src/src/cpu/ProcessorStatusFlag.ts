export enum ProcessorStatusFlag {
    None = 0,
    Carry = 1 << 0,
    Zero = 1 << 1,
    Interrupt = 1 << 2,
    Decimal = 1 << 3,
    Breakpoint = 1 << 4,
    Overflow = 1 << 6,
    Negative = 1 << 7,
    All = ~(~0 << 8),

}

