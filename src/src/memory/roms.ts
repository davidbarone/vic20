// roms must be manually uploaded by the user
// This class used to simplify the loading process
// All ROMs will be in a single FileList, together with an index.js

import { ResolvePlugin } from "webpack";

export default class Roms {

    private files: File[];
    private isPal: boolean;
    private indexFile: File | undefined;
    private index: { name: string, fileName: string, fileType: string, region: string }[] = [];

    /**
    * constructor
    * @param model The memory model (unexpanded, full)
    */
    public constructor(files: FileList, isPal: boolean) {
        debugger;
        this.files = Array.from(files);
        let that = this;

        // parse the index.json file
        this.indexFile = this.files.find(f => f.name.toLowerCase() === "index.json");
        this.isPal = isPal;
    }

    public async hasAllRoms(): Promise<boolean> {
        let region = this.isPal ? "pal" : "ntsc";
        debugger;
        return this.getIndex()
            .then(index => {
                return (
                    index.find(i => i.fileType === "kernal" && i.region === region) !== undefined &&
                    index.find(i => i.fileType === "basic" && i.region === "default") !== undefined &&
                    index.find(i => i.fileType === "character" && i.region === "default") !== undefined
                );
            });
    }

    public async getRom(romType: string, region: string): Promise<Uint8Array> {
        return this.getIndex()
            .then(index => {
                let rom: { name: string, fileName: string, fileType: string, region: string } | undefined = index.find(i => i.fileType.toLowerCase() === romType.toLowerCase() && i.region.toLowerCase() === region.toLowerCase());
                let file: File = this.files.filter(f => f.name.toLowerCase() === rom?.fileName)[0];
                return this.readFileBinary(file);
            })
    }

    private async getIndex(): Promise<{ name: string, fileName: string, fileType: string, region: string }[]> {
        if (this.indexFile) {
            return this.readFileText(this.indexFile)
                .then(str => {
                    let obj: {
                        name: string, fileName: string, fileType: string, region: string
                    }[] = JSON.parse(str);
                    return obj;
                });
        } else {
            return [];
        }
    }

    private readFileText = (file: File): Promise<string> => {
        return new Promise<any>((resolve, reject) => {
            var reader = new FileReader();
            reader.onload = function (e) {
                if (e && e.target && e.target.result) {
                    let result = e.target.result as string;
                    resolve(result);
                }
            };
            reader.onerror = function (e) {
                // error occurred
                throw new Error("Error : " + e.type);
            };
            reader.readAsText(file);
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