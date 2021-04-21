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

export default interface IEveDefaults {
    get(k: string): string | null
    set(k: string, v: string): void
    delete(k: string): void
}

export class EveDefaults implements IEveDefaults {
    private readonly storage: Storage
    private readonly debug: number
    private readonly defaults = {
        "marketRegion": "10000002",
        "marketStation": "60003760",
        "reprocessingEfficiency": "0.5",
        "liftOffersCount": "1"
    }

    constructor(storage: Storage, debug: number = 0) {
        this.storage = storage
        this.debug = debug
    }

    public get(k: string): string | null {
        let v = this.storage.getItem(k)
        if (v == null) {
            const m: Map<string, string> = new Map(Object.entries(this.defaults))
            const vv = m.get(k)
            v = (vv === undefined) ? null : vv
        }
        if (this.debug > 0) console.log(this.constructor.name + ".get(" + k + ") = " + v)
        return v
    }

    public set(k: string, v: string): void {
        if (this.debug > 0) console.log(this.constructor.name + ".set(" + k + ", " + v + ")")
        const oldValue = this.get(k)
        if (oldValue != v) {
            this.storage.setItem(k, v)
        }
    }

    public delete(k: string): void {
        this.storage.removeItem(k)
    }
}
