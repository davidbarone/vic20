import Base64 from "./base_64"
// --------------------------------
// Utils
//
// Collection of useful utility
// functions.
// --------------------------------
class Utils {

    static LUT_HEX_4b: Array<string> = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
    static LUT_HEX_8b = new Array(0x100);

    /**
     * 
     * @param value 
     */
    static ExtractBits(value: number, bitStart: number, bitEnd: number): number {
        return (value >> bitStart) & (Math.pow(2, bitEnd - bitStart + 1) - 1);
    }

    static ShiftLeft(value: number, number: number): number {
        return value << number;
    }

    static ShiftRight(value: number, number: number): number {
        return value >> number;
    }

    /**
     * Gets the high byte (msb) of a 16-bit number
     * @param value input word
     * @returns high byte
     */
    static msb(value: number): number {
        return Utils.ShiftRight((value & 0xFFFF), 8);
    }

    /**
     * Gets the low byte (lsb) of a 16-bit number
     * @param value input word
     * @returns low byte
     */
    static lsb(value: number): number {
        return value & 0xFF;
    }

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
    public static NumberToHex(value: number, formatAsWord: boolean = false): string {
        let hex: string = "";
        while (true) {
            hex = Utils.LUT_HEX_8b[value & 0xff] + hex;
            value = value >> 8;
            if (value === 0) {
                break;
            }
        }
        if (formatAsWord) {
            hex = "00" + hex;
            hex = hex.substr(hex.length - 4, 4);
        }
        return hex;
    }

    // ------------------------------
    // UInt8ArrayToHex()
    //
    // Converts a UInt8Array to hex
    // string
    public static UInt8ArrayToHex(buffer: Uint8Array, padding: string = ' ') {
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
    public static NumberToUInt8Array(value: number): Uint8Array {
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

    /**
     * Returns a base64 encoding of a UInt8Array, where data is plain ASCII (not multibyte unicode/UTF).
     * @param data 
     * @returns 
     */
    public static UInt8ArrayToBase64(data: Uint8Array): string {
        return Base64.encode(data);

        /*
        let raw = Array.from(data);
        //var decoder = new TextDecoder("windows-1252");
        //var b64encoded = btoa(decoder.decode(raw));
        var b64encoded = btoa(String.fromCharCode.apply(null, raw));
        return b64encoded
        */
    }

    /**
     * Returns a UInt8Array from a base64 encoding, where the resulting data is plain ASCII (not multibyte unicode/UTF).
     * @param str 
     * @returns 
     */
    public static UInt8ArrayFromBase64(base64: string): Uint8Array {
        return Base64.decode(base64);

        /*
        var data = new Uint8Array(atob(base64).split("").map(function (c) {
            return c.charCodeAt(0);
        }));
        return data;
        */
    }

    /**
     * Takes a byte, and returns a 2's complement (signed) result.
     * @param unsignedByte 
     */
    public static signedByte(unsignedByte: number) {
        if (unsignedByte < 0x80) {
            return unsignedByte;
        } else {
            return unsignedByte - 0x100;
        }
    }

    /**
    * Takes a byte, and returns a 2's complement (signed) result.
     * @param unsignedword 
     * @returns 
     */
    public static signedWord(unsignedword: number) {
        if (unsignedword < 0x8000) {
            return unsignedword;
        } else {
            return unsignedword - 0x10000;
        }
    }

    public static byteToBinaryString(byte: number): string {
        let str = ("00000000" + byte.toString(2));
        let len = str.length;
        return str.substr(len - 8, 8);
    }
}

// Typescript does not support static constructors. This is workaround.
Utils.Initialize();

export default Utils;