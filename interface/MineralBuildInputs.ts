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
import IEveDefaults from "../eve/Defaults.js"
import IEveStaticData from "../eve/StaticData.js"
import IInterfaceComponent from "./InterfaceComponents.js"
import { ITranscriptServiceConsumer, ITranscriptServiceProvider } from "./TranscriptOutput.js"


export interface IMineralsSubscriber {
    onMineralsEvent(publisher: IMineralsPublisher): void
}

export interface IMineralsPublisher {
    addMineralsSubscriber(subscriber: IMineralsSubscriber): void
    removeMineralsSubscriber(subscriber: IMineralsSubscriber): void
    notifyMineralsSubscribers(): void
    getPublishedMineralsData(): Map<string, number>
}


export interface IPasteServiceProvider {
    doPaste(data: string): void
}

export interface IPasteServiceConsumer {
    addPasteServiceProvider(provider: IPasteServiceProvider): void
}



interface Iterator<T, TReturn = any, TNext = undefined> {
    // Takes either 0 or 1 arguments - doesn't accept 'undefined'
    next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
    return?(value?: TReturn): IteratorResult<T, TReturn>;
    throw?(e?: any): IteratorResult<T, TReturn>;
}

interface Generator<T = unknown, TReturn = any, TNext = unknown>
    extends Iterator<T, TReturn, TNext> {
    next(...args: [] | [TNext]): IteratorResult<T, TReturn>;
    return(value: TReturn): IteratorResult<T, TReturn>;
    throw(e: any): IteratorResult<T, TReturn>;
    [Symbol.iterator](): Generator<T, TReturn, TNext>;
}

function* idGenerator(prefix: string, depth: number = 4): Generator<string, void> {
    const alphabet = "abcdefghijklmnopqrstuvwxyz"
    if (depth > 0) {
        if (depth == 1) {
            for (const c of alphabet) {
                yield prefix + c
            }
        } else {
            for (const c of alphabet) {
                yield* idGenerator(prefix + c, depth - 1)
            }
        }
    }
}



export class MineralBuildInputs implements IInterfaceComponent, IMineralsPublisher, ITranscriptServiceConsumer, IPasteServiceConsumer {
    private readonly d: Document
    private readonly eveDefaults: IEveDefaults
    private readonly eveStaticData: IEveStaticData
    private readonly eveCalculator: IEveCalculator
    private transcriptService: ITranscriptServiceProvider | null = null
    private pasteService: IPasteServiceProvider | null = null

    private updateTotalMineralsTimer: number = -1

    private readonly subscribers: IMineralsSubscriber[] = new Array()
    private readonly totalRequiredMinerals: Map<string, number> = new Map()

    private readonly elementIdIMap: Map<string, string> = new Map()
    private readonly itemQuantityElementMap: Map<string, HTMLInputElement> = new Map()
    private readonly itemMeElementMap: Map<string, HTMLInputElement> = new Map()
    private readonly itemMineralElementMap: Map<string, Map<string, Text>> = new Map()
    private readonly itemMineralTotalElementMap: Map<string, Text> = new Map()
    private readonly derivativesItemList: Array<string> = new Array()
    private readonly groupElementArrayMap: Map<string, Array<HTMLTableRowElement>> = new Map()
    private readonly itemActualRequirements: Map<string, Map<string, number>> = new Map();

    private readonly itemMECache: Map<string, string> = new Map()
    private readonly groupVisibleBooleanMap: Map<string, boolean> = new Map()

    readonly DEFAULT_ITEM_ME = "10"
    readonly DEFAULT_UPDATE_TIMEOUT = 250

    constructor(d: Document, eveDefaults: IEveDefaults, eveStaticData: IEveStaticData, eveCalculator: IEveCalculator) {
        this.d = d
        this.eveDefaults = eveDefaults
        this.eveStaticData = eveStaticData
        this.eveCalculator = eveCalculator
        this.totalRequiredMinerals = new Map<string, number>(this.eveStaticData.mineralIds.map(x => [x, 0]))
    }

