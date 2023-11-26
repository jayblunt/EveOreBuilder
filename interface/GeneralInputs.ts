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

import IEveDefaults from "../eve/Defaults.js"
import IEveStaticData from "../eve/StaticData.js"
import IInterfaceComponent from "./InterfaceComponents.js"
import { ITranscriptServiceConsumer, ITranscriptServiceProvider } from "./TranscriptOutput.js"


export interface IReprocessingEfficiencySubscriber {
    onReprocessingEfficiencyEvent(publisher: IReprocessingEfficiencyPublisher): void
}

export interface IReprocessingEfficiencyPublisher {
    addReprocessingEfficiencySubscriber(subscriber: IReprocessingEfficiencySubscriber): void
    removeReprocessingEfficiencySubscriber(subscriber: IReprocessingEfficiencySubscriber): void
    notifyReprocessingEfficiencySubscribers(): void
    getPublishedReprocessingEfficiencyData(): number
}


export interface ILiftOffersCountSubscriber {
    onLiftOffersCountEvent(publisher: ILiftOffersCountPublisher): void

}

export interface ILiftOffersCountPublisher {
    addLiftOffersCountSubscriber(subscriber: ILiftOffersCountSubscriber): void
    removeLiftOffersCountSubscriber(subscriber: ILiftOffersCountSubscriber): void
    notifyLiftOffersCountSubscribers(): void
    getPublishedLiftOffersCountData(): number
}


export interface ISelectPricingStationSubscriber {
    onSelectPricingStationEvent(publisher: ISelectPricingStationPublisher): void
}

export interface ISelectPricingStationPublisher {
    addSelectPricingStationSubscriber(subscriber: ISelectPricingStationSubscriber): void
    removeSelectPricingStationSubscriber(subscriber: ISelectPricingStationSubscriber): void
    notifySelectPricingStationSubscribers(): void
    getPublishedSelectPricingStationData(): string
}


export class GeneralInputs implements IInterfaceComponent, IReprocessingEfficiencyPublisher, ILiftOffersCountPublisher, ISelectPricingStationPublisher, ITranscriptServiceConsumer {
    private readonly d: Document
    private readonly eveDefaults: IEveDefaults
    private readonly eveStaticData: IEveStaticData
    private transcriptService: ITranscriptServiceProvider | null = null
    private readonly reprocessingEfficiencySubscribes: IReprocessingEfficiencySubscriber[] = []
    private readonly liftOffersCountSubscribers: ILiftOffersCountSubscriber[] = []
    private readonly selectPricingStationSubscribers: ISelectPricingStationSubscriber[] = []

    private reprocessingEfficiency: number
    private liftOffersCount: number
    private selectPricingStation: string

    constructor(d: Document, eveDefaults: IEveDefaults, eveStaticData: IEveStaticData) {
        this.d = d
        this.eveDefaults = eveDefaults
        this.eveStaticData = eveStaticData
        this.reprocessingEfficiency = Number.parseFloat(this.eveDefaults.get("reprocessingEfficiency") || "0.5")
        this.liftOffersCount = Number.parseInt(this.eveDefaults.get("liftOffersCount") || "1")
        this.selectPricingStation = this.eveDefaults.get("marketStation") || "60003760"
    }

    // IReprocessingEfficiencySubscriber / ISelectPricingStationPublisher
    public addReprocessingEfficiencySubscriber(subscriber: IReprocessingEfficiencySubscriber): void {
        if (this.reprocessingEfficiencySubscribes.indexOf(subscriber) < 0) {
            this.reprocessingEfficiencySubscribes.push(subscriber)
            subscriber.onReprocessingEfficiencyEvent(this)
        }
    }

    public removeReprocessingEfficiencySubscriber(subscriber: IReprocessingEfficiencySubscriber): void {
        const index = this.reprocessingEfficiencySubscribes.indexOf(subscriber)
        if (index >= 0) {
            this.reprocessingEfficiencySubscribes.splice(index, 1)
        }
    }

