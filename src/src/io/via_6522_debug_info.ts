/**
 * Via6522 Debug structure
 */
export default interface Via6522DebugInfo {
    name: string,
    reg: number[],
    base: number,
    regString: string,
    t1: number,
    t2: number,
    l1: number,
    l2: number,
    acrStatus: string,
    acr: string,
    pcr: string,
    ifr: string,
    ier: string,
    complete: string
}
