/**
 * Joystick event. The values match the bits to set on Ports A or B on via 1 or via2
 */
export enum JoystickState {
    None = 0,
    Up = 1 << 2,        // Via 1, reg[15]
    Down = 1 << 3,      // Via 1, reg[15]
    Left = 1 << 4,      // Via 1, reg[15]
    Right = 1 << 7,     // Via 2, reg[0]
    Fire = 1 << 5       // Via 1, reg[15]
}