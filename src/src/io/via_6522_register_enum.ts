/**
 * Via6522 register enum.
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
 *    * Sames as ORA, but with no handshake
 * 
 */

export enum Via6522RegisterEnum {
    /**
     * Output / input register B
     */
    R0_ORB_IRB = 0,

    /**
     * Output / input register A
     */
    R1_ORA_IRA = 1,

    /**
     * Data direction register B
     */
    R2_DDRB = 2,

    /**
     * Data direction register A
     */
    R3_DDRA = 3,

    /**
     * T1 low order latch / counter
     */
    R4_T1C_L = 4,

    /**
     * T1 high order latch / counter
     */
    R5_T1C_H = 5,

    /**
     * T1 low order latches
     */
    R6_T1L_L = 6,

    /**
     * T1 high order latches
     */
    R7_T1L_H = 7,

    /**
     * T2 low order latch / counter
     */
    R8_T2C_L = 8,

    /**
     * T2 high order counter
     */
    R9_T2C_H = 9,

    /**
     * Shift register
     */
    RA_SR = 10,

    /**
     * Auxilliary control register
     */
    RB_ACR = 11,

    /**
     * Peripheral control register
     */
    RC_PCR = 12,

    /**
     * Interrupt flag register
     */
    RD_IFR = 13,

    /**
     * Interrupt enable register
     */
    RE_IER = 14,

    /**
     * Output / input register A
     */
    RF_ORA = 15
}
