import Utils from "../src/Utils"

test('HexToNumber', () => {
    expect(Utils.HexToNumber("FF")).toBe(255);
    expect(Utils.HexToNumber("00")).toBe(0);
    expect(Utils.HexToNumber("F0F0")).toBe(61680);
});