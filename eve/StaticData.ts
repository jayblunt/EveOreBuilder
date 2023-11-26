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

import { ITranscriptServiceConsumer, ITranscriptServiceProvider } from "../interface/TranscriptOutput.js"

export default interface IEveStaticData {
    buildIds: Array<string>
    buildNames: Array<string>
    buildGroups: Array<string>

    groupsIds: Array<string>
    groupNames: Array<string>

    mineralIds: Array<string>
    mineralNames: Array<string>

    oreIds: Array<string>
    oreNames: Array<string>
    oreStubIds: Array<string>
    orePortionSizes: Array<number>
    oreFullYields: TEveStaticDataItemYields

    stationIds: Array<string>
    stationNames: Array<string>
    stationRegionIds: Array<string>

    itemRequirements(itemId: string): Map<string, number>
}

interface IEveStaticDataItem {
    n: string;
    v: number;
    pv: number;
    gid: number;
    mid: number;
    ps: number
}
type TEveStaticDataItemInfo = Map<string, IEveStaticDataItem>
type TEveStaticDataGroupInfo = Map<string, { n: string }>
type TEveStaticDataStationInfo = Map<string, { stationName: string, regionID: string }>
type TEveStaticDataRegionInfo = Map<string, { n: string }>
export type TEveStaticDataItemYields = Map<string, Map<string, number>>
type TEveStaticDataItemRequirements = Map<string, Map<string, number>>
type TEveStaticDataItemList = Array<string>
type TEveStaticDataBuildInfo = Map<string, string>

export class EveStaticData implements ITranscriptServiceConsumer, IEveStaticData {
    private readonly storage: Storage
    private transcriptService: ITranscriptServiceProvider | null = null

    private staticItemInfo: TEveStaticDataItemInfo | undefined = undefined
    private staticItemYields: TEveStaticDataItemYields | undefined = undefined
    private staticItemRequirements: TEveStaticDataItemRequirements | undefined = undefined
    private staticGroupInfo: TEveStaticDataGroupInfo | undefined = undefined
    private staticStationInfo: TEveStaticDataStationInfo | undefined = undefined
    private staticMineralBuildIds: TEveStaticDataItemList | undefined = undefined
    private staticMineralIds: TEveStaticDataItemList | undefined = undefined
    private staticMineralOreIds: TEveStaticDataItemList | undefined = undefined
    private staticMineralOreStubIds: TEveStaticDataItemList | undefined = undefined
    private staticShipIds: TEveStaticDataItemList | undefined = undefined
    private staticRegionInfo: TEveStaticDataRegionInfo | undefined = undefined
    private staticBuildInfo: TEveStaticDataBuildInfo | undefined = undefined

    private readonly cache: {
        buildIds: Array<string> | undefined
        buildNames: Array<string> | undefined
        itemZeroRequirements: Map<string, number> | undefined
        buildGroupdIds: Array<string> | undefined

        groupIds: Array<string> | undefined
        groupNames: Array<string> | undefined

        mineralIds: Array<string> | undefined
        mineralNames: Array<string> | undefined
        mineralPackagedVolumes: Array<number> | undefined

        oreIds: Array<string> | undefined
        oreStubIds: Array<string> | undefined
        oreNames: Array<string> | undefined
        orePackagedVolumes: Array<number> | undefined
        orePortionSizes: Array<number> | undefined
        oreFullYields: TEveStaticDataItemYields | undefined

        stationIds: Array<string> | undefined
        stationRegionIds: Array<string> | undefined
        stationNames: Array<string> | undefined
    }

    constructor(storage: Storage) {
        this.storage = storage
        this.cache = {
            buildIds: undefined,
            buildNames: undefined,
            itemZeroRequirements: undefined,
            buildGroupdIds: undefined,

            groupIds: undefined,
            groupNames: undefined,

            mineralIds: undefined,
            mineralNames: undefined,
            mineralPackagedVolumes: undefined,

            oreIds: undefined,
            oreStubIds: undefined,
            oreNames: undefined,
            orePackagedVolumes: undefined,
            orePortionSizes: undefined,
            oreFullYields: undefined,

            stationIds: undefined,
            stationRegionIds: undefined,
            stationNames: undefined
        }
    }

    public get buildIds(): Array<string> {
        if (this.cache.buildIds === undefined) {
            this.cache.buildIds = Array.from(this.staticMineralBuildIds)
        }
        return this.cache.buildIds
    }

    public get buildNames(): Array<string> {
        if (this.cache.buildNames === undefined) {
            this.cache.buildNames = Array.from(this.buildIds.map(x => this.staticItemInfo.get(x).n))
        }
        return this.cache.buildNames
    }