    public addMineralsSubscriber(subscriber: IMineralsSubscriber): void {
        if (this.subscribers.indexOf(subscriber) < 0) {
            this.subscribers.push(subscriber)
            subscriber.onMineralsEvent(this)
        }
    }

    public removeMineralsSubscriber(subscriber: IMineralsSubscriber): void {
        const index = this.subscribers.indexOf(subscriber)
        if (index >= 0) {
            this.subscribers.splice(index, 1)
        }
    }

    public notifyMineralsSubscribers(): void {
        for (const subscriber of this.subscribers) {
            subscriber.onMineralsEvent(this)
        }
    }

    public getPublishedMineralsData(): Map<string, number> {
        return this.totalRequiredMinerals
    }

    public updateTotalMineralsTimerCallback(): void {
        this.notifyMineralsSubscribers()
        if (this.updateTotalMineralsTimer >= 0) {
            this.updateTotalMineralsTimer = -1
        }
    }

    public addTranscriptProvider(provider: ITranscriptServiceProvider): void {
        this.transcriptService = provider
    }

    public addPasteServiceProvider(provider: IPasteServiceProvider): void {
        this.pasteService = provider
    }


    protected updateItemRequiredMinerals(itemId: string, updateTotal: boolean = true): void {
        const buildQtyElement = this.itemQuantityElementMap.get(itemId)
        const buildMeElement = this.itemMeElementMap.get(itemId)

        if (buildQtyElement !== undefined && buildMeElement !== undefined) {

            let buildQty = (buildQtyElement === undefined) ? 0 : Number.parseInt(buildQtyElement.value)
            let buildMe = (buildMeElement === undefined) ? 0 : Number.parseInt(buildMeElement.value)
            this.setItemME(itemId, buildMe.toString())

            const buildItems = this.eveCalculator.calcRequiredItems(itemId, buildQty, buildMe)
            this.itemActualRequirements.set(itemId, buildItems)

            const mineralItemElements = this.itemMineralElementMap.get(itemId)
            if (mineralItemElements !== undefined) {
                mineralItemElements.forEach((v, k) => {
                    const mineralQty = buildItems.get(k) || 0
                    v.textContent = new Intl.NumberFormat().format(mineralQty)
                })
            }

        }

        if (updateTotal) {
            this.updateTotalRequiredMinerals()
        }
    }

    protected updateTotalRequiredMinerals(): void {

        const totalRequiredMinerals: Map<string, number> = new Map(this.eveStaticData.mineralIds.map(x => [x, 0]))
        const totalRequiredNonMinerals: Map<string, number> = new Map();

        // Pass #1: update the items that do not directly require minerals.
        this.itemActualRequirements.forEach((itemActualRequirements, itemId) => {
            itemActualRequirements.forEach((v, k) => {
                if (this.eveStaticData.mineralIds.indexOf(k) < 0) {
                    const ov = totalRequiredNonMinerals.get(k) || 0
                    totalRequiredNonMinerals.set(k, ov + v)
                }
            })
        })

        // console.log([totalRequiredNonMinerals])
        totalRequiredNonMinerals.forEach((v, k) => {
            const buildQtyElement = this.itemQuantityElementMap.get(k)
            if (buildQtyElement !== undefined) {
                buildQtyElement.value = v.toString()
                this.updateItemRequiredMinerals(k, false)
            }
        })

        // Pass #2: update the items that directly require minerals
        this.itemActualRequirements.forEach((itemActualRequirements, itemId) => {
            itemActualRequirements.forEach((v, k) => {
                if (this.eveStaticData.mineralIds.indexOf(k) >= 0) {
                    const ov = totalRequiredMinerals.get(k) || 0
                    totalRequiredMinerals.set(k, ov + v)
                }
            })
        })

        this.itemMineralTotalElementMap.forEach((v, k) => {
            const mineralQty = totalRequiredMinerals.get(k) || 0
            v.textContent = new Intl.NumberFormat().format(mineralQty)
        })

        this.totalRequiredMinerals.clear()
        totalRequiredMinerals.forEach((v, k) => {
            this.totalRequiredMinerals.set(k, v)
        })

        if (this.updateTotalMineralsTimer < 0) {
            const o = this
            this.updateTotalMineralsTimer = setTimeout((function () {
                return o.updateTotalMineralsTimerCallback();
            }), this.DEFAULT_UPDATE_TIMEOUT)
        }
    }

