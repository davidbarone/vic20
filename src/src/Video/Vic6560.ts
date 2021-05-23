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
        if (register != ControlRegisterEnum.CR4_RASTER_VALUE) {
            let preValue = this.controlRegisters[register];
            this.controlRegisters[register] = value;
            switch (register) {
                case ControlRegisterEnum.CR2_NO_OF_VIDEO_MATRIX_COLUMNS:
                    this.config.Base = ((this.controlRegisters[ControlRegisterEnum.CR5_BASE_ADDRESS_CONTROL] >> 4) << 10) | ((value & 0x80) << 2);
                    this.config.ColBase = 0x1400 + ((value & 128) << 2);
                    break;
                case ControlRegisterEnum.CR3_NO_OF_VIDEO_MATRIX_ROWS:
                    this.config.CharHeightShift = 3 + (value & 1);
                    this.controlRegisters[register] = (value & 0x7f) | (preValue & 0x80);
                    break;
                case ControlRegisterEnum.CR5_BASE_ADDRESS_CONTROL:
                    this.config.Base = ((value >> 4) << 10) | ((this.controlRegisters[ControlRegisterEnum.CR2_NO_OF_VIDEO_MATRIX_COLUMNS] & 0x80) << 2);
                    this.config.CharRom = (value & 0xf) << 10;
                    break;
                case ControlRegisterEnum.CRA_F_IN_1:
                    this.config.MaxValue0 = value < 128 ? -1 : (128 - ((value + 1) & 0x7f)) << 3;
                    break;
                case ControlRegisterEnum.CRB_F_IN_2:
                    this.config.MaxValue1 = value < 128 ? -1 : (128 - ((value + 1) & 0x7f)) << 2;
                    break;
                case ControlRegisterEnum.CRC_F_IN_3:
                    this.config.MaxValue2 = value < 128 ? -1 : (128 - ((value + 1) & 0x7f)) << 1;
                    break;
                case ControlRegisterEnum.CRD_F_IN_4:
                    this.config.MaxValue3 = value < 128 ? -1 : 128 - ((value + 1) & 0x7f);
                    break;
                case ControlRegisterEnum.CRE_AMPLITUDE:
                    this.config.Volume = (value & 0xf) / 64;
                    this.UpdateVolumes();
                    this.config.SoundStateOff = this.config.Volume * 0.45;
                    this.config.MultiColor[3] = this.config.Colors[value >> 4];
                    break;
                case 0x0f:
                    this.config.BorderColor = this.config.Colors[value & 7];
                    this.config.BackColor = this.config.Colors[value >> 4];
                    this.config.MultiColor[1] = this.config.BorderColor;
                    this.config.MultiColor[0] = this.config.BackColor;
                    break;
            }
        }
    };

    /**
     * Single cycle of Vic6560
     */
    Cycle() {

    }

    UpdateVolumes() {

    }

}