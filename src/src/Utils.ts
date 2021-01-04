class Utils {

    static LUT_HEX_4b: Array<string> = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
    static LUT_HEX_8b = new Array(0x100);

    // -----------------------------
    // Initialize stuff
    // -----------------------------
    static Initialize() {
        // Initialise Lookup table
        for (let n = 0; n < 0x100; n++) {
            Utils.LUT_HEX_8b[n] = `${Utils.LUT_HEX_4b[(n >>> 4) & 0xF]}${Utils.LUT_HEX_4b[n & 0xF]}`;
        }
    }

    // --------------------------
    // HexToNumber()
    //
    // Converts a hex string to a
    // number
    // --------------------------
    public static HexToNumber(hex: string): number {
        return parseInt(hex, 16);
    }

    // ---------------------------
    // NumberToHex()
    //
    // Converts a number to a hex
    // string. Number can be byte
    // or word.
    // ---------------------------
    public static NumberToHex(value: number): string {
        let hex: string;
        while (true) {
            hex = Utils.LUT_HEX_8b[value & 0xff];
            value = value >> 8;
            if (value === 0) {
                break;
            }
        }
        return hex;
    }

    // ------------------------------
    // UInt8ArrayToHex()
    //
    // Converts a UInt8Array to hex
    // string
    public UInt8ArrayToHex(buffer: Uint8Array, padding: string = ' ') {
        let out = '';
        for (let idx = 0, edx = buffer.length; idx < edx; idx++) {
            out += Utils.NumberToHex(buffer[idx]) + padding;
        }
        return out.trimEnd();
    }
    
    // ----------------------------------------
    // NumberToArray()
    //
    // Converts a number (e.g. 16-bit address)
    // into corresponding bytes
    // ----------------------------------------
    public NumberToUInt8Array(value: number): Uint8Array {
        let bytes: Array<number> = new Array();

        while (true) {
            let byte = value & 0xff;
            bytes.push(byte);
            if (byte === 0) {
                break;
            }
            value = value >> 8;
        }
        return new Uint8Array(bytes);
    }

}

// Typescript does not support static constructors. This is workaround.
Utils.Initialize();

export default Utils;