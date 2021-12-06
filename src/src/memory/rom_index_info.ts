import { MemoryModel } from "./memory_model";
import { RomFileType } from "./rom_file_type";

export default interface RomIndexInfo {

    /**
     * User-defined name for the ROM.
     */
    name: string,

    /**
     * Filename of the ROM.
     */
    fileName: string,

    /**
     * The type of the ROM
     */
    fileType: RomFileType,

    /**
     * Memory required
     */
    memory: MemoryModel,

    /**
     * Region
     */
    region: string

    /**
     * Optional publisher name
     */
    publisher?: string

    /**
     * Optional year of release
     */
    year?: number

    /**
     * Data for the ROM
     */
    data: Uint8Array
}
