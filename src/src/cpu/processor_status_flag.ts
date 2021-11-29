export enum ProcessorStatusFlag {
    Carry = 1 << 0,
    Zero = 1 << 1,
    Interrupt = 1 << 2,
    Decimal = 1 << 3,

    /**
     * Break flag not considered real CPU status register. Used to distinguish how flags are pushed to stack.
     * Flags are push to stack via:
     * 1. IRQ
     * 2. NMI
     * 3. PHP
     * 4. BRK
     * 
     * Bit 5 is ALWAYS set to 1 when pushed.
     * Bit 4 is set to 1 if pushed from PHP or BRK instruction
     * https://wiki.nesdev.com/w/index.php/Status_flags
     */
    Break = 1 << 4,

    Overflow = 1 << 6,
    Negative = 1 << 7,
}