    public get buildGroups(): Array<string> {
        if (this.cache.buildGroupdIds === undefined) {
            this.cache.buildGroupdIds = Array.from(this.buildIds.map(x => this.staticItemInfo.get(x).gid.toString()))
        }
        return this.cache.buildGroupdIds
    }

    public itemRequirements(itemId: string): Map<string, number> {
        const requirements = this.staticItemRequirements.get(itemId)
        if (this.cache.itemZeroRequirements === undefined) {
            this.cache.itemZeroRequirements = new Map(
                this.mineralIds.map((x) => [x, 0])
            )
        }
        return (requirements !== undefined) ? requirements : this.cache.itemZeroRequirements
    }

    public get groupsIds(): Array<string> {
        if (this.cache.groupIds === undefined) {
            const s: Set<string> = new Set()
            this.staticGroupInfo.forEach((v, k) => {
                s.add(k)
            })
            this.cache.groupIds = Array.from(s)
        }
        return this.cache.groupIds
    }

    public get groupNames(): Array<string> {
        if (this.cache.groupNames === undefined) {
            this.cache.groupNames = Array.from(this.groupsIds.map((x) => {
                return this.staticGroupInfo.get(x).n
            }))
        }
        return this.cache.groupNames
    }

    public get mineralIds(): Array<string> {
        if (this.cache.mineralIds === undefined) {
            this.cache.mineralIds = Array.from(this.staticMineralIds)
        }
        return this.cache.mineralIds
    }

    public get mineralNames(): Array<string> {
        if (this.cache.mineralNames === undefined) {
            this.cache.mineralNames = Array.from(this.mineralIds.map(x => this.staticItemInfo.get(x).n))
        }
        return this.cache.mineralNames
    }

    public get mineralPackagedVolumes(): Array<number> {
        if (this.cache.mineralPackagedVolumes === undefined) {
            this.cache.mineralPackagedVolumes = Array.from(this.mineralIds.map(x => this.staticItemInfo.get(x).pv))
        }
        return this.cache.mineralPackagedVolumes
    }

    public get oreIds(): Array<string> {
        if (this.cache.oreIds === undefined) {
            this.cache.oreIds = Array.from(this.staticMineralOreIds)
        }
        return this.cache.oreIds
    }

    public get oreStubIds(): Array<string> {
        if (this.cache.oreStubIds === undefined) {
            this.cache.oreStubIds = Array.from(this.staticMineralOreStubIds)
        }
        return this.cache.oreStubIds
    }

    public get oreNames(): Array<string> {
        if (this.cache.oreNames === undefined) {
            this.cache.oreNames = Array.from(this.oreIds.map(x => this.staticItemInfo.get(x).n))
        }
        return this.cache.oreNames
    }

    public get orePackagedVolumes(): Array<number> {
        if (this.cache.orePackagedVolumes === undefined) {
            this.cache.orePackagedVolumes = Array.from(this.oreIds.map(x => this.staticItemInfo.get(x).pv))
        }
        return this.cache.orePackagedVolumes
    }

    public get orePortionSizes(): Array<number> {
        if (this.cache.orePortionSizes === undefined) {
            this.cache.orePortionSizes = Array.from(this.oreIds.map(x => this.staticItemInfo.get(x).ps))
        }
        return this.cache.orePortionSizes
    }

    public get oreFullYields(): TEveStaticDataItemYields {
        if (this.cache.oreFullYields === undefined) {
            this.cache.oreFullYields = new Map(this.oreIds.map(x => {
                const oreYieldMap: Map<string, number> = new Map(this.staticItemYields.get(x))
                return [x, new Map(this.mineralIds.map(mId => {
                    let oyv = oreYieldMap.get(mId)
                    oyv = (oyv === undefined) ? 0 : Math.floor(oyv * 1.0)
                    return [mId, oyv]
                }))]
            }))
        }
        return this.cache.oreFullYields
    }

    public get stationIds(): Array<string> {
        if (this.cache.stationIds === undefined) {
            this.cache.stationIds = Array.from(this.staticStationInfo.keys())
        }
        return this.cache.stationIds
    }

    public get stationNames(): Array<string> {
        if (this.cache.stationNames === undefined) {
            this.cache.stationNames = Array.from(this.stationIds.map(x => this.staticStationInfo.get(x).stationName))
        }
        return this.cache.stationNames
    }

    public get stationRegionIds(): Array<string> {
        if (this.cache.stationRegionIds === undefined) {
            this.cache.stationRegionIds = Array.from(this.stationIds.map(x => this.staticStationInfo.get(x).regionID))
        }
        return this.cache.stationRegionIds
    }

