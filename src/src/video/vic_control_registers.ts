import { ControlRegisterEnum } from "./control_register_enum"
import Utils from "../lib/utils"
import Memory from "../memory/memory";
import { VideoRegion } from "./video_region";

/**
 * 9000 ABBBBBBB
 * 9001 CCCCCCCC
 * 9002 HDDDDDDD
 * 9003 GEEEEEEF
 * 9004 GGGGGGGG
 * 9005 HHHHIIII
 * 9006 JJJJJJJJ
 * 9007 KKKKKKKK
 * 9008 LLLLLLLL
 * 9009 MMMMMMMM
 * 900A NRRRRRRR
 * 900B OSSSSSSS
 * 900C PTTTTTTT
 * 900D QUUUUUUU
 * 900E WWWWVVVV
 * 900F XXXXYZZZ
 * 
 * A: interlace mode (6560-101 only): 0=off, 1=on
 *    In this mode, the videochip will draw 525 interlaced lines of 65 cycles
 *    per line, instead of the 261 non-interlaced lines in the normal mode.
 *    This bit has no effect on the 6561-101.
 * B: screen origin X (4 pixels granularity)
 *    6560-101: at 22 chars/line, the suitable range is 1 to 8
 *              With 22 chars/line, the value 8 will show only 6 pixels of the
 *              rightmost column
 *    6561-101: at 22 chars/line, the suitable range is 5 to 19
 *              With 22 chars/line, the value 20 will show only 5 pixels of the
 *              rightmost column
 * 
 *    Both:     If the value B+2*D is greater than CYCLES_PER_LINE-4,
 *              the picture will mix up.
 *              With the value 0, there is some disturbance on the screen bottom.
 * C: screen origin Y (2 lines granularity)
 *    6560-101: suitable range is 14 to 130=(261-1)/2,
 *              which will display one raster line of text.
 *    6561-101: suitable range is 14 to 155=312/2-1
 *    Both:     No wraparound
 * D: number of video columns
 *    6560 range: 0-26 makes sense, >31 will be interpreted as 31.
 *    6561-101: 0-29 makes sense, >32 will be interpreted as 32.
 * E: number of video rows (0-63)
 *    6560-101 practical range: 0-29; at C=14, >=30 gives 29 1/8
 *    6561-101 practical range: 0-35; at C=14, >=36 gives 35.
 * F: character size (1=8x16, 0=8x8)
 * G: current raster line ($9004=raster counter b8-b1, $9003 bit 7 = b0)
 *    Vertical blank is on lines 0 through 27.
 * H: screen memory location ($9005:7-4 = b13-b10,
 *                            $9002:7 = b9 of screen and colour memory)
 * I: character memory location (b13-b10)
 * * Note that b13 is connected to the inverse of A15 on the Vic-20.
 * J: light pen X
 * K: light pen Y
 * L: paddle X
 * M: paddle Y
 * N: bass switch,    R: freq f=Phi2/256/(255-$900a)  NTSC: Phi2=14318181/14 Hz
 * O: alto switch,    S: freq f=Phi2/128/(255-$900b)  PAL:  Phi2=4433618/4 Hz
 * P: soprano switch, T: freq f=Phi2/64/(255-$900c)
 * Q: noise switch,   U: freq f=Phi2/32/(255-$900d)
 * W: auxiliary colour
 * V: volume control
 * X: screen colour
 * Y: reverse mode
 * Z: border colour
 * 
 * multicolour (character colour b7=1)
 * 00 = screen colour
 * 01 = character colour
 * 10 = border colour
 * 11 = auxiliary colour
 * 
 */
export class VicControlRegisters {
    ControlRegisters: Array<number> = new Array(16);

    // Register mappings