    public notifyReprocessingEfficiencySubscribers(): void {
        for (const subscriber of this.reprocessingEfficiencySubscribes) {
            subscriber.onReprocessingEfficiencyEvent(this)
        }
    }

    public getPublishedReprocessingEfficiencyData(): number {
        return this.reprocessingEfficiency
    }

    // ILiftOffersCountSubscriber / ILiftOffersCountPublisher
    public addLiftOffersCountSubscriber(subscriber: ILiftOffersCountSubscriber): void {
        if (this.liftOffersCountSubscribers.indexOf(subscriber) < 0) {
            this.liftOffersCountSubscribers.push(subscriber)
            subscriber.onLiftOffersCountEvent(this)
        }
    }

    public removeLiftOffersCountSubscriber(subscriber: ILiftOffersCountSubscriber): void {
        const index = this.liftOffersCountSubscribers.indexOf(subscriber)
        if (index >= 0) {
            this.liftOffersCountSubscribers.splice(index, 1)
        }
    }

    public notifyLiftOffersCountSubscribers(): void {
        for (const subscriber of this.liftOffersCountSubscribers) {
            subscriber.onLiftOffersCountEvent(this)
        }
    }

    public getPublishedLiftOffersCountData(): number {
        return this.liftOffersCount
    }

    // ILiftOffersCountSubscriber / ILiftOffersCountPublisher
    public addSelectPricingStationSubscriber(subscriber: ISelectPricingStationSubscriber): void {
        if (this.selectPricingStationSubscribers.indexOf(subscriber) < 0) {
            this.selectPricingStationSubscribers.push(subscriber)
            subscriber.onSelectPricingStationEvent(this)
        }
    }

    public removeSelectPricingStationSubscriber(subscriber: ISelectPricingStationSubscriber): void {
        const index = this.selectPricingStationSubscribers.indexOf(subscriber)
        if (index >= 0) {
            this.selectPricingStationSubscribers.splice(index, 1)
        }
    }

    public notifySelectPricingStationSubscribers(): void {
        for (const subscriber of this.selectPricingStationSubscribers) {
            subscriber.onSelectPricingStationEvent(this)
        }
    }

    public getPublishedSelectPricingStationData(): string {
        return this.selectPricingStation
    }

    addTranscriptProvider(provider: ITranscriptServiceProvider): void {
        this.transcriptService = provider
    }

    private onUISetReprocessingEfficiency(e: Event): void {
        const tgt: HTMLInputElement = <HTMLInputElement>e.target
        const tgtMin = Number.parseFloat(tgt.min)
        const tgtMax = Number.parseFloat(tgt.max)
        const tgtValue = Number.parseFloat(tgt.value)
        if (tgtValue >= tgtMin && tgtValue <= tgtMax) {
            this.reprocessingEfficiency = tgtValue
            this.eveDefaults.set("reprocessingEfficiency", this.reprocessingEfficiency.toString())
            this.notifyReprocessingEfficiencySubscribers()
        }
    }

    private onUISetLiftOffersCount(e: Event): void {
        const tgt: HTMLInputElement = <HTMLInputElement>e.target
        const tgtMin = Number.parseInt(tgt.min)
        const tgtMax = Number.parseInt(tgt.max)
        const tgtValue = Number.parseInt(tgt.value)
        if (tgtValue >= tgtMin && tgtValue <= tgtMax) {
            if (this.liftOffersCount != tgtValue) {
                this.liftOffersCount = tgtValue
                this.eveDefaults.set("liftOffersCount", this.liftOffersCount.toString())
                this.notifyLiftOffersCountSubscribers()
            }
        }
    }

    private onUISetPricingSource(e: Event): void {
        const tgt: HTMLSelectElement = <HTMLSelectElement>e.target
        const marketStation = tgt.options[tgt.selectedIndex].value
        if (this.selectPricingStation != marketStation) {
            this.selectPricingStation = marketStation
            this.eveDefaults.set("marketStation", this.selectPricingStation)
            this.notifySelectPricingStationSubscribers()
        }
    }

