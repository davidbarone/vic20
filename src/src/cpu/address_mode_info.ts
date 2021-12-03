/**
 * Address mode structure
 */
export default interface AddressModeInfo {
    mode: string,
    desc: string,
    bytes: number,
    pattern: RegExp,
    format: string
}
