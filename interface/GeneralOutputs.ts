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

import IEveCalculator from "../eve/Calculator.js"
import IEveStaticData from "../eve/StaticData.js"
import { IMineralsPublisher, IMineralsSubscriber } from "./MineralBuildInputs.js"
import { ILiftOffersCountPublisher, ILiftOffersCountSubscriber, IReprocessingEfficiencyPublisher, IReprocessingEfficiencySubscriber } from "./GeneralInputs.js"
import { IMarketPricePublisher, IMarketPriceSubscriber, TEveLiveMarketPriceData } from "../eve/LiveData.js"
import { ITranscriptServiceConsumer, ITranscriptServiceProvider } from "./TranscriptOutput.js"
import IInterfaceComponent from "./InterfaceComponents.js"

export class GeneralOutputs implements IInterfaceComponent, IMineralsSubscriber, IReprocessingEfficiencySubscriber, ILiftOffersCountSubscriber, IMarketPriceSubscriber, ITranscriptServiceConsumer {
    private readonly d: Document
    private readonly c: Clipboard
    private readonly eveStaticData: IEveStaticData
    private readonly eveCalculator: IEveCalculator
    private transcriptService: ITranscriptServiceProvider | null = null

    // private readonly orderedOreNames: Array<string> = new Array()
    // private readonly orderedStubOreIds: Array<string> = new Array()

    private oreQuantityTextItems: Map<string, Text> = new Map()
    private orePriceTextItems: Map<string, Text> = new Map()
    private oreMaxQuantityTextItems: Map<string, Text> = new Map()
    private oreCostTextItems: Map<string, Text> = new Map()
    private oreDisplayRowItems: Map<string, HTMLTableRowElement> = new Map()
    private oreTotalCostText: Text | null = null
    private clipBoardContents: string = ""
    private clipBoardInputElement: HTMLInputElement | null = null

    private haveMarketPrices: boolean = false
    private haveReprocessingEfficiency: boolean = false
    private haveLiftOffersCount: boolean = false
    private haveRequiredMinerals: boolean = false

    private publishedMarketPrices: TEveLiveMarketPriceData = new Map()
    private publishedReprocessingEfficiency: number = 0.5
    private publishedLiftOffersCount: number = 0
    private publishedRequiredMinerals: Map<string, number> = new Map()

    constructor(d: Document, c: Clipboard, eveStaticData: IEveStaticData, eveCalculator: IEveCalculator) {
        this.d = d
        this.c = c
        this.eveStaticData = eveStaticData
        this.eveCalculator = eveCalculator
    }

    public addTranscriptProvider(provider: ITranscriptServiceProvider): void {
        this.transcriptService = provider
    }

    public onMineralsEvent(publisher: IMineralsPublisher): void {
        // console.log(`${this.constructor.name}.onMineralsEvent`)
        this.publishedRequiredMinerals = publisher.getPublishedMineralsData()
        this.haveRequiredMinerals = true
        this.updateOutputs()
    }

    public onReprocessingEfficiencyEvent(publisher: IReprocessingEfficiencyPublisher): void {
        // console.log(`${this.constructor.name}.onReprocessingEfficiencyEvent`)
        this.publishedReprocessingEfficiency = publisher.getPublishedReprocessingEfficiencyData()
        this.haveReprocessingEfficiency = true
        this.updateOutputs()
    }

    public onLiftOffersCountEvent(publisher: ILiftOffersCountPublisher): void {
        // console.log(`${this.constructor.name}.onLiftOffersCountEvent`)
        this.publishedLiftOffersCount = publisher.getPublishedLiftOffersCountData()
        this.haveLiftOffersCount = true
        this.updateOutputs()
    }

    public onMarketPriceEvent(publisher: IMarketPricePublisher): void {
        // console.log(`${this.constructor.name}.onMarketPriceEvent`)
        this.publishedMarketPrices = publisher.getPublishedMarketPriceData()
        this.haveMarketPrices = true
        this.updateOutputs()
    }

