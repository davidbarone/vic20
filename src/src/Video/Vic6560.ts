import { ControlRegisterEnum } from "./ControlRegisterEnum"
import { VicControlRegisters } from "./VicControlRegisters"

export class Vic6560 {


    canvas: HTMLCanvasElement;          // the displayed canvas
    internalCanvas: HTMLCanvasElement;  // fixed to 6560 dimensions
    context: CanvasRenderingContext2D | null;
    internalContext: CanvasRenderingContext2D | null;
    vicControlRegisters: VicControlRegisters = new VicControlRegisters();

    CyclesPerLine: number = 71;
    LinesPerFrame: number = 312;
    ScreenWidth: number = 233;
    ScreenHeight: number = 284;

    _cycle: number = 0;
    _rowCycle: number = 0;
    _line: number = 0;

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

    constructor(canvas: HTMLCanvasElement) {

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

        // Each cycle writes 4 pixels
        if (this.isRowBlanking() || this.isLineBlanking()) {
            // do nothing
        } else {
            for (let i = 0; i < 4; i++) {
                if (this.isTextArea()) {
                    this._data32[(this._line * this.ScreenWidth) + this._rowPixel++] = this.Colors[1];
                } else {
                    this._data32[(this._line * this.ScreenWidth) + this._rowPixel++] = this.Colors[this.vicControlRegisters.BorderColour];
                }
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
        return this._rowCycle > ~~(this.ScreenWidth / 4);
    }

    isLineBlanking(): boolean {
        return this._line > (this.ScreenHeight);
    }

    isTextArea(): boolean {
        return (this._line >= (this.vicControlRegisters.ScreenOriginY * 2) &&
            this._line < ((this.vicControlRegisters.ScreenOriginY * 2) + (this.vicControlRegisters.NumberOfVideoRows * 8))) &&
            (this._rowCycle >= (this.vicControlRegisters.ScreenOriginX) &&
                this._rowCycle < ((this.vicControlRegisters.ScreenOriginX) + (this.vicControlRegisters.NumberOfVideoColumns * 2)));
    }

    UpdateVolumes() {

    }

}