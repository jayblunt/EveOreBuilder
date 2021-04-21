declare type KeyValueDict = { [key: string]: any }
declare interface Solver {
    Solve(model: KeyValueDict, precision?: number, full?: boolean, validate?: boolean): KeyValueDict
}
declare var solver: Solver
export default solver