    InterlacedMode: boolean = false;
    ScreenOriginX: number = 0;
    ScreenOriginY: number = 0;
    NumberOfVideoColumns: number = 0;
    NumberOfVideoRows: number = 0;
    DoubleCharacterSize: number = 0; // if set to 1 then 8x16 characters. If set to 0, then 8x8 characters.
    CurrentRasterLine: number = 0;
    ScreenMemoryLocation: number = 0;
    CharacterMemoryLocation: number = 0;
    LightPenX: number = 0;
    LightPenY: number = 0;
    PaddleX: number = 0;
    PaddleY: number = 0;
    BassSwitch: boolean = false;
    AltoSwitch: boolean = false;
    SopranoSwitch: boolean = false;
    NoiseSwitch: boolean = false;
    BassFrequency: number = 0;
    AltoFrequency: number = 0;
    SopranoFrequency: number = 0;
    NoiseFrequency: number = 0;
    AuxilliaryColour: number = 0;
    VolumeControl: number = 0;
    ScreenColour: number = 0;
    ReverseMode: boolean = false;
    BorderColour: number = 0;

    ColorBase: number = 0;

    /**
     * Returns default control register values for PAL
     * @returns 
     */
    DefaultRegisterValuesPal(videoRegion: VideoRegion) {
        if (videoRegion === VideoRegion.pal)
            return [
                12, 38, 150, 174, 73, 240, 0, 0, 255, 255, 0, 0, 0, 0, 0, 27,
            ]; else
            return [
                5, 25, 150, 174, 27, 240, 87, 234, 0, 0, 0, 0, 0, 0, 0, 27,
            ]
    }

    constructor(videoRegion: VideoRegion = VideoRegion.pal) {
        // Initialise control registers
        for (var i = 0; i < 16; i++) {
            this.write(
                i,
                this.DefaultRegisterValuesPal(videoRegion)[i]
            );
        }
        console.log(this);
    }

    public read(offset: number): number {
        return this.ControlRegisters[offset & 0xf];
    }