    protected onUIClipboardPaste(e: ClipboardEvent): void {
        if (!e.clipboardData)
            return

        const pasteData = e.clipboardData.getData('text')
        if (pasteData.length > 0 && pasteData.length < 1024) {
            const itemNameToId: Map<string, string> = new Map(this.eveStaticData.buildIds.map((x, i: number) => [this.eveStaticData.buildNames[i], x]))

            if (this.pasteService != null) {
                this.pasteService.doPaste(pasteData)
            }

            const wtfItems: Array<string> = new Array()
            const buildItems: Map<string, [number, number | undefined]> = new Map()
            const garbageInput: Array<string> = new Array()
            pasteData.replace(/(\r\n|\n|\r)+/gm, '\n').replace(/(^\n|\n$)/gm, '')
                .split('\n')
                .map((x, i) => {
                    const m = x.match(/^([\s\D]+)?\s+(\d+)(?:\s+(\d+)){0,1}$/)
                    if ((m != null) && (m.length == 4)) {
                        const [_xx, tmpItemName, itemCount, itemMe] = m
                        const itemName = tmpItemName.trim()
                        const itemId = itemNameToId.get(itemName)
                        if (itemId !== undefined) {
                            buildItems.set(itemId, [Number.parseInt(itemCount), Number.parseInt(itemMe)])
                        } else if (wtfItems.indexOf(itemName) < 0) {
                            wtfItems.push(itemName)
                        }
                    } else {
                        garbageInput.push(x.trim())
                    }
                })
            if (garbageInput.length > 0 && this.transcriptService != null) {
                garbageInput.map((x, i) => {
                    this.transcriptService.addMessage(`"${x}" is not a valid entry ...`)
                })
                if (garbageInput.length > 5) {
                    this.transcriptService.addMessage(`.. dude .. lay off the sauce .. ${garbageInput.length} lines of trash ..`)
                }
            }

            if (wtfItems.length > 0) {
                if (this.transcriptService != null) {
                    const thisthen = (wtfItems.length == 1) ? "this" : "these"
                    const isare = (wtfItems.length == 1) ? "is not a support ship" : "are not supported ships"
                    this.transcriptService.addMessage(`${thisthen} (${wtfItems.sort().join(', ')}) ${isare}`)
                }
            }

            // console.log(buildItems)
            const buildItemLen = Array.from(buildItems.keys()).length
            if (buildItemLen > 0) {
                const changedItemIds: Array<string> = new Array()
                this.itemQuantityElementMap.forEach((v, k) => {
                    const bs = buildItems.get(k.toString())
                    if (bs !== undefined) {
                        v.value = ((bs[0] > 99) ? 99 : (bs[0] < 0) ? 0 : bs[0]).toString()
                    } else {
                        v.value = (0).toString()
                    }
                    if (changedItemIds.indexOf(k) < 0) {
                        changedItemIds.push(k)
                    }
                })
                this.itemMeElementMap.forEach((v, k) => {
                    const bs = buildItems.get(k.toString())
                    if (bs !== undefined) {
                        const mev = bs[1]
                        if ((mev != undefined) && (!Number.isNaN(mev))) {
                            v.value = ((mev > 10) ? 10 : ((mev < 0) ? 0 : mev)).toString()
                            this.setItemME(k, v.value)
                            // console.log([k, mev, v.value])
                        }
                    } else {
                        v.value = (10).toString()
                    }
                })
                changedItemIds.map((x) => {
                    this.updateItemRequiredMinerals(x, false)
                })
                this.updateTotalRequiredMinerals()
                if (this.transcriptService != null) {
                    this.transcriptService.addMessage(`pasted info for ${buildItemLen} ship${buildItemLen == 1 ? "" : "s"} filled out`)
                }
            }
        } else {
            if (this.transcriptService != null) {
                this.transcriptService.addMessage("can't parse that, try pasting something valid")
            }
        }
    }

