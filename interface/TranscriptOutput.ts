// MIT License

import IInterfaceComponent from "./InterfaceComponents"

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


export enum ETranscriptMessageType {
    Error = 2,
    Info = 6
}

export interface ITranscriptServiceConsumer {
    addTranscriptProvider(provider: ITranscriptServiceProvider): void
}

export interface ITranscriptServiceProvider {
    addMessage(message: string, type?: ETranscriptMessageType): void
}

export class TranscriptOutput implements IInterfaceComponent, ITranscriptServiceProvider {
    private readonly d: Document
    private readonly c: Clipboard
    private readonlyMessageBoxReady: boolean = false
    private messageBoxElement: HTMLDivElement
    private maxLines: number = 10
    private cachedMessages: Array<[string | undefined, string]> = new Array()

    constructor(d: Document, c: Clipboard) {
        this.d = d
        this.c = c
        this.messageBoxElement = this.d.createElement('div')
    }

    private appendMessage(hhmmss: string | undefined, message: string): void {
        if (this.readonlyMessageBoxReady) {
            while (this.messageBoxElement.childElementCount > this.maxLines) {
                const childElement = this.messageBoxElement.firstElementChild
                if (childElement) {
                    this.messageBoxElement.removeChild(childElement)
                }
            }
            const p = this.d.createElement('p')
            p.className = "message"
            if (hhmmss !== undefined) {
                p.appendChild(this.d.createTextNode(hhmmss))
                p.appendChild(this.d.createTextNode(": "))
            }
            p.appendChild(this.d.createTextNode(message))
            this.messageBoxElement.appendChild(p)
        } else {
            this.cachedMessages.push([hhmmss, message])
        }
    }

    public addMessage(message: string, type: ETranscriptMessageType = ETranscriptMessageType.Info): void {
        const now = new Date()
        const hhmmss = now.toTimeString().split(' ')[0]
        this.appendMessage(hhmmss, message)
    }

    public anchorFragment(parentElement: Element): void {
        if (parentElement == null) {
            return
        }

        while (parentElement.childElementCount > 0) {
            parentElement.removeChild(parentElement.childNodes[parentElement.childElementCount - 1])
        }

        const fragment = new DocumentFragment()
        this.messageBoxElement = this.d.createElement('div')
        this.messageBoxElement.className = "messagebox"

        const p = this.d.createElement('p')
        p.appendChild(this.messageBoxElement)

        this.readonlyMessageBoxReady = true
        this.cachedMessages.map(([hhmmss, msg], i) => {
            this.appendMessage(hhmmss, msg)
        })
        this.cachedMessages.splice(0)

        fragment.appendChild(p)
        parentElement.appendChild(fragment)
    }
}
