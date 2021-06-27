import { ControlRegisterEnum } from "./ControlRegisterEnum"
import { VicControlRegisters } from "./VicControlRegisters"

export class Vic6560 {


    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D | null;
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
    _dataPtr: number = 0;
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
        this.context = this.canvas.getContext("2d");
        this._canvasWidth = this.canvas.width;
        this._canvasHeight = this.canvas.height;
        alert(this._canvasHeight);
        alert(this._canvasWidth);

        if (this.context != null) {
            this._imageData = this.context.getImageData(0, 0, this._canvasWidth, this._canvasHeight);
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
        for (let i = 0; i < 4; i++) {
            if (this.isRowBlanking() || this.isLineBlanking()) {
                // do nothing
            } else if (this.isTextArea()) {
                this._data32[this._dataPtr++] = this.Colors[1];
            } else {
                this._data32[this._dataPtr++] = this.Colors[this.vicControlRegisters.BorderColour];
            }
        }

        this._cycle++;
        if (this._cycle % this.CyclesPerLine == 0) {
            this._line++;
        }
        if (this._cycle == (this.CyclesPerLine * this.LinesPerFrame)) {
            this.drawFrame();
        }

    }

    drawFrame(): void {
        if (this.context) {
            this._imageData.data.set(this._buf8);
            this.context.putImageData(this._imageData, 0, 0);
        }

        this._cycle = 0;
        this._dataPtr = 0;
    }

    isRowBlanking(): boolean {
        return this._rowCycle >= ~~(this.ScreenWidth / 4);
    }

    isLineBlanking(): boolean {
        return this._line >= (this.ScreenHeight);
    }

    isTextArea(): boolean {
        return (this._line > (this.vicControlRegisters.ScreenOriginY * 2) &&
            this._line <= ((this.vicControlRegisters.ScreenOriginY * 2) + (this.vicControlRegisters.NumberOfVideoRows * 8))) &&
            (this._rowCycle > (this.vicControlRegisters.ScreenOriginX) &&
                this._rowCycle <= ((this.vicControlRegisters.ScreenOriginX) + (this.vicControlRegisters.NumberOfVideoColumns * 2)));
    }

    UpdateVolumes() {

    }

}