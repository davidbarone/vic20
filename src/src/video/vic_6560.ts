import Memory from "../memory/memory";
import { VicControlRegisters } from "./vic_control_registers"
import Utils from "../lib/utils"
import { VideoRegion } from "./video_region";

export class Vic6560 {

    // Base address
    private base: number = 0;
    private videoRegion: VideoRegion;

    Memory: Memory;
    canvas: HTMLCanvasElement;          // the displayed canvas
    internalCanvas: HTMLCanvasElement;  // fixed to 6560 dimensions
    context: CanvasRenderingContext2D | null;
    internalContext: CanvasRenderingContext2D | null;
    vicControlRegisters: VicControlRegisters;

    CyclesPerLine: number = 0;
    HorizontalBlankCycles: number = 0;

    /**
     * BlankLeftCycles is a 'fudge factor'. Assumption that the left offset includes blank cycles
     * in order for 64 displayed cycles to occur per line for PAL. Have not found doco to support
     * this yet. Based on https://github.com/matsondawson/vic20dart.
     */
    BlankLeftCycles: number = 0;
    LinesPerFrame: number = 0;
    VerticalBlankRows: number = 0;
    ScreenWidth: number = 0;
    ScreenHeight: number = 0;

    _cycle: number = 0;
    _rowCycle: number = 0;
    _line: number = 0;
    _rasterLine: number = 0;

    _canvasWidth: number = 0;
    _canvasHeight: number = 0;
    _data32: Uint32Array = new Uint32Array([]);
    _rowPixel: number = 0;
    _imageData: any;
    _buf8: Uint8ClampedArray = new Uint8ClampedArray();

    /**
     * Color pallette
     *  * Colour codes:
     *  * 0 black
     *  * 1 white
     *  * 2 red
     *  * 3 cyan
     *  * 4 purple
     *  * 5 green
     *  * 6 blue
     *  * 7 yellow
     *  * 8 orange
     *  * 9 light orange
     *  * a pink
     *  * b light cyan
     *  * c light purple
     *  * d light green
     *  * e light blue
     *  * f light yellow
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

    constructor(videoRegion: VideoRegion, memory: Memory, canvas: HTMLCanvasElement, offset: number) {

        this.base = offset;
        this.vicControlRegisters = new VicControlRegisters(videoRegion);
        this.Memory = memory;
        this.videoRegion = videoRegion;

        let that = this;

        for (let i = 0; i < this.vicControlRegisters.ControlRegisters.length; i++) {
            that.Memory.readFunc[that.base + i] = (offset: number) => that.vicControlRegisters.read(offset - that.base);
            that.Memory.writeFunc[that.base + i] = (offset: number, value: number) => { that.vicControlRegisters.write(offset - that.base, value); }
        }

        if (videoRegion === VideoRegion.pal) {
            this.CyclesPerLine = 71;
            this.HorizontalBlankCycles = 15
            this.BlankLeftCycles = 8;
            this.LinesPerFrame = 312;
            this.VerticalBlankRows = 27;
            //this.ScreenWidth = 233;
            //this.ScreenHeight = 284;
        } else {
            this.CyclesPerLine = 65;
            this.HorizontalBlankCycles = 15;
            this.BlankLeftCycles = 2;
            this.LinesPerFrame = 261;
            this.VerticalBlankRows = 7;
            //this.ScreenWidth = 233;
            //this.ScreenHeight = 284;
        }

        // Reset screenwidth based on raster cycles / lines

        this.ScreenWidth = (this.CyclesPerLine - this.HorizontalBlankCycles) * 4;   // Each horizontal cycle = 4 pixels
        this.ScreenHeight = (this.LinesPerFrame - this.VerticalBlankRows);

        this.canvas = canvas;
        this.internalCanvas = document.createElement('canvas');;
        this.internalCanvas.width = this.ScreenWidth;
        this.internalCanvas.height = this.ScreenHeight;

        this.context = this.canvas.getContext("2d");
        this.internalContext = this.internalCanvas.getContext("2d");

        // physical size of canvas
        this._canvasWidth = this.canvas.width;
        this._canvasHeight = this.canvas.height;

        // Create logical scale to canvas, so all coordinates based on 6560 screen width+height
        this.context?.setTransform(1, 0, 0, 1, 0, 0);   // set back to default / identity matrix
        this.context?.scale(this._canvasWidth / this.ScreenWidth, this._canvasHeight / this.ScreenHeight);

        if (this.internalContext != null) {
            this._imageData = this.internalContext.getImageData(0, 0, this.ScreenWidth, this.ScreenHeight);
            let data = this._imageData.data;
            var buf = new ArrayBuffer(this._imageData.data.length);
            this._buf8 = new Uint8ClampedArray(buf);
            this._data32 = new Uint32Array(buf);
        }
    }

    // Used to calculate speed of emulator
    public get cyclesPerFrame() {
        return this.LinesPerFrame * this.CyclesPerLine;
    }

    /**
     * Returns the bus frequency
     */
    public get busFrequency() {
        if (this.videoRegion === VideoRegion.pal) {
            return 1108404;
        } else {
            return 1022727;
        }
    }

