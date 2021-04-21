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

import { ISelectPricingStationPublisher, ISelectPricingStationSubscriber } from "../interface/GeneralInputs.js"
import { ITranscriptServiceConsumer, ITranscriptServiceProvider } from "../interface/TranscriptOutput.js"
import IEveDefaults from "./Defaults.js"
import IEveStaticData from "./StaticData.js"

export type TEveLiveMarketPriceData = Map<string, [number, number][]>

export interface IMarketPriceSubscriber {
    onMarketPriceEvent(publisher: IMarketPricePublisher): void
}

export interface IMarketPricePublisher {
    addMarketPriceSubscriber(subscriber: IMarketPriceSubscriber): void
    removeMarketPriceSubscriber(subscriber: IMarketPriceSubscriber): void
    notifyMarketPriceSubscribers(): void
    getPublishedMarketPriceData(): TEveLiveMarketPriceData
}

export default interface IEveLiveData {
    getMarketBids(itemIdList?: Array<string>): Promise<any>
    getMarketOffers(itemIdList?: Array<string>): Promise<any>
}

export class EveLiveData implements IMarketPricePublisher, ISelectPricingStationSubscriber, ITranscriptServiceConsumer {
    private readonly eveDefaults: IEveDefaults
    private readonly eveStaticData: IEveStaticData
    private readonly storage: Storage
    private transcriptService: ITranscriptServiceProvider | null = null

    private subscribers: Array<IMarketPriceSubscriber> = new Array()
    private readonly marketPriceData: Map<string, TEveLiveMarketPriceData> = new Map()
    private readonly marketPriceItems: Set<string> = new Set()

    private marketRegion: string
    private marketStation: string

    constructor(eveDefaults: IEveDefaults, eveStaticData: IEveStaticData, storage: Storage) {
        this.eveDefaults = eveDefaults
        this.eveStaticData = eveStaticData
        this.storage = storage
        this.eveStaticData.oreIds.map((x) => {
            this.marketPriceItems.add(x)
        })
        this.marketStation = this.eveDefaults.get("marketStation") || "60003760"
        this.marketRegion = this.eveDefaults.get("marketRegion") || "10000002"
    }

    public addTranscriptProvider(provider: ITranscriptServiceProvider): void {
        this.transcriptService = provider
    }

    public addMarketPriceSubscriber(subscriber: IMarketPriceSubscriber): void {
        if (this.subscribers.indexOf(subscriber) < 0) {
            this.subscribers.push(subscriber)
        }
    }

    public removeMarketPriceSubscriber(subscriber: IMarketPriceSubscriber): void {
        const index = this.subscribers.indexOf(subscriber)
        if (index >= 0) {
            this.subscribers.splice(index, 1)
        }
    }

    public notifyMarketPriceSubscribers(): void {
        for (const subscriber of this.subscribers) {
            subscriber.onMarketPriceEvent(this)
        }
    }

    public getPublishedMarketPriceData(): TEveLiveMarketPriceData {
        return this.marketPriceData.get(this.marketRegion) || new Map()
    }

    public onSelectPricingStationEvent(publisher: ISelectPricingStationPublisher) {
        const marketStation = publisher.getPublishedSelectPricingStationData()
        const marketRegion = this.eveStaticData.stationRegionIds[this.eveStaticData.stationIds.indexOf(marketStation)]
        if (this.marketStation != marketStation) {
            this.marketStation = marketStation
            this.eveDefaults.set("marketStation", this.marketStation)
            this.marketRegion = marketRegion
            this.eveDefaults.set("marketRegion", this.marketRegion)
            this.getMarketOffers().then((output) => { })
        }
    }