    protected onUISetItemQuantity(e: Event): void {
        const tgt: HTMLInputElement = <HTMLInputElement>e.target
        const itemId = this.elementIdIMap.get(tgt.id)
        if (itemId !== undefined) {
            if (Number.parseInt(tgt.value) >= Number.parseInt(tgt.min) && Number.parseInt(tgt.value) <= Number.parseInt(tgt.max)) {
                this.updateItemRequiredMinerals(itemId)
            } else {
                if (Number.parseInt(tgt.value) < Number.parseInt(tgt.min)) {
                    tgt.value = tgt.min
                } else if (Number.parseInt(tgt.value) > Number.parseInt(tgt.max)) {
                    tgt.value = tgt.max
                }
            }
        }
    }

    protected onUISetItemME(e: Event): void {
        const tgt: HTMLInputElement = <HTMLInputElement>e.target
        const itemId = this.elementIdIMap.get(tgt.id)
        if (itemId !== undefined) {
            if (Number.parseInt(tgt.value) >= Number.parseInt(tgt.min) && Number.parseInt(tgt.value) <= Number.parseInt(tgt.max)) {
                this.updateItemRequiredMinerals(itemId)
            } else {
                if (Number.parseInt(tgt.value) < Number.parseInt(tgt.min)) {
                    tgt.value = tgt.min
                } else if (Number.parseInt(tgt.value) > Number.parseInt(tgt.max)) {
                    tgt.value = tgt.max
                }
            }
        }
    }

    protected onUIToggleGroup(e: Event): void {
        const tgt: HTMLInputElement = <HTMLInputElement>e.target
        const groupId = this.elementIdIMap.get(tgt.id)
        if (groupId !== undefined) {
            const isVisible = this.groupVisibleBooleanMap.get(groupId)
            const itemList = this.groupElementArrayMap.get(groupId)
            if (itemList !== undefined) {
                itemList.forEach((v) => {
                    v.style.display = (isVisible) ? "none" : ""
                })
            }
            this.groupVisibleBooleanMap.set(groupId, !isVisible)
        }
    }

    private getItemME(itemId: string): string {
        let itemMe: string | undefined | null = this.itemMECache.get(itemId)
        if ((itemMe === undefined) || (itemMe == null)) {
            const itemDefaultsKey = "ME" + itemId
            itemMe = this.eveDefaults.get(itemDefaultsKey)
            if ((itemMe === undefined) || (itemMe == null) ||
                (Number.parseInt(itemMe) > 10 || Number.parseInt(itemMe) < 0)) {
                itemMe = this.DEFAULT_ITEM_ME
            }
            this.setItemME(itemId, itemMe, false)
        }
        return itemMe
    }

    private setItemME(itemId: string, itemMe: string, setDefault: boolean = true): void {
        let oldItemMe = this.itemMECache.get(itemId)
        if ((oldItemMe === undefined) || (oldItemMe == null) || (oldItemMe != itemMe)) {
            const itemMeDefaultsKey = "ME" + itemId
            if (itemMe == this.DEFAULT_ITEM_ME) {
                this.eveDefaults.delete(itemMeDefaultsKey)
            } else if (setDefault) {
                this.eveDefaults.set(itemMeDefaultsKey, itemMe)
            }
            this.itemMECache.set(itemId, itemMe)
        }
    }