    public getDebug(): string {
        return `Screen Origin (X,Y):        ${this.vicControlRegisters.ScreenOriginX}, ${this.vicControlRegisters.ScreenOriginY}
Video Columns, Rows:        ${this.vicControlRegisters.NumberOfVideoColumns}, ${this.vicControlRegisters.NumberOfVideoRows}
Character Size:             ${this.vicControlRegisters.DoubleCharacterSize ? "16" : "8"}
Current Raster Line:        ${this._rasterLine + this.VerticalBlankRows}
Screen Memory Location:     ${this.vicControlRegisters.MapMemory(this.vicControlRegisters.ScreenMemoryLocation)}
Character Memory Location:  ${this.vicControlRegisters.MapMemory(this.vicControlRegisters.CharacterMemoryLocation)}
Color Base:                 ${this.vicControlRegisters.MapMemory(this.vicControlRegisters.ColorBase)}
Light Pen (X,Y):            ${this.vicControlRegisters.LightPenX}, ${this.vicControlRegisters.LightPenY}
Paddle (X,Y):               ${this.vicControlRegisters.PaddleX}, ${this.vicControlRegisters.PaddleY}
Sounds Channels:            Base(${this.vicControlRegisters.BaseSwitch}),Alto(${this.vicControlRegisters.AltoSwitch}),Soprano(${this.vicControlRegisters.SopranoSwitch}),Noise(${this.vicControlRegisters.NoiseSwitch})
Sound Frequencies:          Base(${this.vicControlRegisters.BaseFrequency}),Alto(${this.vicControlRegisters.AltoFrequency}),Soprano(${this.vicControlRegisters.SopranoFrequency}),Noise(${this.vicControlRegisters.NoiseFrequency})
Volume:                     ${this.vicControlRegisters.VolumeControl}
Colors:                     Auxilliary(${this.vicControlRegisters.AuxilliaryColour}),Screen(${this.vicControlRegisters.ScreenColour}),Border(${this.vicControlRegisters.BorderColour})
Reverse Color Mode:         ${this.vicControlRegisters.ReverseMode}
Interlaced Mode:            ${this.vicControlRegisters.InterlacedMode}`
    }

    /**
     * Returns the correct color when in multicolor mode
     * @param multicolorMode 
     * @param backgroundColor 
     * @param borderColor 
     * @param foregroundColor 
     * @param auxilliaryColor 
     */
    private getMulticolor(multicolorMode: number, backgroundColor: number, borderColor: number, foregroundColor: number, auxilliaryColor: number): number {
        switch (multicolorMode) {
            case 0B00:
                return backgroundColor;
                break;
            case 0B01:
                return borderColor;
                break;
            case 0B10:
                return foregroundColor;
                break;
            case 0B11:
                return auxilliaryColor;
                break;
            default:
                throw `Invalid multicolor color ${multicolorMode}`;
        }
    }