    /**
      * Writes to a control register
      * @param regnum 
      * @param value 
      */
    write(register: ControlRegisterEnum, value: number) {
        register &= 0xf;    // set 8 bits
        this.ControlRegisters[register] = value;

        switch (register) {
            case ControlRegisterEnum.CR0_SCREEN_ORIGIN_X_COORDINATE:
                this.InterlacedMode = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR0_SCREEN_ORIGIN_X_COORDINATE], 7, 7) == 1;
                this.ScreenOriginX = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR0_SCREEN_ORIGIN_X_COORDINATE], 0, 6);
                break;
            case ControlRegisterEnum.CR1_SCREEN_ORIGIN_Y_COORDINATE:
                this.ScreenOriginY = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR1_SCREEN_ORIGIN_Y_COORDINATE], 0, 7);
                break;
            case ControlRegisterEnum.CR2_NO_OF_VIDEO_MATRIX_COLUMNS:
                this.NumberOfVideoColumns = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR2_NO_OF_VIDEO_MATRIX_COLUMNS], 0, 6);
                this.ScreenMemoryLocation = Utils.ShiftLeft(
                    Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR5_BASE_ADDRESS_CONTROL], 4, 7),
                    10) | Utils.ShiftLeft(
                        Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR2_NO_OF_VIDEO_MATRIX_COLUMNS], 7, 7),
                        9);
                this.ScreenMemoryLocation = this.ScreenMemoryLocation;
                this.ColorBase = Utils.ShiftLeft(Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR2_NO_OF_VIDEO_MATRIX_COLUMNS], 7, 7), 7);
                this.ColorBase = 0x1400 + ((this.ColorBase & 128) << 2);
                this.ColorBase = this.ColorBase;
                break;
            case ControlRegisterEnum.CR3_NO_OF_VIDEO_MATRIX_ROWS:
                this.NumberOfVideoRows = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR3_NO_OF_VIDEO_MATRIX_ROWS], 1, 6);
                this.DoubleCharacterSize = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR3_NO_OF_VIDEO_MATRIX_ROWS], 0, 0);
                this.CurrentRasterLine = Utils.ShiftLeft(
                    Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR4_RASTER_VALUE], 0, 7),
                    1) | Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR3_NO_OF_VIDEO_MATRIX_ROWS], 7, 7);
                break;
            case ControlRegisterEnum.CR4_RASTER_VALUE:
                this.CurrentRasterLine = Utils.ShiftLeft(
                    Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR4_RASTER_VALUE], 0, 7),
                    1) | Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR3_NO_OF_VIDEO_MATRIX_ROWS], 7, 7);
                break;
            case ControlRegisterEnum.CR5_BASE_ADDRESS_CONTROL:
                this.ScreenMemoryLocation = Utils.ShiftLeft(
                    Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR5_BASE_ADDRESS_CONTROL], 4, 7),
                    10) | Utils.ShiftLeft(
                        Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR2_NO_OF_VIDEO_MATRIX_COLUMNS], 7, 7),
                        9);
                this.ScreenMemoryLocation = this.ScreenMemoryLocation;
                this.CharacterMemoryLocation = Utils.ShiftLeft(
                    Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR5_BASE_ADDRESS_CONTROL], 0, 3),
                    10
                );
                break;
            case ControlRegisterEnum.CR6_LIGHT_PEN_HORIZONTAL:
                this.LightPenX = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR6_LIGHT_PEN_HORIZONTAL], 0, 7);
                break;
            case ControlRegisterEnum.CR7_LIGHT_PEN_VERTICAL:
                this.LightPenY = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR7_LIGHT_PEN_VERTICAL], 0, 7);
                break;
            case ControlRegisterEnum.CR8_POT_X:
                this.PaddleX = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR8_POT_X], 0, 7);
                break;
            case ControlRegisterEnum.CR9_POT_Y:
                this.PaddleY = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CR9_POT_Y], 0, 7);
            case ControlRegisterEnum.CRA_F_IN_1:
                this.BassSwitch = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRA_F_IN_1], 7, 7) == 1;
                this.BassFrequency = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRA_F_IN_1], 0, 6);
                break;
            case ControlRegisterEnum.CRB_F_IN_2:
                this.AltoSwitch = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRB_F_IN_2], 7, 7) == 1;
                this.AltoFrequency = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRB_F_IN_2], 0, 6);
                break;
            case ControlRegisterEnum.CRC_F_IN_3:
                this.SopranoSwitch = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRC_F_IN_3], 7, 7) == 1;
                this.SopranoFrequency = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRC_F_IN_3], 0, 6);
                break;
            case ControlRegisterEnum.CRD_F_IN_4:
                this.NoiseSwitch = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRD_F_IN_4], 7, 7) == 1;
                this.NoiseFrequency = 0;
                break;
            case ControlRegisterEnum.CRE_AMPLITUDE:
                this.AuxilliaryColour = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRE_AMPLITUDE], 4, 7);
                this.VolumeControl = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRE_AMPLITUDE], 0, 3);
                break;
            case ControlRegisterEnum.CRF_COLOR_CONTROL:
                this.ScreenColour = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRF_COLOR_CONTROL], 4, 7);
                this.ReverseMode = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRF_COLOR_CONTROL], 3, 3) == 1;
                this.BorderColour = Utils.ExtractBits(this.ControlRegisters[ControlRegisterEnum.CRF_COLOR_CONTROL], 0, 2);
                break;
        }
    };

    /**
     * Used for multicolor mode:
     * 
     * 00 - background colour (CRF)
     * 01 - exterior border color (CRF)
     * 10 - foreground color (color RAM)
     * 11 - auxilliary color (CRE)
     */
    MultiColor: Array<number> = new Array(4);

    /**
     * Vic6560 has only 14 address lines (16k addressing). Vic6560 uses
     * different addresses to the rest of the computer.
     * Examples below:
     * 
     * Vic chip address     Ordinary Address
     * ----------------     ----------------
     *         0                  32768  Unreversed Character ROM
     *      1024                  33792  Reversed Character ROM
     *      2048                  34816  Unreversed upper/lower case ROM
     *      3072                  35840  Reversed upper/lower case ROM
     *      4096                  36864  VIC and VIA chips
     *      5120                  37888  Colour memory
     *      6144                  38912  Reserved for expansion
     *      7168                  39936  Reserved for expansion
     * 
     *      8192                      0  System memory
     *      9216                   1024  Reserved for expansion
     *     12288                   4096  Program
     *     15360                   7168  Screen 
     * @param vic6560Offset The address as seen by the Vic6560 (14-bit address)
     */
    MapMemory(vic6560Offset: number): number {
        vic6560Offset = vic6560Offset % 0x4FFF; // 14 bits
        return (vic6560Offset & 0x1fff) | (~((vic6560Offset & 0x2000) << 2) & 0x8000);
    }
}