    public addTranscriptProvider(provider: ITranscriptServiceProvider): void {
        this.transcriptService = provider
    }

    // Fetch a set of pages from https://esi.evetech.net/ui/.
    // The first page has a x-pages header that we use to fetch the rest of the data
    protected async cachedFetch(requestUrl: URL, force: boolean = false): Promise<any> {

        const requestHeaders: { [key: string]: string } = {}
        let responseData = undefined

        if (force == false && this.storage !== undefined) {
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
        }

        await fetch(requestUrl.toString(), {
            method: 'GET',
            headers: requestHeaders
        }).then(async response => {
            if (200 == response.status) {
                const etag = response.headers.get('etag')
                responseData = await response.json()
                if (etag != null && responseData !== undefined) {
                    if (etag.length > 0 && responseData.length > 0) {
                        const cachedString = JSON.stringify({ etag: etag, data: responseData })
                        if (this.storage !== undefined) {
                            this.storage.setItem(requestUrl.toString(), cachedString)
                        }
                    }
                }
            }
        })

        return responseData
    }

    public async getStaticData(baseUrl: URL): Promise<any> {
        // baseUrl = new URL("content/data.json", baseUrl)
        // console.log(baseUrl.toString())

        if (this.transcriptService) {
            this.transcriptService.addMessage("loading static data from " + baseUrl)
        }

        await this.cachedFetch(baseUrl, true)
            .then(staticData => {
                function objectToMap(o: { [key: string]: any }, shallow: boolean = false): Map<any, any> {
                    let m = new Map()
                    for (let k of Object.keys(o)) {
                        if ((shallow == false) && (o[k] instanceof Object)) {
                            m.set(k, objectToMap(o[k]))
                        } else {
                            m.set(k, o[k])
                        }
                    }
                    return m
                }

                if (staticData === undefined) {
                    if (this.transcriptService) {
                        this.transcriptService.addMessage("static data not available")
                    }
                } else {


                    try {

                        console.log(`staticData: ${staticData}`)
                        const actualStaticDataKeys: Array<string> = Array.from(Object.keys(staticData))
                        const missingStaticDataKeys: Array<string> = []
                        const reqiredStaticDataKeys: Array<string> = Array.from([
                            "itemInfo",
                            "groupInfo",
                            "itemYields",
                            "itemRequirements",
                            "shipIds",
                            "mineralBuildIds",
                            "mineralOreIds",
                            "mineralOreStubIds",
                            "mineralIds",
                            "stationInfo",
                            "regionInfo",
                            "buildInfo"
                        ])

                        reqiredStaticDataKeys.map((k) => {
                            if (actualStaticDataKeys.indexOf(k) < 0) {
                                missingStaticDataKeys.push(k)
                            }
                        })

                        if (missingStaticDataKeys.length > 0) {
                            console.log("missingStaticDataKeys:" + missingStaticDataKeys)
                        }

                        this.staticItemInfo = <TEveStaticDataItemInfo>objectToMap(staticData.itemInfo, true)
                        this.staticGroupInfo = <TEveStaticDataGroupInfo>objectToMap(staticData.groupInfo, true)
                        this.staticItemYields = <TEveStaticDataItemYields><unknown>objectToMap(staticData.itemYields)
                        this.staticItemRequirements = <TEveStaticDataItemRequirements><unknown>objectToMap(staticData.itemRequirements)
                        this.staticShipIds = <TEveStaticDataItemList>Array.from(staticData.shipIds).map((x) => x.toString())
                        this.staticMineralBuildIds = <TEveStaticDataItemList>Array.from(staticData.mineralBuildIds).map((x) => x.toString())
                        this.staticMineralOreIds = <TEveStaticDataItemList>Array.from(staticData.mineralOreIds).map((x) => x.toString())
                        this.staticMineralOreStubIds = <TEveStaticDataItemList>Array.from(staticData.mineralOreStubIds).map((x) => x.toString())
                        this.staticMineralIds = <TEveStaticDataItemList>Array.from(staticData.mineralIds).map((x) => x.toString())
                        this.staticStationInfo = <TEveStaticDataStationInfo>objectToMap(staticData.stationInfo, true)
                        this.staticRegionInfo = <TEveStaticDataRegionInfo>objectToMap(staticData.regionInfo, true)
                        this.staticBuildInfo = <TEveStaticDataBuildInfo>objectToMap(staticData.buildInfo, true)

                        if (this.transcriptService) {
                            this.transcriptService.addMessage("static data loaed. version: " + this.staticBuildInfo.get("date"))
                        }

                    }
                    catch (e) {
                        if (this.transcriptService) {
                            this.transcriptService.addMessage(e)
                        }
                    }
                }
            })
        return this
    }
}