    /**
     * Single cycle of Vic6560
     */
    Cycle() {

        this._rowCycle = this._cycle % this.CyclesPerLine;
        this._line = ~~(this._cycle / this.CyclesPerLine);  // double NOT is fastest way to floor.
        this._rasterLine = this._line - this.VerticalBlankRows

        // Update raster line number (reg3 + reg4)
        this.vicControlRegisters.write(4, (this._rasterLine + this.VerticalBlankRows) >> 1);
        this.vicControlRegisters.write(3, (this.vicControlRegisters.read(3) & 0x7f) | (((this._rasterLine + this.VerticalBlankRows) & 1) << 7));

        // Each cycle writes 4 pixels
        if (this.isRowBlanking() || this.isLineBlanking()) {
            // do nothing
        } else {
            if (this.isTextArea()) {
                let col: number = this.getColumn();
                let row: number = this.getRow();
                let evenCycle: boolean = (this._rowCycle - this.vicControlRegisters.ScreenOriginX) % 2 == 0;

                let charIndex = (row * this.vicControlRegisters.NumberOfVideoColumns) + col;

                let charPointerOffset: number = this.vicControlRegisters.MapMemory((this.vicControlRegisters.ScreenMemoryLocation + charIndex));
                let characterPointer = this.Memory.readByte(charPointerOffset);

                let colorPointer: number = charIndex;// >> 1;
                characterPointer <<= 3;

                if (this.vicControlRegisters.DoubleCharacterSize) {
                    characterPointer <<= 1;
                }

                characterPointer += this.vicControlRegisters.CharacterMemoryLocation;
                colorPointer += this.vicControlRegisters.ColorBase;

                // color pointer points to a nibble MSB denotes hires/color

                // character cell block is 8 bytes long (8x8 matrix). Get the correct nibble
                let characterSize = this.vicControlRegisters.DoubleCharacterSize ? 16 : 8;
                characterPointer += (((this._rasterLine - ((this.vicControlRegisters.ScreenOriginY * 2) - this.VerticalBlankRows)) % characterSize));

                // wrap for 14 bit addressing, and map to real memory
                characterPointer = this.vicControlRegisters.MapMemory(characterPointer);
                colorPointer = this.vicControlRegisters.MapMemory(colorPointer);
                let charData: number = this.Memory.readByte(characterPointer); // reads 8 bits for the current raster line
                let colorData: number = this.Memory.readByte(colorPointer);

                // color data is actually 4 bit nybble
                colorData = Utils.ExtractBits(colorData, 0, 3);

                // MSB defines color mode
                let colorMode: boolean = (colorData & 0x8) > 0;
                let forecolor = Utils.ExtractBits(colorData, 0, 2);
                let backcolor: number = this.vicControlRegisters.ScreenColour;
                if (colorMode) {
                    // Color mode
                    let auxColor = this.vicControlRegisters.AuxilliaryColour;
                    if (evenCycle) {
                        let color1 = this.getMulticolor(Utils.ExtractBits(charData, 6, 7), backcolor, this.vicControlRegisters.BorderColour, forecolor, auxColor);
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[color1];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[color1];
                        let color2 = this.getMulticolor(Utils.ExtractBits(charData, 4, 5), backcolor, this.vicControlRegisters.BorderColour, forecolor, auxColor);
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[color2];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[color2];
                    } else {
                        let color3 = this.getMulticolor(Utils.ExtractBits(charData, 2, 3), backcolor, this.vicControlRegisters.BorderColour, forecolor, auxColor);
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[color3];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[color3];
                        let color4 = this.getMulticolor(Utils.ExtractBits(charData, 0, 1), backcolor, this.vicControlRegisters.BorderColour, forecolor, auxColor);
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[color4];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[color4];
                    }
                }
                else {
                    // Hires mode
                    if (this.vicControlRegisters.ReverseMode) {
                        forecolor = colorData;
                    }
                    if (evenCycle) {
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x80) ? this.Colors[forecolor] : this.Colors[backcolor];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x40) ? this.Colors[forecolor] : this.Colors[backcolor];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x20) ? this.Colors[forecolor] : this.Colors[backcolor];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x10) ? this.Colors[forecolor] : this.Colors[backcolor];
                    } else {
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x08) ? this.Colors[forecolor] : this.Colors[backcolor];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x04) ? this.Colors[forecolor] : this.Colors[backcolor];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x02) ? this.Colors[forecolor] : this.Colors[backcolor];
                        this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x01) ? this.Colors[forecolor] : this.Colors[backcolor];
                    }
                }
            } else {
                // draw border;
                this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[this.vicControlRegisters.BorderColour];
                this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[this.vicControlRegisters.BorderColour];
                this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[this.vicControlRegisters.BorderColour];
                this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = this.Colors[this.vicControlRegisters.BorderColour];
            }
        }

        this._cycle++;
        if (this._cycle % this.CyclesPerLine == 0) {
            this._line++;
            this._rowPixel = 0;
        }
        if (this._cycle == (this.CyclesPerLine * this.LinesPerFrame)) {
            this.drawFrame();
        }
    }

    drawFrame(): void {
        if (this.internalContext) {
            this._imageData.data.set(this._buf8);
            this.internalContext.putImageData(this._imageData, 0, 0);

            if (this.context) {
                this.context.drawImage(this.internalCanvas, 0, 0);
            }
        }

        this._cycle = 0;
        this._rowPixel = 0;
    }

    isRowBlanking(): boolean {
        return !(this._cycle > this.BlankLeftCycles && this._rowCycle < this.CyclesPerLine - this.HorizontalBlankCycles);
    }

    isLineBlanking(): boolean {
        return this._rasterLine < 0;
    }

    /**
     * Gets the column within normal display (0-21). Positive decimals round down. Negative decimals round up.
     * ScreenOriginX units is 1 cycle (4 pixels)
     * @returns 
     */
    getColumn(): number {
        return ~~((100 + this._rowCycle - this.vicControlRegisters.ScreenOriginX + this.BlankLeftCycles) / 2) - 50;
    }

    /**
     * Gets the row within normal display (0-22). Positive decimals round down. Negative decimals round up.
     * Screen origin Y units is 2 lines
     * Screen origin Y includes vertical blank rows
     * Values >= 0 round down (i.e. row of 10.9 rounds to 10)
     * Values < 0 round down (absolute up), i.e. -2.1 rounds to -3)
     * round constant used to round correctly.
     * 1 row is 8 scan lines unless double character height set, then 16 scan lines.
     */
    getRow(): number {
        const round = 800;
        let characterSize = 8;
        if (this.vicControlRegisters.DoubleCharacterSize) {
            characterSize = 16;
        }
        return ~~((round + this._rasterLine - ((this.vicControlRegisters.ScreenOriginY * 2) - this.VerticalBlankRows)) / characterSize) - (round / characterSize);
    }

    isTextArea(): boolean {
        let col = this.getColumn();
        let row = this.getRow();
        return col >= 0 && col < this.vicControlRegisters.NumberOfVideoColumns && row >= 0 && row < this.vicControlRegisters.NumberOfVideoRows;
        /*
        return (this._line >= (this.vicControlRegisters.ScreenOriginY * 2) &&
            this._line < ((this.vicControlRegisters.ScreenOriginY * 2) + (this.vicControlRegisters.NumberOfVideoRows * 8))) &&
            (this._rowCycle >= (this.vicControlRegisters.ScreenOriginX) &&
                this._rowCycle < ((this.vicControlRegisters.ScreenOriginX) + (this.vicControlRegisters.NumberOfVideoColumns * 2)));
    */
    }

    UpdateVolumes() {

    }

}