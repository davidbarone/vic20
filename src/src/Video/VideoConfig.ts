export class VideoConfig {
    VideoMatrixColumns: number = 0;
    VideoMatrixRows: number = 0;

    /**
     * Color pallette
     */
    Colors: Array<number> = [
        0xff000000, // black
        0xffffffff, // white
        0xff001089, // red
        0xffcfbf46, // cyan
        0xffc61486, // purple
        0xff05b745, // green
        0xffd01327, // blue
        0xff15d2be, // yellow
        0xff00469a, // orange
        0xff0099ff, // light orange
        0xffcbc0ff, // light red
        0xf0fffffe, // light cyan
        0xffd87093, // light purple
        0xff90ee90, // light green
        0xffe6d8ad, // light blue
        0xffe0ffff, // light yellow
    ];


    Base: number = 0;
    ColBase: number = 0;
    CharRom: number = 0;
    CharHeightShift: number = 0;
    MaxValue0: number = 0;
    MaxValue1: number = 0;
    MaxValue2: number = 0;
    MaxValue3: number = 0;
    Volume: number = 0;
    SoundStateOff: number = 0;

    /**
     * Used for multicolor mode:
     * 
     * 00 - background colour (CRF)
     * 01 - exterior border color (CRF)
     * 10 - foreground color (color RAM)
     * 11 - auxilliary color (CRE)
     */
    MultiColor: Array<number> = new Array(4);
    BorderColor: number = 0;
    BackColor: number = 0;
}