    private constructTableHead(): HTMLTableSectionElement {
        const thead = this.d.createElement('thead')
        return thead
    }

    private constructTableBody(): HTMLTableSectionElement {

        const tbody = this.d.createElement('tbody')

        if (true) {
            const trList = [
                (function (o): HTMLTableCellElement {
                    const el = o.d.createTextNode("Reprocessing Efficiency")
                    const td = o.d.createElement('td')
                    td.className = "align_left"
                    td.appendChild(el)
                    return td
                })(this),
                (function (o): HTMLTableCellElement {
                    const el = o.d.createElement('input')
                    el.title = "Reprocessing Efficiency"
                    el.type = "number"
                    el.value = o.reprocessingEfficiency.toString()
                    el.min = "0.0"
                    el.max = "1.0"
                    el.step = "0.01"
                    el.required = true
                    el.addEventListener('input', function (e) { return o.onUISetReprocessingEfficiency(e); })
                    const td = o.d.createElement('td')
                    td.appendChild(el)
                    return td
                })(this),
            ]

            const tr = this.d.createElement('tr')
            trList.map(td => {
                tr.appendChild(td)
            })
            tbody.appendChild(tr)
        }

        if (true) {
            const trList = [
                (function (o): HTMLTableCellElement {
                    const el = o.d.createTextNode("Number of Market Orders to lift")
                    const td = o.d.createElement('td')
                    td.className = "align_left"
                    td.appendChild(el)
                    return td
                })(this),
                (function (o): HTMLTableCellElement {
                    const el = o.d.createElement('input')
                    el.title = "Number of Market Orders to lift"
                    el.type = "number"
                    el.value = o.liftOffersCount.toString()
                    el.min = "0"
                    el.max = "20"
                    el.step = "1"
                    el.required = true
                    el.addEventListener('input', function (e) { return o.onUISetLiftOffersCount(e); })
                    const td = o.d.createElement('td')
                    td.appendChild(el)
                    return td
                })(this),
            ]

            const tr = this.d.createElement('tr')
            trList.map(td => {
                tr.appendChild(td)
            })
            tbody.appendChild(tr)
        }

        if (true) {
            const trList = [
                (function (o): HTMLTableCellElement {
                    const el = o.d.createTextNode("Pricing Station")
                    const td = o.d.createElement('td')
                    td.className = "align_left"
                    td.appendChild(el)
                    return td
                })(this),
                (function (o): HTMLTableCellElement {
                    const el = o.d.createElement('select')
                    el.title = "Pricing Station"
                    const oe_list: Array<HTMLOptionElement> = []
                    o.eveStaticData.stationIds.map((x, i) => {
                        const oe = o.d.createElement('option')
                        oe.value = x
                        oe.text = o.eveStaticData.stationNames[i]
                        if (o.selectPricingStation == x) {
                            oe.defaultSelected = true
                        } else {
                            oe.defaultSelected = false
                        }
                        oe_list.push(oe)
                    })
                    oe_list.sort((a, b) => {
                        if (a.text < b.text) {
                            return -1
                        } else if (a.text > b.text) {
                            return 1
                        } else {
                            return 0
                        }
                    }).map((oe) => {
                        el.add(oe)
                    })
                    el.addEventListener('input', function (e) { return o.onUISetPricingSource(e); })
                    const td = o.d.createElement('td')
                    td.appendChild(el)
                    return td
                })(this),
            ]

            const tr = this.d.createElement('tr')
            trList.map(td => {
                tr.appendChild(td)
            })
            tbody.appendChild(tr)
        }

        return tbody
    }

    private constructTableFoot(): HTMLTableSectionElement {
        const tfoot = this.d.createElement('tfoot')
        return tfoot
    }

    public anchorFragment(parentElement: Element): void {
        if (parentElement == null) {
            return
        }

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