    private updateOutputs(): void {
        if (!(this.haveMarketPrices && this.haveLiftOffersCount)) {
            return
        }

        // console.log(this.publishedLiftOffersCount)

        const weightedMarketPrices: Map<string, [number, number]> = new Map()
        this.publishedMarketPrices.forEach((v, k) => {
            const vPx = (v.length <= this.publishedLiftOffersCount) ? v[v.length - 1][0] : v[this.publishedLiftOffersCount][0]
            const vQty = v.map((x) => x[0] <= vPx ? x[1] : 0).reduce((a, b) => a + b, 0)
            weightedMarketPrices.set(k, [vPx, vQty])
        })
        this.eveStaticData.oreIds.map((k) => {
            const price = weightedMarketPrices.get(k) || [0, 0]
            const orePriceText = this.orePriceTextItems.get(k)
            if (orePriceText !== undefined) {
                orePriceText.textContent = new Intl.NumberFormat().format(price[0])
            }

            const maxQuantityText = this.oreMaxQuantityTextItems.get(k)
            if (maxQuantityText !== undefined) {
                maxQuantityText.textContent = new Intl.NumberFormat().format(price[1])
            }

        })

        if (!(this.haveRequiredMinerals && this.haveMarketPrices && this.haveReprocessingEfficiency && this.haveLiftOffersCount)) {
            return
        }

        // console.log(this.publishedReprocessingEfficiency)
        // console.log(this.publishedRequiredMinerals)
        // console.log(this.publishedMarketPrices)

        let oreTotalCost: number = 0
        let oreTotalCount: number = 0
        const requiredOres = this.eveCalculator.calcRequiredOres(this.publishedReprocessingEfficiency, this.publishedRequiredMinerals, weightedMarketPrices)

        requiredOres.forEach((quantity, k) => {
            oreTotalCount += quantity
        })

        if (this.clipBoardInputElement) {
            this.clipBoardInputElement.disabled = (oreTotalCount <= 0)
        }

        requiredOres.forEach((quantity, k) => {

            const displayRow = this.oreDisplayRowItems.get(k) || null
            if (displayRow) {
                const isStubOreId = (this.eveStaticData.oreStubIds.indexOf(k) < 0) ? false : true
                // if (oreTotalCount == 0 && isStubOreId) {
                if (oreTotalCount == 0) {
                    displayRow.style.display = ""
                } else {
                    displayRow.style.display = (quantity == 0) ? "none" : ""
                }
            }

            const oreQuantityText = this.oreQuantityTextItems.get(k) || null
            if (oreQuantityText) {
                oreQuantityText.textContent = new Intl.NumberFormat().format(quantity)
            }

            const price = weightedMarketPrices.get(k) || [0, 0]

            const oreCostText = this.oreCostTextItems.get(k) || null
            if (oreCostText) {
                oreCostText.textContent = new Intl.NumberFormat().format(price[0] * quantity)
            }
            oreTotalCost += price[0] * quantity
        })


        if (this.oreTotalCostText) {
            this.oreTotalCostText.textContent = new Intl.NumberFormat().format(oreTotalCost)
        }

        const itemNames = new Map<string, string>(this.eveStaticData.oreIds.map((x, i: number) => [x, this.eveStaticData.oreNames[i]]))
        let tempString = ""
        itemNames.forEach((v, k) => {
            const qty = requiredOres.get(k) || 0
            if (qty > 0) {
                tempString += v + " " + qty + "\n"
            }
        })
        this.clipBoardContents = tempString
    }

    private onUICopyToClipboard(e: Event) {
        if (this.clipBoardContents !== undefined) {
            this.c.writeText(this.clipBoardContents)
        }
    }

    private constructTableHead(): HTMLTableSectionElement {
        const thead = this.d.createElement('thead')
        const tdList = [
            (function (o): HTMLTableCellElement {
                const el = o.d.createTextNode("Ore Name")
                const th = o.d.createElement('th')
                th.className = "align_left"
                th.appendChild(el)
                return th
            })(this),
            (function (o): HTMLTableCellElement {
                const el = o.d.createTextNode("Ore Market Max Price")
                const th = o.d.createElement('th')
                th.appendChild(el)
                return th
            })(this),
            (function (o): HTMLTableCellElement {
                const el = o.d.createTextNode("Ore Market Quantity")
                const th = o.d.createElement('th')
                th.appendChild(el)
                return th
            })(this),
            (function (o): HTMLTableCellElement {
                const el = o.d.createTextNode("Ore Purchase Quantity")
                const th = o.d.createElement('th')
                th.addEventListener('click', function (e) { return o.onUICopyToClipboard(e); })
                th.appendChild(el)
                return th
            })(this),
            (function (o): HTMLTableCellElement {
                const el = o.d.createTextNode("Ore Total Purchase Price")
                const th = o.d.createElement('th')
                th.appendChild(el)
                return th
            })(this),
        ]

        const row = this.d.createElement('tr')
        tdList.map(x => { row.appendChild(x); })
        thead.appendChild(row)
        return thead
    }

