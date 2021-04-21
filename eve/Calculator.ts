// MIT License

// Copyright (c) 2021 Jay Blunt

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import solver from "../external/solver/main.js"
import { ITranscriptServiceConsumer, ITranscriptServiceProvider } from "../interface/TranscriptOutput.js"
import IEveStaticData from "./StaticData.js"

export declare var DEBUG_CALCULATOR: any

export default interface IEveCalculator {
    calcRequiredItems(itemId: string, buildQty: number, buildMe: number, facilityModifier?: number): Map<string, number>
    calcActualMinerals(processingEfficiency: number, actualOres: Map<string, number>): Map<string, number>
    calcResidualMinerals(actualMinerals: Map<string, number>, requiredMinerals: Map<string, number>): Map<string, number>
    calcProcessedYield(processingEfficiency: number): Map<string, Map<string, number>>
    calcRequiredOres(processingEfficiency: number, totalRequiredMinerals: Map<string, number>, orePriceMap: Map<string, [number, number]>): Map<string, number>
}

export class EveCalculator implements IEveCalculator, ITranscriptServiceConsumer {
    private readonly eveStaticData: IEveStaticData
    private readonly debug: boolean = "DEBUG_CALCULATOR" in window
    private transcriptService: ITranscriptServiceProvider | null = null

    constructor(eveStaticData: IEveStaticData) {
        this.eveStaticData = eveStaticData
    }


    private _toObject(map = new Map): Map<any, any> {
        return Object.fromEntries
            (Array.from
                (map.entries()
                    , ([k, v]) =>
                        v instanceof Map
                            ? [k, this._toObject(v)]
                            : [k, v]
                )
            )
    }

    addTranscriptProvider(provider: ITranscriptServiceProvider): void {
        this.transcriptService = provider
    }

    public calcRequiredItems(itemId: string, buildQty: number, buildMe: number, facilityModifier: number = 1.0): Map<string, number> {

        // https://eve-industry.org/export/IndustryFormulas.pdf
        // required = max(runs, ceil(round(runs ∗ baseQuantity ∗ materialModifier, 2)))
        function calcQty(count: number, quantity: number, me: number, fm: number): number {
            return Math.max(count,
                Math.ceil(
                    Math.round(100 * count * quantity * (1.0 - me / 100.0) * fm) / 100))
        }

        const itemRequirements: Map<string, number> = this.eveStaticData.itemRequirements(itemId)
        const requiredItems = new Map(Array.from(itemRequirements.keys()).map((x) => [x, 0]))
        if (buildQty > 0) {
            if (this.debug) {
                console.log(["requirement", itemId, 1, 0])
                console.log(itemRequirements)
            }

            Array.from(itemRequirements.keys()).map(mId => {
                const smv = itemRequirements.get(mId) || 0
                if (smv > 0) {
                    const v = requiredItems.get(mId) || 0
                    requiredItems.set(mId, v + calcQty(buildQty, smv, buildMe, facilityModifier))
                }
            })

            if (this.debug) {
                console.log(["actual", itemId, buildQty, buildMe])
                console.log(requiredItems)
            }
        }
        return requiredItems
    }

    public calcActualMinerals(processingEfficiency: number, actualOres: Map<string, number>): Map<string, number> {
        const actualMinerals = new Map(this.eveStaticData.mineralIds.map((x) => [x, 0]))
        const actualOreYields = this.calcProcessedYield(processingEfficiency)

        this.eveStaticData.oreIds.map((x, i) => {
            const requiredQty = actualOres.get(x) || 0
            const yieldMap = actualOreYields.get(x) || new Map<string, number>()
            this.eveStaticData.mineralIds.map((y, j) => {
                const myv = yieldMap.get(y) || 0
                const amv = actualMinerals.get(y) || 0
                actualMinerals.set(y, amv + requiredQty * myv)
            })
        })
        return actualMinerals
    }

    public calcResidualMinerals(actualMinerals: Map<string, number>, requiredMinerals: Map<string, number>): Map<string, number> {
        return new Map(this.eveStaticData.mineralIds.map((x, i) => {
            return [x, (actualMinerals.get(x) || 0) - (requiredMinerals.get(x) || 0)]
        }))
    }

