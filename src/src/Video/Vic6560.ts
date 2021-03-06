import Memory from "../Memory/Memory";
import { ControlRegisterEnum } from "./ControlRegisterEnum"
import { VicControlRegisters } from "./VicControlRegisters"
import Utils from "../Utils"

export class Vic6560 {

    Memory: Memory;
    canvas: HTMLCanvasElement;          // the displayed canvas
    internalCanvas: HTMLCanvasElement;  // fixed to 6560 dimensions
    context: CanvasRenderingContext2D | null;
    internalContext: CanvasRenderingContext2D | null;
    vicControlRegisters: VicControlRegisters = new VicControlRegisters();

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

    constructor(isPal: boolean, memory: Memory, canvas: HTMLCanvasElement) {

        if (isPal) {
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

        this.Memory = memory;

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
        this.context?.scale(this._canvasWidth / this.ScreenWidth, this._canvasHeight / this.ScreenHeight);

        if (this.internalContext != null) {
            this._imageData = this.internalContext.getImageData(0, 0, this.ScreenWidth, this.ScreenHeight);
            let data = this._imageData.data;
            var buf = new ArrayBuffer(this._imageData.data.length);
            this._buf8 = new Uint8ClampedArray(buf);
            this._data32 = new Uint32Array(buf);
        }
    }

    /**
     * Single cycle of Vic6560
     */
    Cycle() {

        this._rowCycle = this._cycle % this.CyclesPerLine;
        this._line = ~~(this._cycle / this.CyclesPerLine);  // double NOT fastest way to floor.
        this._rasterLine = this._line - this.VerticalBlankRows

        // Each cycle writes 4 pixels
        if (this.isRowBlanking() || this.isLineBlanking()) {
            // do nothing
        } else {
            if (this.isTextArea()) {
                let col: number = this.getColumn();
                let row: number = this.getRow();
                let evenCycle: boolean = (this._rowCycle - this.vicControlRegisters.ScreenOriginX) % 2 == 0;

                let charIndex = (row * this.vicControlRegisters.NumberOfVideoColumns) + col;
                let characterPointer = this.Memory.ReadByte(this.vicControlRegisters.ScreenMemoryLocation + charIndex);

                let colorPointer: number = characterPointer >> 1;
                characterPointer <<= 3;
                characterPointer += this.vicControlRegisters.CharacterMemoryLocation;
                colorPointer += this.vicControlRegisters.ColorBase;

                // color pointer points to a nibble MSB denotes hires/color

                // character cell block is 8 bytes long (8x8 matrix). Get the correct nibble
                characterPointer += (((this._rasterLine - ((this.vicControlRegisters.ScreenOriginY * 2) - this.VerticalBlankRows)) % 8));
                let charData: number = this.Memory.ReadByte(characterPointer); // reads 8 bits for the current raster line
                let colorData: number = this.Memory.ReadByte(colorPointer);
                colorData = evenCycle ? Utils.ExtractBits(colorData, 4, 7) : Utils.ExtractBits(colorData, 0, 3);
                let forecolor = Utils.ExtractBits(colorData, 0, 2);

                if (evenCycle) {
                    this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x80) ? this.Colors[forecolor] : this.Colors[this.vicControlRegisters.ScreenColour];
                    this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x40) ? this.Colors[forecolor] : this.Colors[this.vicControlRegisters.ScreenColour];
                    this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x20) ? this.Colors[forecolor] : this.Colors[this.vicControlRegisters.ScreenColour];
                    this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x10) ? this.Colors[forecolor] : this.Colors[this.vicControlRegisters.ScreenColour];
                } else {
                    this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x08) ? this.Colors[forecolor] : this.Colors[this.vicControlRegisters.ScreenColour];
                    this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x04) ? this.Colors[forecolor] : this.Colors[this.vicControlRegisters.ScreenColour];
                    this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x02) ? this.Colors[forecolor] : this.Colors[this.vicControlRegisters.ScreenColour];
                    this._data32[(this._rasterLine * this.ScreenWidth) + this._rowPixel++] = (charData & 0x01) ? this.Colors[forecolor] : this.Colors[this.vicControlRegisters.ScreenColour];
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
            throw "werew";
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
     */
    getRow(): number {
        const round = 800;
        return ~~((round + this._rasterLine - ((this.vicControlRegisters.ScreenOriginY * 2) - this.VerticalBlankRows)) / 8) - (round / 8);
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