    // Fetch a set of pages from https://esi.evetech.net/ui/.
    // First page has a x-pages header that we use to fetch the rest of the data
    protected async fetchAllPages(requestUrl: URL): Promise<any> {

        const requestHeaders: { [key: string]: string } = {}
        let responseData: string | null = null

        const cachedString = this.storage.getItem(requestUrl.toString())
        if (cachedString) {
            const cachedData: { data: string, etag: string } = JSON.parse(cachedString)
            const cacheDataKeys = Array.from(Object.keys(cachedData))
            if (cacheDataKeys.indexOf('etag') >= 0 && cacheDataKeys.indexOf('data') >= 0) {
                if (cachedData.etag.length > 0 && cachedData.data.length > 0) {
                    requestHeaders['If-None-Match'] = cachedData.etag
                    // responseData = JSON.parse(cachedData.data)
                    responseData = cachedData.data
                } else {
                    this.storage.removeItem(requestUrl.toString())
                }
            }
        }

        const content = new Array<string>()

        await fetch(requestUrl.toString(), {
            method: 'GET',
            headers: requestHeaders
        }).then(async response => {
            // console.log(`${requestUrl.toString()} - ${response.status}`)
            if (!requestUrl.searchParams.has('page')) {
                const pageCount: number = [Number.parseInt(response.headers.get('x-pages') || "1"), 1].filter((x) => { return x > 0 })[0]
                // console.log(`pageCount: ${pageCount}`)
                if (pageCount > 1) {
                    const allPages = [...Array(pageCount - 1).keys()].map(x => x + 2)
                    await Promise.allSettled(
                        allPages.map(async (page) => {
                            const pageUrl = new URL(requestUrl.toString())
                            pageUrl.searchParams.set('page', page.toString())
                            return await this.fetchAllPages(pageUrl)
                        }))
                        .then(results => {
                            results.forEach((r) => {
                                if (r.status == "fulfilled") {
                                    content.push(r.value)
                                }
                            })
                        })
                }
            }
            return response
        }).then(async response => {
            if (200 == response.status) {
                const etag = response.headers.get('etag')
                responseData = await response.json()
                if (etag != null && responseData != null) {
                    if (etag.length > 0 && responseData.length > 0) {
                        this.storage.setItem(requestUrl.toString(), JSON.stringify({ etag: etag, data: responseData }))
                    }
                }
            }
            if (responseData != null && responseData.length > 0) {
                content.push(responseData)
            }
        })

        return content.reduce((a, b) => a.concat(b), new Array<string>())
    }

    // Fetch data for a set of items
    public async getMarketOrders(itemIdList: Array<string> = null, orderSide: string | null = null): Promise<void> {

        if (itemIdList != null) {
            itemIdList
                .filter((x) => !this.marketPriceItems.has(x))
                .map((x) => {
                    this.marketPriceItems.add(x)
                })
        }

        const baseUrl = new URL(`https://esi.evetech.net/latest/markets/${this.marketRegion}/orders/`)

        if (orderSide != null) {
            baseUrl.searchParams.set('order_type', orderSide.toString())
        }

        if (this.transcriptService != null) {
            this.transcriptService.addMessage("loading market for region " + this.marketRegion);
        }

        const marketPriceItems = Array.from(this.marketPriceItems)
        await Promise.allSettled(
            marketPriceItems.map(async (itemId) => {
                const itemPriceData: [number, number][] = []
                const itemUrl = new URL(baseUrl.toString())
                itemUrl.searchParams.set('type_id', itemId)
                await this.fetchAllPages(itemUrl)
                    .then((data) => {
                        data = data
                            .filter(function (o: { [key: string]: any }): boolean { return o.type_id == itemId; })
                            .filter(function (o: { [key: string]: any }): boolean { return o.is_buy_order == false; })
                        if ((data.length > 0) && (this.marketStation != null) && (this.marketStation !== undefined)) {
                            data = data.filter((o: { [key: string]: any }): boolean => o.location_id == this.marketStation)
                        }
                        return data
                    }).then((data) => {
                        if (data.length > 0) {
                            const prices: number[] = Array.from(new Set(
                                data.map((o: { [key: string]: any }): number => Number.parseFloat(o.price))))
                            prices.sort().map((px) => {
                                const qty = data
                                    .filter(function (o: { [key: string]: any }): boolean { return o.price == px; })
                                    .map((x: { [key: string]: string }): number => Number.parseInt(x.volume_remain))
                                    .reduce((a: number, b: number): number => { return a + b; }, 0)
                                itemPriceData.push([px, qty])
                            })
                        }
                        if (itemPriceData.length == 0) {
                            itemPriceData.push([0.0, 0])
                        }
                        return [itemId, itemPriceData] as const
                    })
                return [itemId, itemPriceData] as const
            })
        ).then(results => {
            if (this.marketPriceData.get(this.marketRegion) === undefined) {
                this.marketPriceData.set(this.marketRegion, new Map())
            }
            const regionMarketPrices = this.marketPriceData.get(this.marketRegion)
            results.forEach((r, i) => {
                if (r.status == "fulfilled") {
                    // console.log(r.value)
                    regionMarketPrices.set(r.value[0], r.value[1])
                }
            })
            if (this.transcriptService != null) {
                this.transcriptService.addMessage("region " + this.marketRegion + " market loaded");
            }
            this.notifyMarketPriceSubscribers()
        })
    }

    public async getMarketBids(itemIdList?: Array<string>): Promise<any> {
        this.getMarketOrders(itemIdList, "buy")
    }

    public async getMarketOffers(itemIdList?: Array<string>): Promise<any> {
        return this.getMarketOrders(itemIdList, "sell")
    }
}
