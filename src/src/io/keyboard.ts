import { inputListener } from "./input_listener";
import via6522 from "./via_6522"

/**
 * VIC20 Keyboard Matrix
 * 
 * Write to Port B($9120)column
 * Read from Port A($9121)row
 * 
 *      7   6   5   4   3   2   1   0
 *     --------------------------------
 *   7| F7  F5  F3  F1  CDN CRT RET DEL    CRT=Cursor-Right, CDN=Cursor-Down
 *    |
 *   6| HOM UA  =   RSH /   ;   *   BP     BP=British Pound, RSH=Should be Right-SHIFT,
 *    |                                    UA=Up Arrow
 *   5| -   @   :   .   ,   L   P   +
 *    |
 *   4| 0   O   K   M   N   J   I   9
 *    |
 *   3| 8   U   H   B   V   G   Y   7
 *    |
 *   2| 6   T   F   C   X   D   R   5
 *    |
 *   1| 4   E   S   Z   LSH A   W   3      LSH=Should be Left-SHIFT
 *    |
 *   0| 2   Q   CBM SPC STP CTL LA  1      LA=Left Arrow, CTL=Should be CTRL, STP=RUN/STOP
 *    |                                    CBM=Commodore key
 * 
 * C64/VIC20 Keyboard Layout
 * 
 *   LA  1  2  3  4  5  6  7  8  9  0  +  -  BP HOM DEL    F1
 *   CTRL Q  W  E  R  T  Y  U  I  O  P  @  *  UA RESTORE   F3
 * STOP SL A  S  D  F  G  H  J  K  L  :  ;  =  RETURN      F5
 * C= SHIFT Z  X  C  V  B  N  M  ,  .  /  SHIFT  CDN CRT   F7
 *          [        SPACE BAR       ]
 * 
 * Keyboard Connector
 * Pin  Desc.
 * 1    Ground
 * 2    [key]
 * 3    RESTORE key
 * 4    +5 volts
 * 5    Column 7, Joy 3
 * 6    Column 6
 * 7    Column 5
 * 8    Column 4
 * 9    Column 3, Tape Write(E5)
 * 10   Column 2
 * 11   Column 1
 * 12   Column 0
 * 13   Row 7
 * 14   Row 6
 * 15   Row 5
 * 16   Row 4
 * 17   Row 3
 * 18   Row 2
 * 19   Row 1
 * 20   Row 0
 * 
 * Example
 * -------
 * Another way to think about this is that each
 * key directly connects pins on port a with
 * pins on port b. There are 8 bits on each
 * port allowing 64 combinations (i.e. 64 keys).
 * 
 * In above example the [SPC] button is:
 * - Row: 0
 * - Column: 4
 * 
 * Port A (Reg 1) reads 254 (all bits high except bit 0)
 * Kernal then checks which column(s) on row 0 have been pressed.
 * It does this by loading the following values successively to
 * Port B (Reg 0):
 * Col0: 11111110 (254)
 * Col1: 11111101 (253)
 * Col2: 11111011 (251)
 * Col3: 11110111 (247)
 * Col4: 11101111 (239)
 * Col5: 11011111 (223)
 * Col6: 10111111 (191)
 * Col7: 01111111 (127)
 * 
 * And then doing a read of port A.
 * In our case, the [SPC] is in column 4, so when Port B is set to 239
 * The subsequent read from port B should return 254 (i.e. row 0). In
 * all other cases, the read from port B should return 255.
 * 
 * A good writeup can be found at: http://www.c64os.com/post/howthekeyboardworks
 *
 * Notes:
 * There are 2 broad approaches to keyboard emulation:
 * a) symbolic mapping - map key on host keyboard (ASCII) to corresponding key on emulated (PET) keyboard. This will be more natural for users used to a modern ASCII keyboard. 
 * b) positional mapping - map key on host keyboard (ASCII) based on position on the keyboard on emulated (PET) keyboard. This will be better for users who are familiar with the VIC20 keyboard layout.
 * 
 * This emulator takes the first approach (symbolic mapping). The VIC20 key presses are mapped to the keys on the ASCII keyboard with the same symbols on them (in most cases).
 * For the few edge cases (e.g. 'British Pound' character), a spare key close by has been chosed to map to.
  */
export default class keyboard {