    private constructTableHeader(): HTMLTableSectionElement {
        const thead = this.d.createElement('thead')

        const tdList = [
            (function (o): HTMLTableDataCellElement {
                const el = o.d.createTextNode("Item Type")
                const th = o.d.createElement('th')
                th.className = "align_left"
                th.appendChild(el)
                return th
            })(this),
            (function (o): HTMLTableDataCellElement {
                const el = o.d.createTextNode("Item Name")
                const th = o.d.createElement('th')
                th.className = "align_left"
                th.appendChild(el)
                return th
            })(this),
            (function (o): HTMLTableDataCellElement {
                const el = o.d.createTextNode("Build Quantity")
                const th = o.d.createElement('th')
                th.appendChild(el)
                return th
            })(this),
            (function (o): HTMLTableDataCellElement {
                const el = o.d.createTextNode("BluePrint ME")
                const th = o.d.createElement('th')
                th.appendChild(el)
                return th
            })(this),
        ]

        this.eveStaticData.mineralNames.map(mName => {
            const el = this.d.createTextNode(mName)
            const th = this.d.createElement('th')
            th.appendChild(el)
            tdList.push(th)
        })

        const tr = this.d.createElement('tr')
        tdList.map(x => { tr.appendChild(x); })
        thead.appendChild(tr)
        return thead
    }

    private constructTableBody(): HTMLTableSectionElement {

        this.itemQuantityElementMap.clear()
        this.itemMeElementMap.clear()
        this.itemMineralElementMap.clear()

        const itemNames: Map<string, string> = new Map(this.eveStaticData.buildIds.map((x, i: number) => [x, this.eveStaticData.buildNames[i]]))
        const itemGroups: Map<string, string> = new Map(this.eveStaticData.buildIds.map((x, i: number) => [x, this.eveStaticData.buildGroups[i]]))
        const groupNames: Map<string, string> = new Map(this.eveStaticData.groupsIds.map((x, i: number) => [x, this.eveStaticData.groupNames[i]]))

        this.groupElementArrayMap.clear()
        this.groupVisibleBooleanMap.clear()
        groupNames.forEach((v, k) => {
            this.groupElementArrayMap.set(k, new Array())
            this.groupVisibleBooleanMap.set(k, true)
        })

        const tbody = this.d.createElement('tbody')
        let currentItemGroup: string | undefined = undefined

        this.derivativesItemList.splice(0)
        this.eveStaticData.buildIds.map((itemId) => {
            const itemRequirementIds = Array.from(this.eveStaticData.itemRequirements(itemId).keys())
            const nonMineralCount = itemRequirementIds.filter((x) =>
                this.eveStaticData.mineralIds.indexOf(x) < 0
            ).map((x) => {
                if (this.derivativesItemList.indexOf(x) < 0) {
                    this.derivativesItemList.push(x)
                }
            })
        })
        // console.log(this.derivativesItemList)

        this.eveStaticData.buildIds.map((itemId) => {
            const itemName = itemNames.get(itemId)
            const itemGroup = itemGroups.get(itemId)

            const itemRequirementIds = Array.from(this.eveStaticData.itemRequirements(itemId).keys())
            const itemMineralIdsCount = this.eveStaticData.mineralIds
                .map((x) => itemRequirementIds.indexOf(x) >= 0 ? 1 as number : 0 as number)
                .reduce((a, b) => a + b)

            const tdList = [
                this.d.createElement('td'),
                (function (o): HTMLTableDataCellElement {
                    const el = o.d.createTextNode(itemName)
                    const td = o.d.createElement('td')
                    td.className = "align_left"
                    td.appendChild(el)
                    return td
                })(this),
                (function (o): HTMLTableDataCellElement {
                    const el = o.d.createElement('input')
                    const el_id = "qty_" + itemId
                    o.elementIdIMap.set(el_id, itemId)
                    el.id = el_id
                    el.type = "number"
                    el.value = "0"
                    el.min = "0"
                    el.step = "1"
                    el.minLength = 1
                    el.required = true
                    o.itemQuantityElementMap.set(itemId, el)
                    if (o.derivativesItemList.indexOf(itemId) < 0) {
                        el.max = "100"
                        el.maxLength = 3
                        el.addEventListener('input', function (e) { return o.onUISetItemQuantity(e); })
                    } else {
                        el.disabled = true
                    }
                    const td = o.d.createElement('td')
                    td.appendChild(el)
                    return td
                })(this),
                (function (o): HTMLTableDataCellElement {
                    const el = o.d.createElement('input')
                    const el_id = "me_" + itemId
                    o.elementIdIMap.set(el_id, itemId)
                    el.id = el_id
                    el.type = "number"
                    el.value = o.getItemME(itemId)
                    el.step = "1"
                    el.min = "0"
                    el.max = "10"
                    el.minLength = 1
                    el.maxLength = 4
                    el.required = true
                    o.itemMeElementMap.set(itemId, el)
                    el.addEventListener('input', function (e) { return o.onUISetItemME(e); })
                    const td = o.d.createElement('td')
                    td.appendChild(el)
                    return td
                })(this)
            ]

            const itemRowMap = new Map<string, Text>()
            let itemRowMapCount = 0
            this.eveStaticData.mineralIds
                .map(mId => {
                    if (itemMineralIdsCount > 0) {
                        const el = this.d.createTextNode("0")
                        const td = this.d.createElement('td')
                        td.appendChild(el)
                        itemRowMap.set(mId, el)
                        itemRowMapCount += 1
                        tdList.push(td)
                    }
                })
            if (itemRowMapCount > 0) {
                this.itemMineralElementMap.set(itemId, itemRowMap)
            }


            if ((currentItemGroup === undefined) || (currentItemGroup != itemGroup)) {
                currentItemGroup = itemGroup
                const el = this.d.createTextNode(groupNames.get(itemGroup))
                const td = this.d.createElement('td')
                td.className = "align_left"
                td.appendChild(el)

                const o = this
                const td_id = "group_" + itemGroup
                this.elementIdIMap.set(td_id, itemGroup)
                td.id = td_id
                td.addEventListener('click', function (e) { return o.onUIToggleGroup(e); })

                const tr = this.d.createElement('tr')
                tr.appendChild(td)
                tbody.appendChild(tr)
            }

            const tr = this.d.createElement('tr')
            const itemList = this.groupElementArrayMap.get(itemGroup)
            if (itemList !== undefined) {
                itemList.push(tr)
            }
            tdList.map(x => { tr.appendChild(x); })
            tbody.appendChild(tr)
        })
        return tbody
    }

