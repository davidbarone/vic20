import AddressMode from "../src/cpu/AddressMode"

test('Parse immediate', () => {
    let operand = "#10";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("#");
    expect(rule.Value).toBe(10);
});

test('Parse accumulator', () => {
    let operand = "A";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("A");
    expect(rule.Value).toBeNull();
});

test('Parse zpg', () => {
    let operand = "$FF";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("zpg");
    expect(rule.Value).toBe(255);
});

test('Parse zpg,X', () => {
    let operand = "$FF,X";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("zpg,X");
    expect(rule.Value).toBe(255);
});

test('Parse zpg,Y', () => {
    let operand = "$FF,Y";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("zpg,Y");
    expect(rule.Value).toBe(255);
});

test('Parse abs', () => {
    let operand = "$ABCD";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("abs");
    expect(rule.Value).toBe(43981);
});

test('Parse abs,X', () => {
    let operand = "$ABCD,X";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("abs,X");
    expect(rule.Value).toBe(43981);
});

test('Parse abs,Y', () => {
    let operand = "$ABCD,Y";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("abs,Y");
    expect(rule.Value).toBe(43981);
});

test('Parse ind', () => {
    let operand = "($ABCD)";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("ind");
    expect(rule.Value).toBe(43981);
});

test('Parse X,ind', () => {
    let operand = "($ABCD,X)";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("X,ind");
    expect(rule.Value).toBe(43981);
});

test('Parse ind,Y', () => {
    let operand = "($ABCD),Y";
    let rule = AddressMode.Parse(operand, {}, 0);
    expect(rule.AddressMode.mode).toBe("ind,Y");
    expect(rule.Value).toBe(43981);
});

export default {}