export enum MemoryModel {

    /**
     * Unexpanded.
     */
    unexpanded = "unexpanded",

    /**
     * Expanded (3K - BLK0, RAM1,2,3)
     */
    expanded_3k = "expanded_3k",

    /**
     * Expanded (8K - BLK1)
     */
    expanded_8k = "expanded_8k",

    /**
     * Expanded (16K - BLK1,2)
     */
    expanded_16k = "expanded_16k",

    /**
     * Expanded (24K - BLK1,2,3)
     */
    expanded_24k = "expanded_24k",

    /**
    * Expanded (32K - BLK1,2,3,5)
    */
    expanded_32k = "expanded_32k",

    /**
     * Expanded (35K - BLK0 RAM1,2,3 AND BLK1,2,3,5)
     */
    expanded_35k = "expanded_35k",

    /**
     * All memory available - used for testing
     */
    test = "test"
}