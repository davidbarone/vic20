import { ControlRegisterEnum } from "./ControlRegisterEnum"
import { VideoConfig } from "./VideoConfig"

export class Vic6560 {

    /**
     * Vic6560 control registers
     * 0: 
     */
    private controlRegisters: Array<number> = new Array(16);
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D | null;
    config: VideoConfig = new VideoConfig(this.controlRegisters);

    CyclesPerLine: number = 65;
    LinesPerFrame: number = 312;
    ScreenWidth: number = 233;
    ScreenHeight: number = 284;

    _canvasWidth: number = 0;
    _canvasHeight: number = 0;
    _data32: Uint32Array = new Uint32Array([]);
    _dataPtr: number = 0;
    _imageData: any;
    _buf8: Uint8ClampedArray = new Uint8ClampedArray();

    /**
     * Returns default control register values for PAL
     * @returns 
     */
    DefaultRegisterValuesPal() {
        return [
            12, 38, 150, 174, 73, 240, 0, 0, 255, 255, 0, 0, 0, 0, 0, 27,
        ];
    }

    constructor(canvas: HTMLCanvasElement) {

        this.canvas = canvas;
        this.context = this.canvas.getContext("2d");
        this._canvasWidth = this.canvas.width;
        this._canvasHeight = this.canvas.height;

        if (this.context != null) {
            this._imageData = this.context.getImageData(0, 0, this._canvasWidth, this._canvasHeight);
            let data = this._imageData.data;
            var buf = new ArrayBuffer(this._imageData.data.length);
            this._buf8 = new Uint8ClampedArray(buf);
            this._data32 = new Uint32Array(buf);
        }



        // Initialise control registers
        for (var i = 0; i < 16; i++) {
            this.Write(
                i,
                this.DefaultRegisterValuesPal()[i]
            );
        }
    }


    /**
     * Writes to a control register
     * @param regnum 
     * @param value 
     */
    Write(register: ControlRegisterEnum, value: number) {
        register &= 0xf;    // set 8 bits
        this.controlRegisters[register] = value;
        alert(value);
    };

    /**
     * Single cycle of Vic6560
     */
    Cycle() {
        alert('cycle');
        console.log(this.config);

        // update canvas
        for (let y = 0; y < 10000; y++)
            this._data32[y] = y * 10000000;

        this._imageData.data.set(this._buf8);

        if (this.context)
            this.context.putImageData(this._imageData, 0, 0);

    }

    UpdateVolumes() {

    }

}