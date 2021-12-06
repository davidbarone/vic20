// roms must be manually uploaded by the user
// This class used to simplify the loading process
// All ROMs will be in a single FileList, together with an index.js

import { RomFileType } from "./rom_file_type";
import RomIndexInfo from "./rom_index_info";
import { RomRegion } from "./rom_region";
import jsZip from "jszip";

export default class Roms {

    private _file: File; // the zip file containing all ROMs
    private _roms: RomIndexInfo[] = [];
    private _isValid: boolean = false;

    /**
    * constructor
    * @param model The memory model (unexpanded, full)
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

    public cartridges(): RomIndexInfo[] {
        return this._roms.filter(r => r.fileType === RomFileType.cartridge);
    }

    public async validate(): Promise<boolean> {

        return new Promise(async (resolve, reject) => {
            let results: RomIndexInfo[] = [];     // index
            let romData: any = {};             // contents of all roms

            if (!this._file) {
                this._isValid = false;
                resolve(false);
            } else {

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
                    if (results[i].fileName in romData) {
                        results[i].data = romData[results[i].fileName];
                    } else {
                        results.splice(i, 1);
                    }
                }

                results.sort((a, b) => b.name > a.name ? 1 : -1);

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