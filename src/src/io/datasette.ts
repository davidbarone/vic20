/**
 * Commodore datasetts (VIC-1530) allowed reading/writing programs from tape.
 * Transfer rates were very slow (60-70 bytes/s). Standard cassette tapes including
 * 90 minute (45 minute each side) were supported. Storage up to 150kb per side
 * 
 * TAP file specification
 * ----------------------
 * A Tap file encodes the series of pulses used to store data on a Commodore data cassette,
 * capturing the cassette contents at a level of abstraction intermediate between the raw waves
 * (as might be captured in an audio file format) and the data bytes that are stored via the
 * cassette pulses (which might be saved into an application-specific file such as a Commodore
 * 64 binary executable or a Commodore BASIC tokenized file).
 * 
 * The file contains a series of bytes giving the length of each pulse (measured as the time
 * interval between two successive negative edges of the square wave), expressed as the number
 * of microseconds multiplied by 0.123156, rounded to an integer value from 0 to 255.
 * 
 * TAP Layout
 * ----------
 * 
 *       00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F        ASCII
 *       -----------------------------------------------   ----------------
 * 0000: 43 36 34 2D 54 41 50 45 2D 52 41 57 00 00 00 00   C64-TAPE-RAW????
 * 0010: 51 21 08 00 2F 0F 0D 31 64 1D 26 0D 07 21 0A 12   Q!??/??1d?&??!??
 * 0020: 4A 2F 2C 34 07 18 0D 31 07 04 23 04 0D 42 0D 1E   J/,4???1??#??B??
 * 0030: 34 04 42 0D 20 15 5E 04 0D 18 61 0D 26 29 34 0D   4?B???^???a?&)4?
 * 0040: 23 0D 07 0A 3F 55 04 0A 13 3F 07 0D 12 2B 18 0A   #????U???????+??
 * 
 * Offset	Description
 * ------   -----------
 * $0000-000B	File signature (C64-TAPE-RAW (v0 and v1) or C16-TAPE-RAW (v2 only))
 * $000C	TAP version (see below for description), $00 - Original layout,
 * $000D	Computer Platform (0 = C64, 1 = VIC-20, 2 = C16, Plus/4, 3 = PET, 4 = C5x0, 5 = C6x0, C7x0)
 * $000E	Video Standard (0 = PAL, 1 = NTSC, 2 = OLD NTSC, 3 = PALN)
 * $000F	reserved for future expansion
 * $0010-0013	File data size (not including this header, in LOW/HIGH format) i.e. The
 * $0014-xxxx	File data
 * 
 * 
 * Links:
 * - https://vice-emu.sourceforge.io/vice_17.html#SEC352
 * - https://groups.google.com/g/comp.emulators.cbm/c/8EzzYqtlKl4
 * - http://fileformats.archiveteam.org/wiki/Tap_file#:~:text=A%20Tap%20file%20encodes%20the%20series%20of%20pulses,binary%20executable%20or%20a%20Commodore%20BASIC%20tokenized%20file%29.
 * - https://web.archive.org/web/20180709173001/http://c64tapes.org/dokuwiki/doku.php?id=analyzing_loaders#tap_format
 * - https://plus4world.powweb.com/plus4encyclopedia/500247
 */

const enum VideoStandard {
    PAL = 0,
    NTSC = 1,
    OLD_NTSC = 2,
    PALN = 3
};

export default class datasette {
    private data: Uint8Array | undefined
    private signature: string = "";
    private version: number = 0x00;
    private platform: number = 0x00;
    private videoStandard: VideoStandard = 0x00;
    private size: number = 0;

    parse() {
        if (this.data) {
            let str = new TextDecoder().decode(this.data);
            console.log(str.substring(0, 12));
            if (str.substring(0, 12) !== "C64-TAPE-RAW") {
                throw new Error("Invalid signature.");
            } else {
                this.signature = "C64-TAPE-RAW";
            }
        
            // version
            this.version = this.data[12];
            if (this.version !== 0x00 && this.version !== 0x01) {
                throw new Error("Only TAP file versions 0 and 1 supported.");
            }

            // platform
            this.version = this.data[13];
            if (this.version !== 0x01) {
                throw new Error("Platform not VIC-20.");
            }

            // video standard
            this.version = this.data[14];

            // data size
            this.size = this.data[16] + (this.data[17] << 8) + (this.data[18] << 16) + (this.data[19] << 24);
            console.log(this.size);
        }
    }

    setData(data: Uint8Array) {
        this.data = data;
        this.parse();
    }
}