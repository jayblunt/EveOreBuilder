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

import IInterfaceComponent from "./InterfaceComponents.js"
import { ITranscriptServiceConsumer, ITranscriptServiceProvider } from "./TranscriptOutput.js"


export interface ICharacterServiceProvider {
    announceCharacter(username: string, userid: string): void
}

export interface ICharacterServiceConsumer {
    addCharacterServiceProvider(provider: ICharacterServiceProvider): void
}

export class CharacterInfo implements IInterfaceComponent, ITranscriptServiceConsumer {
    private readonly d: Document;
    private transcriptService: ITranscriptServiceProvider | null = null
    private characterService: ICharacterServiceProvider | null = null

    constructor(d: Document) {
        this.d = d
    }

    public addTranscriptProvider(provider: ITranscriptServiceProvider): void {
        this.transcriptService = provider
    }

    public addCharacterServiceProvider(provider: ICharacterServiceProvider): void {
        this.characterService = provider
    }

    private onUIImgTagCallback(e: HTMLImageElement): void {
        // console.log(e)
        const u = new URL(e.src)
        u.searchParams.forEach((v, k) => {
            u.searchParams.delete(k)
        })
        const idParts = u.pathname.split('/')
        const id = (idParts.length > 2) ? idParts[2] : u.pathname
        // console.log(id)
        // console.log(e.alt + ": " + u.toString())
        if (this.characterService) {
            this.characterService.announceCharacter(e.alt, id.toString())
        }
    }

    private walkFragment(e: Element): void {
        if (e != null) {
            if (e.nodeType == 1 && e.tagName == "IMG") {
                this.onUIImgTagCallback(e as HTMLImageElement)
            }
            if (e.childElementCount > 0) {
                let c = e.firstElementChild
                if (c != null) {
                    do {
                        this.walkFragment(c)
                        c = c.nextElementSibling
                    } while (c != e.lastElementChild && c != null)
                }
            }
        }
    }

    public anchorFragment(e: Element): void {
        if (e == null) {
            return
        }

        this.walkFragment(e)
    }
}