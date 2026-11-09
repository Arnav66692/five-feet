/**
 * Criterion 10: the full card's world scale with the user 3 m away is 2 to 2.4 times its world
 * scale with the user 1.5 m away, so the verdict keeps the same apparent size. The card is opened
 * at 1.5 m, then the user steps back to 3 m while it is still showing.
 * The lower bound allows 0.001 for float rounding only: exact linear scaling gives 2.000.
 */
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {getCard, pinchAndRead, standAtDistanceFrom} from "./FiveFeetLeafHelpers"

const ITEM = "Item_Firewood"
const NEAR_CM = 150
const FAR_CM = 300
const MIN_RATIO = 2
const MAX_RATIO = 2.4
const FLOAT_EPS = 0.001
const SETTLE_MS = 300

@component
export class FiveFeetCardScaleScenario extends Scenario {
  async run(): Promise<void> {
    await sleep(1000)
    const interactor = new DefaultLeafInteractor()
    const card = getCard()

    const near = standAtDistanceFrom(ITEM, NEAR_CM)
    await sleep(SETTLE_MS)
    const opened = await pinchAndRead(interactor, ITEM)
    await sleep(SETTLE_MS)
    const nearScale = card.getTransform().getWorldScale().x

    const far = standAtDistanceFrom(ITEM, FAR_CM)
    await sleep(SETTLE_MS)
    const farScale = card.getTransform().getWorldScale().x
    const stillShowing = card.isShowing()
    const ratio = farScale / nearScale

    print(
      `[FiveFeetLEAF] c10 card scale: at ${(near / 100).toFixed(2)} m=${nearScale.toFixed(4)} ` +
        `at ${(far / 100).toFixed(2)} m=${farScale.toFixed(4)} ratio=${ratio.toFixed(4)} ` +
        `showingAt3m=${stillShowing} verdict="${opened.verdictText}"`
    )
    expect(opened.showing, "card opened at 1.5 m").toBe(true)
    expect(stillShowing, "card still showing at 3 m").toBe(true)
    expect(ratio >= MIN_RATIO - FLOAT_EPS, `scale ratio ${ratio.toFixed(4)} >= ${MIN_RATIO}`).toBe(true)
    expect(ratio <= MAX_RATIO, `scale ratio ${ratio.toFixed(4)} <= ${MAX_RATIO}`).toBe(true)
  }
}