    /**
     * Maps ASCII keys with shift depressed, to PET keys
     */
    private shiftKeyCodes: { [key: string]: string[] } = {
        'KeyA': ['LSH', 'A'],
        'KeyB': ['LSH', 'B'],
        'KeyC': ['LSH', 'C'],
        'KeyD': ['LSH', 'D'],
        'KeyE': ['LSH', 'E'],
        'KeyF': ['LSH', 'F'],
        'KeyG': ['LSH', 'G'],
        'KeyH': ['LSH', 'H'],
        'KeyI': ['LSH', 'I'],
        'KeyJ': ['LSH', 'J'],
        'KeyK': ['LSH', 'K'],
        'KeyL': ['LSH', 'L'],
        'KeyM': ['LSH', 'M'],
        'KeyN': ['LSH', 'N'],
        'KeyO': ['LSH', 'O'],
        'KeyP': ['LSH', 'P'],
        'KeyQ': ['LSH', 'Q'],
        'KeyR': ['LSH', 'R'],
        'KeyS': ['LSH', 'S'],
        'KeyT': ['LSH', 'T'],
        'KeyU': ['LSH', 'U'],
        'KeyV': ['LSH', 'V'],
        'KeyW': ['LSH', 'W'],
        'KeyX': ['LSH', 'X'],
        'KeyY': ['LSH', 'Y'],
        'KeyZ': ['LSH', 'Z'],
        'Digit1': ['LSH', '1'], // !
        "Digit2": ['LSH', '2'], // @
        'Quote': ['LSH', '2'],  // "
        "Digit3": ['LSH', '3'], // #
        "Digit4": ['LSH', '4'], // $
        "Digit5": ['LSH', '5'], // %
        "Digit6": ['LSH', '6'], // ^
        "Digit7": ['LSH', '7'], // &
        "Digit8": ['LSH', '8'], // (
        "Digit9": ['LSH', '9'], // )
        'Comma': ['LSH', ','],  // <
        'Period': ['LSH', '.'], // .
        "Slash": ['LSH', '/'],  // ?
        "Semicolon": [':'],     // :
        "Equal": ["+"],         // +
        "/@": ["@"],
        "Minus": ["BP"]             // British pound - No exact match on ASCII keyboard. Use spare key nearby
    }

    /**
     * Maps ASCII keys (no shift) to PET keys
     */
    private keyCodes: { [key: string]: string[] } = {
        'Backspace': ['DEL'],
        'Enter': ['RET'],
        'ShiftLeft': ['LSH'],
        'ShiftRight': ['RSH'],
        'Space': ['SPC'],
        'Digit0': ['0'],
        'Digit1': ['1'],
        'Digit2': ['2'],
        'Digit3': ['3'],
        'Digit4': ['4'],
        'Digit5': ['5'],
        'Digit6': ['6'],
        'Digit7': ['7'],
        'Digit8': ['8'],
        'Digit9': ['9'],
        'Numpad0': ['0'],
        'Numpad1': ['1'],
        'Numpad2': ['2'],
        'Numpad3': ['3'],
        'Numpad4': ['4'],
        'Numpad5': ['5'],
        'Numpad6': ['6'],
        'Numpad7': ['7'],
        'Numpad8': ['8'],
        'Numpad9': ['9'],
        'KeyA': ['A'],
        'KeyB': ['B'],
        'KeyC': ['C'],
        'KeyD': ['D'],
        'KeyE': ['E'],
        'KeyF': ['F'],
        'KeyG': ['G'],
        'KeyH': ['H'],
        'KeyI': ['I'],
        'KeyJ': ['J'],
        'KeyK': ['K'],
        'KeyL': ['L'],
        'KeyM': ['M'],
        'KeyN': ['N'],
        'KeyO': ['O'],
        'KeyP': ['P'],
        'KeyQ': ['Q'],
        'KeyR': ['R'],
        'KeyS': ['S'],
        'KeyT': ['T'],
        'KeyU': ['U'],
        'KeyV': ['V'],
        'KeyW': ['W'],
        'KeyX': ['X'],
        'KeyY': ['Y'],
        'KeyZ': ['Z'],
        'NumpadMultiply': ['*'],
        'NumpadAdd': ['+'],
        'NumpadSubtract': ['-'],
        'NumpadDecimal': ['.'],
        'NumpadDivide': ['/'],
        'Equal': ['='],
        'Comma': [','],
        'Period': ['.'],
        'Slash': ['/'],
        "Semicolon": [';'],
        "Quote": ['LSH', '7'],
        "BracketLeft": ["LSH", ":"],
        "BracketRight": ["LSH", ";"],
        "F1": ["F1"],
        "F2": ["LSH", "F1"],
        "F3": ["F3"],
        "F4": ["LSH", "F3"],
        "F5": ["F5"],
        "F6": ["LSH", "F5"],
        "F7": ["F7"],
        "F8": ["LSH", "F7"],
        "ControlLeft": ['CTL'],
        "ControlRight": ['CTL'],
        'Alt': ['CTL'],
        "Home": ['HOM'],
        "ArrowUp": ["LSH", "CDN"],
        "ArrowDown": ["CDN"],
        "ArrowLeft": ["LSH", "CRT"],
        "ArrowRight": ["CRT"],
        'Backslash': ['UA'],                    // Up Arrow - No exact match on ASCII keyboard. Use spare key nearby.
        'Backquote': ['LA']                     // Left arrow - No exact match on ASCII keyboard. Use spare key nearby
    };

