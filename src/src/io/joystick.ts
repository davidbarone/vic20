import via6522 from "./via_6522"
import { inputListener } from "./input_listener";
import { JoystickState } from "./joystick_state";

export default class joystick {

    private via1: via6522;
    private via2: via6522;
    joystickState: JoystickState = JoystickState.None;

    constructor(via1: via6522, via2: via6522) {

        this.via1 = via1;
        this.via2 = via2;

        this.via1.getPortA = () => {
            // up, down, left, fire
            return ~(this.joystickState & (~JoystickState.Right)) & 0xFF;
        };

        this.via2.getPortB = () => {
            // right
            return ~(this.joystickState & JoystickState.Right) & 0xFF;
        };

        inputListener.joystickHandler = (e) => {
            this.joystickState = e;
        }
    }
}