    private constructTableFooter(): HTMLTableSectionElement {
        this.itemMineralTotalElementMap.clear()

        const tfoot = this.d.createElement('tfoot')
        let tdList = [
            (function (o): HTMLTableDataCellElement {
                let el = o.d.createTextNode("Total")
                let td = o.d.createElement('td')
                td.className = "align_left"
                td.appendChild(el)
                return td
            })(this),
            this.d.createElement('td'),
            this.d.createElement('td'),
            this.d.createElement('td'),
        ]
        this.eveStaticData.mineralIds.map(mId => {
            let el = this.d.createTextNode("0")
            let td = this.d.createElement('td')
            // td.className = "align_right"
            td.appendChild(el)
            this.itemMineralTotalElementMap.set(mId, el)
            tdList.push(td)
        })
        const tr = this.d.createElement('tr')
        tdList.map(x => { tr.appendChild(x); })
        tfoot.appendChild(tr)
        return tfoot
    }

    public anchorFragment(parentElement: Element): void {
        if (parentElement == null) {
            return
        }

        const table = this.d.createElement('table')
        table.appendChild(this.constructTableHeader())
        table.appendChild(this.constructTableBody())
        table.appendChild(this.constructTableFooter())

        const fragment = new DocumentFragment()
        fragment.append(table)

        const o = this
        table.addEventListener('paste', (e) => { return o.onUIClipboardPaste(e); })

        while (parentElement.childElementCount > 0) {
            parentElement.removeChild(parentElement.childNodes[parentElement.childElementCount - 1])
        }

        this.itemQuantityElementMap.forEach((v, k) => {
            this.updateItemRequiredMinerals(k, false)
        })
        this.updateTotalRequiredMinerals()

        parentElement.appendChild(fragment)
    }
}
