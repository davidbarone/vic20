/**
 * Via6522 Debug structure
 */
export default interface Via6522DebugInfo {
    name: string,
    reg: number[],
    base: number,
    regString: string,
    orb: number,
    ora: number,
    ddrb: number,
    ddra: number,
    t1c: number,
    t2c: number,
    t1l: number,
    t2l: number,
    acr: number,
    acrT1Status: string,
    acrT2Status: string,
    acrSRStatus: string,
    acrPAStatus: string,
    acrPBStatus: string,
    pcr: number,
    pcrCB1Status: string,
    pcrCB2Status: string,
    pcrCA1Status: string,
    pcrCA2Status: string,
    sr: number,
    ifr: number,
    ier: number
}
