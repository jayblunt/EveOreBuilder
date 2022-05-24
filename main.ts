import { CharacterInfo } from "./interface/CharacterInfo.js"
import { EveCalculator } from "./eve/Calculator.js"
import { EveDefaults } from "./eve/Defaults.js"
import { EveLiveData } from "./eve/LiveData.js"
import { EveStaticData } from "./eve/StaticData.js"
import { GeneralInputs } from "./interface/GeneralInputs.js"
import { GeneralOutputs } from "./interface/GeneralOutputs.js"
import { MineralBuildInputs } from "./interface/MineralBuildInputs.js"
import { TranscriptOutput } from "./interface/TranscriptOutput.js"


const VERSION = "0.8.0"
const COPYRIGHT = [
    "© 2022 Jay Blunt. All rights reserved.",
    "All EVE related materials © 2014 CCP hf. All rights reserved.",
    "\"EVE\", \"EVE Online\", \"CCP\", and all related logos and images are trademarks or registered trademarks of CCP hf."
]

const transcriptProvider = new TranscriptOutput(document, navigator.clipboard)

const eveStaticData = new EveStaticData(window.sessionStorage)
eveStaticData.addTranscriptProvider(transcriptProvider)

let baseUrl = new URL("content/data.json", new URL(document.URL))
// if ("EVE_NEW_SDE" in window) {
//     baseUrl = new URL("content/data_new.json", new URL(document.URL))
// }

const getStaticDataFuture = eveStaticData.getStaticData(baseUrl)

const eveDefaults = new EveDefaults(window.localStorage)

const eveCalculator = new EveCalculator(eveStaticData)
eveCalculator.addTranscriptProvider(transcriptProvider)

window.addEventListener('load', () => {

    const transcriptElement = document.querySelector("#transcript")
    if (transcriptElement) {
        transcriptProvider.anchorFragment(transcriptElement)
    }

    getStaticDataFuture.then(() => {

        const eveLiveData = new EveLiveData(eveDefaults, eveStaticData, window.sessionStorage)
        eveLiveData.addTranscriptProvider(transcriptProvider)
        eveLiveData.getMarketOffers().then(() => {
            // eveLiveData.notifyMarketPriceSubscribers()
        })

        const generalOutputs = new GeneralOutputs(document, navigator.clipboard, eveStaticData, eveCalculator)
        generalOutputs.addTranscriptProvider(transcriptProvider)
        eveLiveData.addMarketPriceSubscriber(generalOutputs)
        const generalOutputElement = document.querySelector("#generaloutputs")
        if (generalOutputElement) {
            generalOutputs.anchorFragment(generalOutputElement)
        }

        const buildInputsElement = document.querySelector("#shipinputs")
        if (buildInputsElement) {
            const buildInputs = new MineralBuildInputs(document, eveDefaults, eveStaticData, eveCalculator)
            buildInputs.addTranscriptProvider(transcriptProvider)
            buildInputs.addMineralsSubscriber(generalOutputs)
            buildInputs.anchorFragment(buildInputsElement)
        }

        const generalInputsElement = document.querySelector("#generalinputs")
        if (generalInputsElement) {
            const generalInputs = new GeneralInputs(document, eveDefaults, eveStaticData)
            generalInputs.addTranscriptProvider(transcriptProvider)
            generalInputs.addReprocessingEfficiencySubscriber(generalOutputs)
            generalInputs.addLiftOffersCountSubscriber(generalOutputs)
            generalInputs.addSelectPricingStationSubscriber(eveLiveData)
            generalInputs.anchorFragment(generalInputsElement)
        }

        const characterElement = document.querySelector("#character")
        if (characterElement) {
            const characterInfo = new CharacterInfo(document)
            characterInfo.addTranscriptProvider(transcriptProvider)
            characterInfo.anchorFragment(characterElement)
        }

        const versionElement = document.querySelector("#version_string")
        if (versionElement) {
            const p = document.createElement('p')
            const text = document.createTextNode(VERSION)
            p.appendChild(text)
            versionElement.appendChild(p)
        }

        const copyrightElement = document.querySelector("#copyright_string")
        if (copyrightElement) {
            const p = document.createElement('p')
            COPYRIGHT.forEach((x, i) => {
                if (i > 0) {
                    p.appendChild(document.createElement('br'))
                }
                const text = document.createTextNode(x)
                p.appendChild(text)
            })
            copyrightElement.appendChild(p)
        }

    })
})
