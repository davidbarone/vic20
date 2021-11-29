import Utils from "../src/lib/utils"

test('HexToNumber', () => {
    expect(Utils.HexToNumber("FF")).toBe(255);
    expect(Utils.HexToNumber("00")).toBe(0);
    expect(Utils.HexToNumber("F0F0")).toBe(61680);
});

test('NumberToTest', () => {
    expect(Utils.NumberToHex(0)).toBe('00');
    expect(Utils.NumberToHex(255)).toBe('FF');
    expect(Utils.NumberToHex(65535)).toBe('FFFF');
});

test('Uint8ArrayToHex', () => {
    let buffer: Uint8Array = new Uint8Array([255, 128, 127, 16, 0]);
    expect(Utils.UInt8ArrayToHex(buffer, " ")).toBe("FF 80 7F 10 00");
});