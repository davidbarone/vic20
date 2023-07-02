/**
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
 *  Note: the program checks successively bit 6,5,4,3,2,1,0 when an interrupt is raised.
 * 
 */

export enum Via6522InterruptFlagRegisterEnum  {

    /**
     * Port A control line #2
     */
    R0_CA2 = 0,

    /**
     * Port A control line #1
     */
    R1_CA1 = 1,

    /**
     * Shift register
     */
    R2_SR = 2,

    /**
     * Port B control line #2
     */
    R3_CB2 = 3,

    /**
     * Port B control line #1
     */
    R4_CB1 = 4,

    /**
     * Timer #2
     */
    R5_T2 = 5,

    /**
     * Timer #1
     */
    R6_T1 = 6,

    /**
     * Interrupt line (this is set if any interrupt register is set).
     * This bit automatically set if any bit 0-6 is set.
     */
    //R7_IRQ
}