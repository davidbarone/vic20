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
    acr: string,
    pcr: string,
    ifr: string,
    ier: string,
    complete: string
}
