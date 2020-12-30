import AddressMode from "../src/cpu/AddressMode"

test('Parse immediate', () => {
    let operand = "#10";
    let rule = AddressMode.Parse(operand);
    expect(rule.AddressMode.mode).toBe("#");
    expect(rule.Value).toBe(10);
});

test('Parse immediate', () => {
    let operand = "A";
    let rule = AddressMode.Parse(operand);
    expect(rule.AddressMode.mode).toBe("A");
    expect(rule.Value).toBeNull();
});

export default {}