    public calcProcessedYield(processingEfficiency: number): Map<string, Map<string, number>> {
        const processedYields: Map<string, Map<string, number>> = new Map()
        this.eveStaticData.oreFullYields.forEach((oreV, oreK) => {
            const yieldMap: Map<string, number> = new Map()
            oreV.forEach((minV, minK) => {
                yieldMap.set(minK, (minV === undefined) ? 0 : Math.floor(minV * processingEfficiency))
            })
            processedYields.set(oreK, yieldMap)
        })
        return processedYields
    }

    public calcRequiredOres(processingEfficiency: number, totalRequiredMinerals: Map<string, number>, orePriceMap: Map<string, [number, number]>): Map<string, number> {

        let allMineralTotalCount: number = 0
        totalRequiredMinerals.forEach((v, k) => {
            allMineralTotalCount += v
        })

        const allRequiredOres: Map<string, number> = new Map(this.eveStaticData.oreIds.map((x) => [x, 0]))

        if (allMineralTotalCount == 0) {
            return allRequiredOres
        }

        if (this.debug) console.log(["totalRequiredMinerals", totalRequiredMinerals]);

        const oreActualYields = this.calcProcessedYield(processingEfficiency)

        const oreMarketPrices: Array<number> = []
        const oreMarketSizes: Array<number> = []
        this.eveStaticData.oreIds.map((oreId, i) => {
            let p = orePriceMap.get(oreId) || [0, 0]
            oreMarketPrices.push(p[0])
            oreMarketSizes.push(p[1])
        })

        // See https://github.com/JWally/jsLPSolver for examples
        const optVars = new Map(this.eveStaticData.oreIds
            .filter((oreId, i) => oreMarketSizes[i] > 0)
            .map((oreId, i) => {
                let m = new Map(this.eveStaticData.mineralIds.map((mineralId, j) => {
                    const oreYields = oreActualYields.get(oreId)
                    return [this.eveStaticData.mineralNames[j], (oreYields === undefined) ? 0 : oreYields.get(mineralId)]
                }))
                m.set('_price', oreMarketPrices[i].valueOf())
                m.set(oreId, 1)
                return [oreId, m]
            }))


        const optConstraints = new Map(this.eveStaticData.mineralIds.map((x, i) => {
            const requiredMinerals = totalRequiredMinerals.get(x)
            return [this.eveStaticData.mineralNames[i], new Map([['min', (requiredMinerals === undefined) ? 0 : requiredMinerals.valueOf()]])]
        }))

        // add in the oreMarketSizes constraints
        this.eveStaticData.oreIds
            .filter((oreId, i) => oreMarketSizes[i] > 0)
            .map((x, i) => {
                optConstraints.set(x, new Map([['min', 0], ['max', oreMarketSizes[i]]]))
            })


        // The solver is very slow with many integer constraints. Limit as many as we think is safe.
        // constrain the highest-priced ores so the result price differential will be as small as possible.
        const solverGoesNutsMaxInt = 8
        const oreReverseSortedPriceList = this.eveStaticData.oreIds
            .map((x, i): [string, number] => [x, oreMarketPrices[i]])
            // .map((x, i) => { console.log(x); return x; })
            .sort((a, b) => b[1] - a[1])
            .map((x) => x[0])
        const optIntegers = new Map(oreReverseSortedPriceList.map((x, i) => [x, i < solverGoesNutsMaxInt ? 1 : 0]))

        const optModel = this._toObject(new Map<string, any>([
            ['optimize', '_price'],
            ['opType', 'min'],
            ['constraints', optConstraints],
            ['variables', optVars],
            ['ints', optIntegers],
        ]))

        if (this.debug) console.log(JSON.stringify(optModel).toString())
        const optResult = solver.Solve(optModel)
        if (this.debug) console.log(JSON.stringify(optResult).toString())

        const resultFeasible = Object.entries(optResult).filter((x) => x[0] == 'feasible').map((x) => x[1])[0]

        if (resultFeasible) {
            Object.entries(optResult)
                .filter((x) => this.eveStaticData.oreIds.indexOf(x[0]) >= 0)
                .map((x) => {
                    allRequiredOres.set(x[0], Math.ceil(Number.parseFloat(x[1] as string)))
                })
        }

        if (this.transcriptService) {
            if (!resultFeasible) {
                this.transcriptService.addMessage("LP solution not feasible")
            }
        }

        return allRequiredOres
    }

}
