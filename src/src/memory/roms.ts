// roms must be manually uploaded by the user
// This class used to simplify the loading process
// All ROMs will be in a single FileList, together with an index.js

import { RomFileType } from "./rom_file_type";
import RomIndexInfo from "./rom_index_info";
import { RomRegion } from "./rom_region";
import jsZip from "jszip";
import RomStruct from "./rom_struct";
import Utils from "../lib/utils";

export default class Roms {

    private _file: File; // the zip file containing all ROMs
    private _roms: RomIndexInfo[] = [];
    private _isValid: boolean = false;

    /**
     * Constructor.
     * @param file 
     */
    public constructor(file: File) {
        this._file = file;
    }

    public isValid(): boolean {
        return this._isValid;
    }

    public roms(): RomIndexInfo[] {
        return this._roms;
    }

    /**
     * Gets a single rom info by name
     * @param name 
     */
    public rom(name: string): RomIndexInfo | undefined {
        return this._roms.find(r => r.name.toLowerCase() === name.toLowerCase());
    }

    /**
     * Gets the roms that are cartridge types.
     * @returns An array of RomIndexInfo
     */
    public cartridges(): RomIndexInfo[] {
        return this._roms.filter(r => r.fileType === RomFileType.cartridge);
    }

    public unpack(rom: RomIndexInfo): Array<RomStruct> {
        let results: Array<RomStruct> = [];
        for (let i: number = 0; i < rom.fileNames.length; i++) {
            let part = rom.data[i];
            let loadAddress = part[0] + (part[1] << 8);
            console.log(`Unpacking rom: ${rom.name} part #${i}. Load address: 0x${Utils.NumberToHex(loadAddress)}.`)
            let data = part.slice(2);   // remove first 2 bytes    
            results.push({
                loadAddress: loadAddress,
                data: data
            })
        }
        return results;
    }

    /**
     * Scans an array of RomStructs, and returns true if any of them have load address of 0xA000.
     * @param unpacked Array of RomStruct
     * @returns Returns true if any have a loadAddress = 0xA000.
     */
    public isAutoLoad(unpacked: Array<RomStruct>): boolean {
        return unpacked.some(r => r.loadAddress === 0xA000);
    }

    /**
     * Validates + processes the roms zip file.
     * @returns 
     */
    public async process(): Promise<boolean> {

        return new Promise(async (resolve, reject) => {
            let results: RomIndexInfo[] = [];     // index
            let romData: any = {};             // contents of all roms

            if (!this._file) {
                console.log('No roms set....')
                this._isValid = false;
                resolve(false);
            } else {
                console.log(`Processing roms file: ${this._file.name}...`)
                let zipFileData = await this.readFileBinary(this._file);
                let zip = await jsZip.loadAsync(zipFileData);

                for (let filename of Object.keys(zip.files)) {
                    // get contents
                    if (filename.toLowerCase() === "index.json") {
                        let fileData = await zip.files[filename].async('string');
                        results = JSON.parse(fileData);
                    } else {
                        let fileData = new Uint8Array(await zip.files[filename].async('nodebuffer'));
                        romData[filename] = fileData
                    }
                }

                // Finally loop backwards through index - if cannot find rom, remove.
                for (var i = results.length - 1; i >= 0; i--) {
                    results[i].data = [];
                    // Each result / index entry can have multiple filenames
                    results[i].fileNames.forEach(fn => {
                        if (fn in romData) {
                            results[i].data.push(romData[fn]);
                        } else {
                            console.log(`Unable to add rom: ${results[i].name}. Check files exist.`)
                            results.splice(i, 1);   // remove the entry
                        }
                    });
                }

                results.sort((a, b) => a.name > b.name ? 1 : -1);

                // finally, before returning, check minimum files present
                if (
                    results.find(i => i.fileType === RomFileType.kernal && i.region === RomRegion.pal) == undefined ||
                    results.find(i => i.fileType === RomFileType.kernal && i.region === RomRegion.ntsc) == undefined ||
                    results.find(i => i.fileType === RomFileType.basic && i.region === RomRegion.default) == undefined ||
                    results.find(i => i.fileType === RomFileType.character && i.region === RomRegion.default) == undefined
                ) {
                    this._isValid = false;
                    resolve(false);
                }

                this._roms = results;
                this._isValid = true;
                console.log(`${this._roms.length} valid rom entries found...`)
                resolve(true);
            }
        });
    }

    private readFileBinary = (file: File): Promise<Uint8Array> => {
        return new Promise<any>((resolve, reject) => {
            var reader = new FileReader();
            reader.onload = function (e) {
                if (e && e.target && e.target.result) {
                    let result = e.target.result as ArrayBuffer;
                    resolve(new Uint8Array(result));
                }
            };
            reader.onerror = function (e) {
                // error occurred
                throw new Error("Error : " + e.type);
            };
            reader.readAsArrayBuffer(file);
        });
    }
}