    private keyboardMatrix: string[][] = [
        ['F7', 'F5', 'F3', 'F1', 'CDN', 'CRT', 'RET', 'DEL'],
        ['HOM', 'UA', '=', 'RSH', '/', ';', '*', 'BP'],
        ['-', '@', ':', '.', ',', 'L', 'P', '+'],
        ['0', 'O', 'K', 'M', 'N', 'J', 'I', '9'],
        ['8', 'U', 'H', 'B', 'V', 'G', 'Y', '7'],
        ['6', 'T', 'F', 'C', 'X', 'D', 'R', '5'],
        ['4', 'E', 'S', 'Z', 'LSH', 'A', 'W', '3'],
        ['2', 'Q', '', 'SPC', '', 'CTL', 'LA', '1']
    ];

    private via2: via6522;
    private keysDown: string[] = [];

    constructor(via2: via6522) {

        this.via2 = via2;

        this.via2.getPortA = () => {
            let column = this.via2.getReg(0); // ORB contains column selector
            return this.getRowMask(column);
        };

        inputListener.keyDownHandler = (e: KeyboardEvent) => {
            let keys: string[] = this.getKeys(e);
            for (let key of keys) {
                if (this.keysDown.indexOf(key) == -1) {
                    this.keysDown.push(key);
                }
            }
        };

        inputListener.keyUpHandler = (e: KeyboardEvent) => {
            let keys: string[] = this.getKeys(e);
            for (let key of keys) {
                let i = this.keysDown.indexOf(key);
                if (i != -1) {
                    this.keysDown.splice(i, 1);
                }
            }
        };
    }

    /**
     * Returns the PET keyboard keys for given ASCII key event
     * @param key 
     */
    private getKeys(e: KeyboardEvent): string[] {
        if (e.shiftKey && e.code in this.shiftKeyCodes) {
            // Match on shiftKeyCodes. This list includes a PET shift key if necessary
            // so we can remove from keysDown at this point
            let i = this.keysDown.indexOf('LSH');
            if (i === -1) {
                this.keysDown.splice(i, 1);
            }
            return this.shiftKeyCodes[e.code];
        } else if (e.code in this.keyCodes) {
            return this.keyCodes[e.code];
        } else {
            // The key code does not match one we have mapped
            console.log(`Key not recognised in Vic20 keyboard module: ${e.code}`);
            return [];
        }
    }

    /**
     * Returns a byte mask with 0 (pull low) for each row with key pressed.
     * 6502Basic polls keys as follows:
     * Set port B = 0 (all columns selected) -> reads port A to find rows selected
     * Set port B sequentially, setting bits 0 -> 7 to low, and each time reading port A to find rows selected.
     */
    private getRowMask(columnMask: number) {
        let mask = 0;
        let selectedColumns = ~columnMask & 0xFF;   // set 1 to on
        for (let k of this.keysDown) {
            for (let i = 0; i < 8; i++) {
                let row = this.keyboardMatrix[i];
                let j = 7 - row.indexOf(k);
                if (j < 8 && (((1 << j) & selectedColumns))) {
                    mask = (mask | (1 << (7 - i))) & 0xFF;
                }
            }
        }

        return ~mask & 0xFF;
    }
}