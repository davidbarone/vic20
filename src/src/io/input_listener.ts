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

export class inputListener {

    static keyDownHandler?: (e: KeyboardEvent) => void;
    static keyUpHandler?: (e: KeyboardEvent) => void;
    static joystickHandler?: (e: JoystickState) => void;

    // Joystick configuration
    static joystickConfigUp: string = "Numpad8";
    static joystickConfigDown: string = "Numpad2";
    static joystickConfigLeft: string = "Numpad4";
    static joystickConfigRight: string = "Numpad6";
    static joystickConfigFire: string = "Escape";
    static stateUp: boolean = false;
    static stateDown: boolean = false;
    static stateLeft: boolean = false;
    static stateRight: boolean = false;
    static stateFire: boolean = false;

    public static configureJoystickKeys(up: string, down: string, left: string, right: string, fire: string) {
        inputListener.joystickConfigUp = up;
        inputListener.joystickConfigDown = down;
        inputListener.joystickConfigLeft = left;
        inputListener.joystickConfigRight = right;
        inputListener.joystickConfigFire = fire;
    }

    /**
     * IIFE static constructor pattern
     */
    private static _initialize = (() => {
        // "this" cannot be used here

        document.onkeydown = (e: KeyboardEvent) => {
            console.log(e);
            if (inputListener.keyDownHandler) {
                inputListener.keyDownHandler(e);
            }

            if (e.code == inputListener.joystickConfigUp) {
                inputListener.stateUp = true;
            }
            if (e.code == inputListener.joystickConfigDown) {
                inputListener.stateDown = true;
            }
            if (e.code == inputListener.joystickConfigLeft) {
                inputListener.stateLeft = true;
            }
            if (e.code == inputListener.joystickConfigRight) {
                inputListener.stateRight = true;
            }
            if (e.code == inputListener.joystickConfigFire) {
                inputListener.stateFire = true;
            }

            if (inputListener.joystickHandler)
                inputListener.joystickHandler(
                    (inputListener.stateUp ? JoystickState.Up : JoystickState.None) |
                    (inputListener.stateDown ? JoystickState.Down : JoystickState.None) |
                    (inputListener.stateLeft ? JoystickState.Left : JoystickState.None) |
                    (inputListener.stateRight ? JoystickState.Right : JoystickState.None) |
                    (inputListener.stateFire ? JoystickState.Fire : JoystickState.None)
                );

            // Cancel the event
            let el = e.target as Element;
            if (!el.classList.contains("allowKeyboardEvents")) {
                debugger;
                e.preventDefault();
            }
        }

        document.onkeyup = (e: KeyboardEvent) => {
            if (inputListener.keyUpHandler)
                inputListener.keyUpHandler(e);

            if (e.code == inputListener.joystickConfigUp) {
                inputListener.stateUp = false;
            }
            if (e.code == inputListener.joystickConfigDown) {
                inputListener.stateDown = false;
            }
            if (e.code == inputListener.joystickConfigLeft) {
                inputListener.stateLeft = false;
            }
            if (e.code == inputListener.joystickConfigRight) {
                inputListener.stateRight = false;
            }
            if (e.code == inputListener.joystickConfigFire) {
                inputListener.stateFire = false;
            }

            if (inputListener.joystickHandler)
                inputListener.joystickHandler(
                    (inputListener.stateUp ? JoystickState.Up : JoystickState.None) |
                    (inputListener.stateDown ? JoystickState.Down : JoystickState.None) |
                    (inputListener.stateLeft ? JoystickState.Left : JoystickState.None) |
                    (inputListener.stateRight ? JoystickState.Right : JoystickState.None) |
                    (inputListener.stateFire ? JoystickState.Fire : JoystickState.None)
                );


            // Cancel the event
            let el = e.target as Element;
            if (!el.classList.contains("allowKeyboardEvents")) {
                debugger;
                e.preventDefault();
            }
        }
    })();
}