    private constructTableBody(): HTMLTableSectionElement {

        this.orePriceTextItems = new Map()
        this.oreMaxQuantityTextItems = new Map()
        this.oreQuantityTextItems = new Map()
        this.oreCostTextItems = new Map()
        this.oreDisplayRowItems = new Map()

        const oreItems = new Map<string, string>(this.eveStaticData.oreIds.map((x, i: number) => [x, this.eveStaticData.oreNames[i]]))

        const tbody = this.d.createElement('tbody')
        if (true) {
            this.eveStaticData.oreIds.map((itemId) => {
                const itemName = oreItems.get(itemId) || "<unknown>"
                const isStubOreId = (this.eveStaticData.oreStubIds.indexOf(itemId) < 0) ? false : true

                const tdList = [
                    (function (o): HTMLTableCellElement {
                        const img = o.d.createElement('img')
                        img.src = new URL(`${itemId}/icon?size=32`, new URL("https://images.evetech.net/types/")).toString()
                        const el = o.d.createTextNode(itemName)
                        const td = o.d.createElement('td')
                        td.className = "align_left"
                        td.appendChild(img)
                        td.appendChild(o.d.createTextNode(" "))
                        td.appendChild(el)
                        return td
                    })(this),
                    (function (o): HTMLTableCellElement {
                        const el = o.d.createTextNode("0")
                        o.orePriceTextItems.set(itemId, el)
                        const td = o.d.createElement('td')
                        td.appendChild(el)
                        return td
                    })(this),
                    (function (o): HTMLTableCellElement {
                        const el = o.d.createTextNode("0")
                        o.oreMaxQuantityTextItems.set(itemId, el)
                        const td = o.d.createElement('td')
                        td.appendChild(el)
                        return td
                    })(this),
                    (function (o): HTMLTableCellElement {
                        const el = o.d.createTextNode("0")
                        o.oreQuantityTextItems.set(itemId, el)
                        const td = o.d.createElement('td')
                        td.addEventListener('click', function (e) { return o.onUICopyToClipboard(e); })
                        td.appendChild(el)
                        return td
                    })(this),
                    (function (o): HTMLTableCellElement {
                        const el = o.d.createTextNode("0")
                        o.oreCostTextItems.set(itemId, el)
                        const td = o.d.createElement('td')
                        td.appendChild(el)
                        return td
                    })(this),
                ]

                const tr = this.d.createElement('tr')
                tr.style.display = (isStubOreId) ? "" : "none"
                this.oreDisplayRowItems.set(itemId, tr)
                tdList.map(x => { tr.appendChild(x); })
                tbody.appendChild(tr)
            })
        }
        return tbody
    }

    private constructTableFoot(): HTMLTableSectionElement {

        this.oreTotalCostText = null

        const tfoot = this.d.createElement('tfoot')
        let tdList = [
            (function (o): HTMLTableCellElement {
                let el = o.d.createTextNode("Total")
                let td = o.d.createElement('td')
                td.className = "align_left"
                td.appendChild(el)
                return td
            })(this),
            this.d.createElement('td'),
            this.d.createElement('td'),
            (function (o): HTMLTableCellElement {
                const el = o.d.createElement('input')
                el.type = "button"
                el.value = "Copy to Clipboard"
                el.disabled = true
                o.clipBoardInputElement = el
                let td = o.d.createElement('td')
                td.addEventListener('click', function (e) { return o.onUICopyToClipboard(e); })
                td.appendChild(el)
                return td
            })(this),
            (function (o): HTMLTableCellElement {
                let el = o.d.createTextNode("0")
                let td = o.d.createElement('td')
                o.oreTotalCostText = el
                td.appendChild(el)
                return td
            })(this),
        ]
        let tr = this.d.createElement('tr')
        tdList.map(x => { tr.appendChild(x); })
        tfoot.appendChild(tr)
        return tfoot
    }

    public anchorFragment(parentElement: Element): void {

        const table = this.d.createElement('table')
        table.appendChild(this.constructTableHead())
        table.appendChild(this.constructTableBody())
        table.appendChild(this.constructTableFoot())

        const fragment = new DocumentFragment()
        fragment.append(table)

        while (parentElement.childElementCount > 0) {
            parentElement.removeChild(parentElement.childNodes[parentElement.childElementCount - 1])
        }

        parentElement.appendChild(fragment)
    }
}
